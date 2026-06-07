# IssueFlow — Research & Technical Decisions

**Feature**: `001-issueflow-backend`  
**Date**: 2026-06-06  
**Last Updated**: 2026-06-06 (IC-11 strict linkage; username validation)
**Purpose**: Resolve planning unknowns from `plan.md` Technical Context and
`decision-log.md` implementation candidates (IC-*).

---

## IC-10: Concurrent Ticket and Comment Updates

**Decision**: Pessimistic row-level locking with `SELECT … FOR UPDATE NOWAIT` inside a
database transaction for `PATCH /tickets/:id` and `PATCH /tickets/:ticketId/comments/:commentId`.

**Rationale**:

- FR-TKT-009 and FR-CMT-004 require that simultaneous updates MUST NOT both succeed; the
  loser receives an informative error.
- README PATCH bodies do not include a `version` or `updatedAt` field (IC-10 Option A/C/D
  constraint). Extending PATCH bodies (Options B/D) would alter the published contract.
- `FOR UPDATE NOWAIT` ensures that when two PATCH requests overlap on the same row, the
  second acquires no lock and fails immediately with `409 Conflict` and message
  `"This resource is being updated by another request. Please retry."` rather than
  blocking and applying a stale-intent patch after the first completes.
- This satisfies the acceptance criterion ("only one succeeds") for truly simultaneous
  requests without requiring clients to send concurrency tokens.

**Alternatives considered**:

| Option | Rejected because |
|--------|------------------|
| B — Optimistic `version` on PATCH | Requires README PATCH body extension |
| C — ETag / If-Match headers | Headers not documented in README tables |
| D — `updatedAt` on PATCH | Same body-extension concern as B |
| A (wait) — `FOR UPDATE` without NOWAIT | Second writer would wait and succeed sequentially, violating "only one succeeds" for overlapping requests |

**Implementation notes**:

- Wrap PATCH handler logic in `@Transactional()` (TypeORM query runner or DataSource transaction).
- Lock order: acquire ticket/comment row lock before any related writes (mentions, audit).
- Map PostgreSQL `55P03` (lock_not_available) to `409 Conflict` via global exception filter.
- E2E tests: fire two concurrent PATCH requests (Promise.all) against same entity; assert
  one `200`, one `409`.

---

## IC-11: DEVELOPER “In the Project” Interpretation

**Decision**: **Option E — Internal `ProjectMember` table** as the **sole source of truth**
(no new API endpoints, **no bootstrap** from system-wide DEVELOPERs).

### Comparison: Option A vs Option E (revised)

| Criterion | Option A (all system DEVELOPERs) | Option E (`ProjectMember` — revised) |
|-----------|----------------------------------|--------------------------------------|
| “In the project” / “linked” semantics | Weak | Strong — membership row required |
| Auto-assign and workload same pool | Yes (global) | Yes — `ProjectMember` DEVELOPERs only |
| No members → `assigneeId: null` | No — still assigns globally | Yes — spec edge case #5 / BR-07 |
| Membership via explicit linkage only | N/A | Yes — owner or explicit `assigneeId` |
| README API unchanged | Yes | Yes |

**Verdict**: Option E with **strict `ProjectMember` sourcing** is superior. Bootstrap
from all system DEVELOPERs was removed per product correction: linkage must be explicit.

### Option E behavior (revised)

**`ProjectMember` entity** (internal): `(projectId, userId, createdAt)`; unique
`(projectId, userId)`; only `DEVELOPER` users are stored. **Authoritative** for who is
“in the project” for auto-assign and workload.

**Membership creation** (no public API — explicit linkage only):

1. `POST /projects` — if `owner.role = DEVELOPER`, insert `ProjectMember` for owner.
2. Ticket create with **explicit** `assigneeId` — insert if assignee is `DEVELOPER`.
3. `PATCH /tickets/:id` with **explicit** `assigneeId` — insert if new assignee is `DEVELOPER`.
4. Import row with **explicit** `assigneeId` — insert if assignee is `DEVELOPER`.

