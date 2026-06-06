# IssueFlow — Decision Log & Planning Deferred Items

**Feature**: `001-issueflow-backend`  
**Created**: 2026-06-05  
**Last Updated**: 2026-06-06  
**Purpose**: Records resolved product decisions and implementation candidates
deferred to `/speckit-plan`. The specification (`spec.md`) defines *what*; this document
records *decisions* and *how* candidates for planning.

**Precedence**: This document does not override `spec.md`, README, PDF, or Constitution.
Approved decisions here MUST be reflected in `plan.md` during planning.

---

## Approved Product Decisions

| ID | Decision | Source |
|----|----------|--------|
| PD-01 | Import: only `title` mandatory per row; missing enums default to `TODO`/`MEDIUM`/`FEATURE` | Spec review |
| PD-02 | No additional role gates beyond ADMIN soft-delete list/restore | Spec review |
| PD-03 | Circular dependencies allowed for MVP | Assignment / spec |
| PD-04 | `authorId` in comment body must match authenticated user | Spec |
| PD-05 | Username and email globally unique (case-insensitive) | Spec |
| PD-06 | Unknown `@mentions` ignored silently | Spec |
| PD-07 | Export excludes soft-deleted tickets | Spec |
| PD-08 | **Initial bootstrap**: Use a seeded initial ADMIN user; seed credentials documented in `run.md`; no API contract changes | Resolved OD-04 |
| PD-09 | **Login credentials (MVP)**: `POST /auth/login` keeps `username` + `password` per README; `password` is syntactically required. MVP validates that the username exists; password persistence and verification are not required in MVP. `POST /users` body unchanged (no `password` field). *Plan alternative*: optional `password` on `POST /users` with full username+password auth — only if explicitly chosen in plan without changing paths | Resolved OD-02 |
| PD-10 | **User deletion**: Hard delete with cascade cleanup (Option 1). Guards per BR-14 only (project owner, assignee on non-DONE ticket). Authored comments do **not** block delete. On delete: remove authored comments and related mentions, remove received mention rows, remove `ProjectMember` rows, `SET NULL` `assigneeId` on DONE-assigned tickets, retain `audit_logs.performedBy` user id. No user soft-delete | User-delete review 2026-06-06 |

### PD-09 detail

Preserves README registration body. Login contract unchanged. Seeded ADMIN (PD-08) can
always log in via username-existence check. Users created via `POST /users` can log in
when their username exists (any syntactically valid password in MVP).

### PD-10 detail

- `DELETE /users/:userId` remains `200` / `409` per README and spec; no new endpoints.
- Comment authorship is **not** a blocking reference (supersedes prior plan-only BR-14c).
- `GET /users/:userId` and `GET /users/:userId/mentions` return `404` after delete.
- Historical `GET /audit-logs` rows keep original numeric `performedBy` even when that user
  no longer exists (`GET /users/:performedBy` may return `404`).
- Per-comment `DELETE` audit entries are **not** required for cascade-deleted comments (only
  the user `DELETE` action is audited).

---

## Open Product Decisions

None. All product ambiguities identified during specification are resolved above.
Planning addresses implementation candidates only.

---

## Implementation Candidates (planning only)

Technical choices for `plan.md` — not open product decisions.

### IC-01: JWT logout invalidation

- PostgreSQL token deny-list until `exp`
- In-memory deny-list (dev only)
- Short-lived tokens only (weak logout semantics)

### IC-02: Audit action catalog

| action | entityType | actor | Trigger |
|--------|------------|-------|---------|
| CREATE | USER | USER | POST /users |
| UPDATE | USER | USER | POST /users/update/:id |
| DELETE | USER | USER | DELETE /users/:id |
| LOGOUT | AUTH | USER | POST /auth/logout |
| CREATE | PROJECT | USER | POST /projects |
| UPDATE | PROJECT | USER | PATCH /projects/:id |
| SOFT_DELETE | PROJECT | USER | DELETE /projects/:id |
| RESTORE | PROJECT | USER | POST /projects/:id/restore |
| CREATE | TICKET | USER | POST /tickets, import row |
| UPDATE | TICKET | USER | PATCH /tickets/:id |
| SOFT_DELETE | TICKET | USER | DELETE /tickets/:id |
| RESTORE | TICKET | USER | POST /tickets/:id/restore |
| AUTO_ASSIGN | TICKET | SYSTEM | Auto-assign on create |
| ESCALATE | TICKET | SYSTEM | Overdue escalation |
| CREATE | COMMENT | USER | POST comment |
| UPDATE | COMMENT | USER | PATCH comment |
| DELETE | COMMENT | USER | DELETE comment |
| ADD | DEPENDENCY | USER | POST dependency |
| REMOVE | DEPENDENCY | USER | DELETE dependency |
| UPLOAD | ATTACHMENT | USER | POST attachment |
| DELETE | ATTACHMENT | USER | DELETE attachment |

### IC-03: Domain entity attributes (data model draft)

User, Project, Ticket, Comment, Mention, TicketDependency, Attachment, AuditLog,
RevokedToken (if deny-list chosen).

### IC-04: Attachment validation depth

- MIME allowlist per PDF
- Magic-byte content verification (Constitution security principles)
- Local filesystem storage path

### IC-05: Route registration order

`GET /tickets/deleted` before `GET /tickets/:ticketId` to prevent path shadowing.

### IC-06: Error response shape

```json
{ "statusCode": <number>, "message": "<string or string[]>", "error": "<short label>" }
```

### IC-07: Escalation scheduling

- Background job frequency (e.g. 1 minute)
- UTC comparison for `dueDate`
- One priority level per evaluation cycle

### IC-08: Technology stack (assignment + constitution)

- NestJS **10** (provided skeleton baseline per `package.json`); no v11 upgrade planned
- TypeScript, PostgreSQL, TypeORM, JWT
- Docker Compose for local database

### IC-09: Project delete / restore internal tracking

**Product behavior** (defined in spec BR-10/BR-11): Project delete soft-deletes project
and its non-individually-deleted tickets. Project restore restores only tickets deleted
as part of that project delete; individually deleted tickets stay deleted.

**Implementation question**: How to track which tickets were cascade-deleted with the
project (e.g. `cascadeDeletedByProject` flag, deletion batch id, or equivalent). Must
not expose new API fields.

### IC-11: DEVELOPER “in the project” — auto-assign and workload pool (plan must decide)

**Product requirements** (spec BR-07, BR-08; assignment §3.8) — not open to reinterpretation
in the spec:

- On ticket create without `assigneeId`, assign to least-loaded DEVELOPER **in the project**.
- Workload = non-DONE tickets assigned within **that same project**.
- Tie-break: oldest registration order.
- If no DEVELOPER available **in the project**, `assigneeId: null` without error.
- ADMIN excluded; auto-assign on create only.
- `GET /projects/:projectId/workload` returns users in the project with `openTicketCount`,
  sorted ascending per README.

**Planning question**: No project-membership API exists. How does the system determine
which DEVELOPERs belong to a project for auto-assign and workload?

| Candidate | Interpretation | Tradeoff |
|-----------|----------------|----------|
| A | All DEVELOPERs system-wide; workload counts scoped per project | Matches PDF “queries all DEVELOPER”; works for first ticket in new project |
| B | DEVELOPERs with ≥1 active assignment in the project | Strict “in project” by assignment; first ticket in new project may not auto-assign |
| C | Project `ownerId` (if DEVELOPER) plus current assignees in project | Narrow pool; owner may be ADMIN |
| D | Other model documented in plan without new API endpoints | Must align auto-assign and workload to same rule |

**Plan must**: Choose one interpretation, document rationale, ensure auto-assign and
workload use the **same** definition. Do not add membership APIs unless assignment scope
changes.

**Resolved in plan (2026-06-06, revised)**: Option E — internal `ProjectMember` table as
**sole source of truth**. Auto-assign and workload use linked `DEVELOPER` members only.
No bootstrap from system-wide DEVELOPERs. `assigneeId: null` when no members. Membership
created only via DEVELOPER owner or explicit `assigneeId`. See `research.md` IC-11 and `plan.md`.

---

### IC-10: Concurrent ticket and comment updates (plan must decide)

**Product requirement** (spec FR-TKT-009, FR-CMT-004): Simultaneous updates to the same
ticket or comment by multiple users MUST NOT both succeed; unsuccessful client receives
an informative error.

**README preservation**: PATCH request bodies in README examples do not include a
`version` field. Strict contract preservation favors mechanisms that do not require
PATCH body extensions.

| Option | PATCH body change | Conflict signal | Planning note |
|--------|-------------------|-----------------|---------------|
| **A — Pessimistic DB locking** | None | Second writer waits, then succeeds or fails at commit | **Preferred for strict README PATCH bodies** |
| **B — Optimistic `version` field** | Requires `version` on PATCH; additive GET field | `409` on stale version | Effective contract extension beyond README examples |
| **C — ETag / If-Match** | None (headers) | `412` / `409` | Headers not in README tables |
| **D — `updatedAt` comparison** | Requires field on PATCH | `409` on mismatch | Same body-extension concern as B |

**Plan must**: Select one option, document tradeoffs, and align tests with chosen
behavior. Do not assume Option B unless plan explicitly accepts README PATCH extension.

**Resolved in plan (2026-06-06)**: Pessimistic `SELECT … FOR UPDATE NOWAIT` → `409 Conflict`.
See `research.md` IC-10 and `plan.md`.

---

## Review History

| Date | Change |
|------|--------|
| 2026-06-05 | Initial review: concurrency options, password deferral, import defaults |
| 2026-06-05 | Refactor: implementation content moved from spec to decision log |
| 2026-06-05 | Resolved OD-01–OD-04; removed OD-05 (derived from OD-01); OD-06 → IC-09; all product decisions approved (PD-08–PD-11) |
| 2026-06-05 | Pre-plan review: PD-11 withdrawn → IC-10; auto-assign pool → IC-11 (not a product decision) |
| 2026-06-05 | PD-09 removed; assignment wording only in spec; DEVELOPER-in-project modeling → IC-11 |
| 2026-06-06 | Pre-task review: IC-11 → Option E (`ProjectMember`); stack → NestJS 11; cascade audit; validation/e2e matrix in plan.md |
| 2026-06-06 | IC-11 revised: strict `ProjectMember` source of truth, bootstrap removed; username no-whitespace rule added |
| 2026-06-06 | PD-10: user hard delete with cascade (Option 1); retain audit `performedBy`; remove comment-author delete block |
| 2026-06-06 | IC-08 baseline aligned to NestJS 10 skeleton; removed v11 upgrade from plan/research |