**Not membership triggers**: auto-assign results (assignee already in pool), import/create
without `assigneeId`, or any implicit inference from ticket history alone.

Membership is **sticky** (not removed on unassign or ticket soft-delete).

**Shared pool** (`AutoAssignService` + `WorkloadService`):

- Pool = all `DEVELOPER` users with a `ProjectMember` row for the target `projectId`.
- Workload metric = non-`DONE`, non-soft-deleted tickets in that project per assignee.
- Tie-break: lowest `openTicketCount`, then oldest user `createdAt` (BR-07).
- **No bootstrap**: never query system-wide DEVELOPERs outside `ProjectMember`.
- If pool is empty → `assigneeId: null` on ticket create (no error); workload returns `[]`.

**Workload endpoint** (`GET /projects/:projectId/workload`):

- Returns only linked `DEVELOPER` `ProjectMember`s with project-scoped `openTicketCount`,
  sorted ascending per README.

**PDF note**: Assignment §3.8 “queries all DEVELOPER” is satisfied at the **linked-member**
scope once `ProjectMember` rows exist; first ticket on ADMIN-owned project without prior
linkage stays unassigned until a DEVELOPER is linked via owner or explicit `assigneeId`.

**Alternatives rejected**:

| Option | Rejected because |
|--------|------------------|
| A — All system DEVELOPERs always | Not “in the project”; violates strict linkage |
| Bootstrap when no members | Removed — contradicts explicit-linkage requirement |
| B — Infer membership from assignments only | No row without assignment; chicken-and-egg |
| D — Undocumented membership API | Violates README contract |

---

## IC-01: JWT Logout Invalidation

**Decision**: PostgreSQL-backed token deny-list (`RevokedToken` entity) storing JWT `jti`
(or token hash) with `expiresAt` aligned to token `exp`.

**Rationale**:

- Survives application restarts (NFR-01 persistence).
- Meets FR-AUTH-004 and Constitution security principle I (logout invalidation).
- In-memory deny-list rejected for non-dev environments (lost on restart).

**Alternatives considered**:

- In-memory deny-list — acceptable for local dev fallback only; not primary strategy.
- Short-lived tokens only — weak logout semantics; does not satisfy explicit logout requirement.

**Implementation notes**:

- Generate unique `jti` claim per issued token.
- `JwtAuthGuard` checks deny-list after signature validation.
- Periodic cleanup job removes expired deny-list rows.

---

## IC-02: Audit Action Catalog

**Decision**: Adopt the action catalog from `decision-log.md` IC-02, **extended** for
project cascade operations.

**Rationale**: Covers all state-changing README endpoints plus system actions (AUTO_ASSIGN,
ESCALATE). PDF §3.1 requires *all* state-changing actions, including cascade ticket
soft-deletes/restores when a project is deleted or restored.

**Cascade rules** (added):

| Trigger | Audit entries |
|---------|---------------|
| `DELETE /projects/:id` | `SOFT_DELETE` `PROJECT` (USER) + one `SOFT_DELETE` `TICKET` (USER) per cascade-affected ticket |
| `POST /projects/:id/restore` | `RESTORE` `PROJECT` (USER) + one `RESTORE` `TICKET` (USER) per ticket restored via `deletedWithProjectId` |

Each cascade ticket entry uses `entityId` = ticket id; optional `metadata: { cascade: true, projectId }`.
Individually soft-deleted tickets are not re-audited on project delete (they were already audited).

---

## IC-04: Attachment Validation Depth

**Decision**: Three-layer validation — (1) Multer size limit 10 MB, (2) MIME allowlist per
PDF §3.3, (3) magic-byte content sniffing before persistence.

**Rationale**: Constitution Security Principle III prohibits trusting client-supplied MIME
alone. Assignment limits: `image/png`, `image/jpeg`, `application/pdf`, `text/plain`.

**Storage path**: `{ATTACHMENTS_PATH}/tickets/{ticketId}/{uuid}-{sanitizedFilename}` where
`ATTACHMENTS_PATH` defaults to `./storage/attachments` (gitignored). Files stored outside
static web root.

**Alternatives considered**:

- MIME allowlist only — rejected per constitution.
- Cloud storage — out of assignment scope.

---

## IC-05: Route Registration Order

**Decision**: Register static path segments before parameterized routes in NestJS modules.

**Critical ordering**:

- `GET /tickets/deleted` before `GET /tickets/:ticketId`
- `GET /tickets/export` before `GET /tickets/:ticketId`
- `POST /tickets/import` before `POST /tickets/:ticketId` (if parameterized POST added later)
- `GET /projects/deleted` before `GET /projects/:projectId`

**Rationale**: Prevents Express/Nest path shadowing where `deleted` or `export` is parsed as
an ID parameter.

---

## IC-06: Error Response Shape

**Decision**: Global `HttpExceptionFilter` returning:

```json
{ "statusCode": <number>, "message": "<string or string[]>", "error": "<short label>" }
```

**Rationale**: Matches NestJS default exception shape; satisfies NFR-02 informative errors.
`class-validator` failures map `message` to string array of constraint messages.

---

## IC-07: Escalation Scheduling

**Decision**: `@nestjs/schedule` cron every **1 minute**; compare `dueDate` against **UTC now**;
escalate **one priority level** per ticket per evaluation cycle.

**Rationale**:

- PDF §3.7 requires background scheduler; 1-minute interval balances responsiveness and load.
- UTC avoids local-time ambiguity (ISO-8601 in README examples use `Z` suffix).
- One step per cycle prevents multi-level jumps if job was delayed.

**Testing**: Inject `Clock` abstraction (or mock `Date`) in `TicketEscalationService` unit tests.

---

## IC-08: Technology Stack

**Decision**: **NestJS 11**, TypeScript 5.x, PostgreSQL 16 (pinned in `compose.yml`),
TypeORM 0.3 with migrations, JWT via `@nestjs/jwt` + `@nestjs/passport`, scheduling via
`@nestjs/schedule`.

**Rationale**: Assignment PDF §1 requires NestJS 11 (Constitution I). The provided skeleton
ships NestJS 10 (`@nestjs/*` ^10 in `package.json`) — upgrade to NestJS 11 as the **first
Foundation/setup task** in `plan.md` before feature modules. Node.js 20+ required (aligned with plan).

**NestJS 11 migration notes** (implementation):

- Upgrade `@nestjs/*` packages to v11; verify `@nestjs/typeorm` compatibility.
- Express v5 default: use Nest’s legacy route path converter if wildcard routes needed.
- Dynamic modules: assign `TypeOrmModule.forRoot(...)` to a shared `const` and reuse the
  reference to avoid duplicate DataSource instances under v11 module resolution.
- Re-run full e2e suite after upgrade.

**Additional packages** (to add during implementation):

| Package | Purpose |
|---------|---------|
| `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt` | JWT auth |
| `@nestjs/schedule` | Escalation cron |
| `@nestjs/config` | Environment configuration |
| `bcrypt` | Hash seeded ADMIN password (constitution II) |
| `file-type` or equivalent | Magic-byte MIME verification |

---

## IC-09: Project Delete / Restore Cascade Tracking

**Decision**: Add nullable `deletedWithProjectId` on `Ticket` entity (internal only; not exposed
in API responses).

**Rationale**:

- BR-10: project delete soft-deletes active tickets not already individually deleted.
- BR-11: project restore restores only tickets deleted as part of that project delete.
- Individual ticket delete sets `deletedAt` but leaves `deletedWithProjectId = null`.
- Project cascade delete sets both `deletedAt` and `deletedWithProjectId = project.id`.
- Project restore clears `deletedAt` only where `deletedWithProjectId = project.id`, then nulls
  the flag.

**Alternatives considered**:

- Deletion batch UUID — equivalent complexity, no README benefit.
- Separate junction table — over-engineered for MVP.

---

## PD-08 / PD-09: Bootstrap and MVP Authentication

**Decision**: Keep **PD-09 as approved** (no plan change to product decision).

### PD-08

TypeORM seed migration creates initial ADMIN (`username: admin`); credentials documented in
`run.md`. `passwordHash` stored bcrypt-hashed for constitution Security II compliance.

### PD-09 — Rationale and expected behavior

**Why first-login password enrollment (not optional password on `POST /users`)**:

- Preserves README `POST /users` body exactly (no `password` field per contract).
- README login body remains `{ username, password }`; both fields syntactically required.
- No new endpoints or request/response fields — enrollment happens on first `POST /auth/login`.
- Approved in `decision-log.md` (PD-09) after spec clarification.

**Expected runtime behavior**:

| Step | Behavior |
|------|----------|
| `POST /auth/login` | Reject empty `username` or `password` → `401` |
| Unknown username | `401` (spec: invalid login credentials) |
| Known user, `passwordHash = null` | Store bcrypt hash of supplied password; `200` with JWT |
| Known user, `passwordHash` set | Verify bcrypt; wrong password → `401`; correct → `200` with JWT |
| `POST /users` | Creates user with `passwordHash = null` (no `password` field) |
| Seeded ADMIN | Predefined bcrypt hash; password verified on every login |

**Constitution alignment**: Security II requires hashing stored passwords — satisfied for
seeded ADMIN and for API-created users after first login.

**Grader documentation**: `run.md` MUST state login semantics: seeded admin password
verification, first-login enrollment for API-created users, bcrypt on subsequent logins.

---

## IC-03: Repository Pattern

**Decision**: TypeORM `Repository<T>` injected via `@InjectRepository`; domain-specific
query methods encapsulated in dedicated repository classes only where queries are complex
(workload aggregation, soft-delete scoping, deny-list lookup).

**Rationale**: Constitution favors simplicity; thin custom repositories for workload and
audit queries avoid bloating services while keeping controllers thin.

---

## Performance & Scale Assumptions

| Topic | Assumption |
|-------|------------|
| Performance goals | Assignment-scale: <100 concurrent users, <10k tickets; no SLA beyond responsive local dev |
| Scale | Single-node deployment; no horizontal scaling requirements |
| Target platform | Node.js 20 LTS, Docker Compose PostgreSQL for local dev |

## PD-10: User Hard Delete with Cascade

**Decision**: Option 1 — hard delete with transactional cascade when BR-14 passes.

**Guards (`409`)**: Project owner; assignee on non-DONE ticket. Comment authorship does not block.

**Cascade on `200`**: Remove authored comments (+ their mentions), remove received mention rows,
remove `project_members`, `SET NULL` `assigneeId` on tickets, hard-delete user, audit `DELETE USER`.

**Audit `performedBy`**: Integer column without FK to `users`; historical ids **retained** (FR-AUD-005).

**Not required**: Per-comment `DELETE` audit for cascade-removed comments.

See `spec.md` BR-18 and `decision-log.md` PD-10.

---

## Username Format (mentions)

**Decision**: Usernames MUST NOT contain whitespace; must be a single token (word).

**Rationale**: `@mentions` match `@username` in comment text (BR-15). Whitespace in usernames
breaks mention parsing and matching. `MentionParserService` uses `@(\w+)` — usernames must
align (no spaces).

**Validation**:

| Endpoint | Rule |
|----------|------|
| `POST /users` | Reject `username` containing any whitespace → `400` |
| `POST /users/update/:userId` | Username not in README body (immutable); no username updates |

**Pattern** (implementation): reject if `/\s/.test(username)` or equivalent; require non-empty
trimmed string with no interior/exterior spaces.

No NEEDS CLARIFICATION items remain.
