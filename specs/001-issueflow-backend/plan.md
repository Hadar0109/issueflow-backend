# Implementation Plan: IssueFlow Ticket Management Backend

**Branch**: `001-issueflow-backend` | **Date**: 2026-06-06 | **Last Updated**: 2026-06-06 (IC-08 NestJS 10 skeleton baseline) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-issueflow-backend/spec.md`

**Related artifacts**: [research.md](./research.md) · [data-model.md](./data-model.md) · [contracts/](./contracts/) · [quickstart.md](./quickstart.md) · [decision-log.md](./decision-log.md)

---

## Summary

IssueFlow is a NestJS REST API for project/issue tracking covering users, authentication,
projects, tickets, comments, dependencies, attachments, CSV import/export, soft delete with
restore, @mentions, audit logging, automatic developer assignment, and priority escalation.

The implementation preserves the **README API contract exactly** — no new endpoints, renamed
fields, or PATCH body extensions. Approved product decisions PD-01–PD-10 are honored.
Planning resolves **IC-10** (concurrent updates via pessimistic `FOR UPDATE NOWAIT` → `409`)
and **IC-11** (internal `ProjectMember` as sole source of truth for DEVELOPERs “in the
project” — no bootstrap). Stack uses the provided **NestJS 10** skeleton (`package.json`).

Technical approach: modular NestJS 10 feature modules, TypeORM entities with migrations,
PostgreSQL persistence, JWT auth with token deny-list, global validation/error handling,
append-only audit logging, local filesystem attachments, and `@nestjs/schedule` for escalation.

---

## Technical Context

**Language/Version**: TypeScript 5.1+, Node.js 20 LTS

**Primary Dependencies**: NestJS 10 (`@nestjs/*` ^10.0.0), TypeORM 0.3, PostgreSQL (`pg`), class-validator,
class-transformer, @nestjs/jwt, @nestjs/passport, @nestjs/schedule, @nestjs/config, multer,
csv-parse, csv-stringify, bcrypt, file-type (magic-byte validation)

**Storage**: PostgreSQL 16 (Docker Compose); attachment files on local filesystem (`ATTACHMENTS_PATH`)

**Testing**: Jest (unit + e2e via supertest); injected clock for scheduler tests

**Target Platform**: Linux/macOS/Windows development; Node.js HTTP server (port 3000 default)

**Project Type**: Single NestJS web-service (REST API)

**Performance Goals**: Assignment-scale responsiveness; no formal SLA; scheduler runs every 1 minute

**Constraints**: README contract immutable; `synchronize: false`; secrets via env; uploads ≤10 MB;
JWT on all routes except login; soft-delete only for tickets/projects

**Scale/Scope**: ~15 README endpoint groups, 9 domain entities (incl. internal `ProjectMember`), 12 user stories, MVP scope per assignment PDF

---

## Constitution Check

*GATE: Passed before Phase 0 research. Re-checked after Phase 1 design.*

Verify compliance with `.specify/memory/constitution.md` (IssueFlow v1.1.1):

- [x] **Source of truth**: Plan traces requirements to `docs/TDP_issueflow_requirements.pdf` via `spec.md` traceability table
- [x] **API contract**: All endpoints match `README.md` tables; contracts in `contracts/openapi.yaml`; no undocumented routes
- [x] **Workflow**: Spec complete; plan derives from `spec.md`; no phase skipped
- [x] **Stack**: NestJS modules, PostgreSQL, TypeORM migrations (`synchronize: false`)
- [x] **Architecture**: Thin controllers; business rules in injectable services (see Architecture section)
- [x] **Security**: JWT global guard; env secrets; attachment MIME + magic-byte validation (IC-04)
- [x] **Validation/errors**: Global `ValidationPipe` + `HttpExceptionFilter` (IC-06)
- [x] **Audit**: Append-only `AuditLog` via cross-cutting `AuditService` (IC-02)
- [x] **Soft delete**: Ticket/project `deletedAt`; cascade tracking via `deletedWithProjectId` (IC-09)
- [x] **Testing**: Unit/integration/e2e mapped in Testing Approach and `quickstart.md`
- [x] **Documentation**: `run.md` and `prompts.md` accounted for in implementation tasks phase
- [x] **Scope**: No features beyond assignment; assumptions A-01–A-11 documented in spec

---

## Resolved Planning Decisions

### IC-10: Concurrent Updates

**Choice**: Pessimistic row lock with `SELECT … FOR UPDATE NOWAIT`.

**Rationale**: Preserves README PATCH bodies (no `version` field). Overlapping PATCH requests
on the same ticket/comment result in one `200` and one `409 Conflict` with informative message.
See [research.md § IC-10](./research.md#ic-10-concurrent-ticket-and-comment-updates).

### IC-11: DEVELOPER “In the Project”

**Choice**: **Option E — internal `ProjectMember` entity** as **sole source of truth** (no new
API endpoints, **no bootstrap**).

**Rationale**: `ProjectMember` rows define who is “in the project.” Auto-assign and workload
share the same pool: linked `DEVELOPER` members only. See [research.md § IC-11](./research.md#ic-11-developer-in-the-project-interpretation).

**Summary**:

- **Pool** (auto-assign + workload): `DEVELOPER` users with a `ProjectMember` row for the project.
- **Linkage created only by**: DEVELOPER project owner on `POST /projects`, or explicit `assigneeId` on ticket create/PATCH/import.
- **No members** → `assigneeId: null` on create (no error); workload returns `[]`.
- **No** system-wide DEVELOPER bootstrap.

### Other IC Decisions (summary)

| ID | Decision | Reference |
|----|----------|-----------|
| IC-01 | PostgreSQL JWT deny-list (`RevokedToken`) | research.md |
| IC-02 | Audit catalog + cascade ticket entries | research.md |
| IC-04 | MIME allowlist + magic bytes + local storage | research.md |
| IC-05 | Static routes before parameterized | research.md |
| IC-06 | NestJS-standard error JSON shape | contracts/error-responses.md |
| IC-07 | 1-minute UTC escalation cron | research.md |
| IC-08 | NestJS 10 (skeleton baseline) + TypeORM + PostgreSQL + JWT | research.md |
| IC-09 | `deletedWithProjectId` on Ticket | data-model.md |

### Approved Product Decisions (PD-01–PD-10)

| ID | Implementation impact |
|----|----------------------|
| PD-01 | Import: title mandatory; enum defaults in `CsvImportService` |
| PD-02 | Only ADMIN guard on soft-delete list/restore (`RolesGuard`) |
| PD-03 | No cycle detection on dependencies |
| PD-04 | `CommentsService` validates `authorId === jwt.sub` |
| PD-05 | Case-insensitive unique indexes on username/email; username no whitespace (mentions) |
| PD-06 | `MentionParserService` ignores unknown @mentions |
| PD-07 | Export query excludes `deletedAt IS NOT NULL` |
| PD-08 | Seed migration creates ADMIN; credentials in `run.md` |
| PD-09 | Login checks username existence; `POST /users` unchanged — see [PD-09 Authentication](#pd-09-authentication-mvp) |
| PD-10 | Hard delete + cascade (BR-18); audit `performedBy` retained — see [User Deletion](#user-deletion-pd-10) |

### PD-09 Authentication (MVP)

**Kept as approved** in `decision-log.md`. No API contract changes.

| Concern | Decision |
|---------|----------|
| Login body | `{ username, password }` per README; both non-empty |
| Password verification | **Not performed in MVP** — username existence suffices for `200` |
| Unknown username | `401` |
| `POST /users` | No `password` field; created users log in by username existence |
| Seeded ADMIN | `passwordHash` stored (bcrypt) for constitution; not verified in MVP |
| Documentation | `run.md` MUST state MVP login semantics explicitly for graders |

Full rationale: [research.md § PD-08/PD-09](./research.md#pd-08--pd-09-bootstrap-and-mvp-authentication).

### User Deletion (PD-10)

**Approach**: Hard delete with cascade cleanup (Option 1). Guards: BR-14 only.

**`UsersService.delete` transaction order**:

1. Assert BR-14 (not project owner; not assignee on non-DONE ticket).
2. Delete mentions on authored comments → delete authored comments.
3. Delete mentions where `userId` = deleted user.
4. Delete `project_members` for user.
5. `SET NULL` `tickets.assigneeId` where assignee = user.
6. `AuditService.log(DELETE, USER, userId, actor)` — before or after user row removal.
7. Hard-delete user.

**Audit**: `performedBy` stored as integer **without FK** to `users`; historical rows
unchanged when user deleted (FR-AUD-005). Cascade comment removal does not emit per-comment
`DELETE` audit entries.

**Auth**: `JwtAuthGuard` / strategy loads user by `sub` on each request; deleted user → `401`.

See [data-model.md § User Deletion Strategy](./data-model.md#user-deletion-strategy-pd-10--br-18).

---

## Architecture

### Layered Structure

```text
HTTP Request
    → Global Guards (JwtAuthGuard, RolesGuard where needed)
    → ValidationPipe (DTOs)
    → Controller (thin: map request → service call → response)
    → Domain Service (business rules, transactions)
    → Repository / TypeORM (persistence)
    → AuditService (side-effect: append log)
    → HttpExceptionFilter (errors)
```

### NestJS Modules

| Module | Responsibility |
|--------|----------------|
| `AppModule` | Root wiring, global providers, scheduler registration |
| `ConfigModule` | Env: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `ATTACHMENTS_PATH` |
| `DatabaseModule` | TypeORM `DataSource`, migration config |
| `CommonModule` | Shared filters, pipes, guards, decorators, transaction helper |
| `AuthModule` | Login, logout, me; JWT strategy; token revocation |
| `UsersModule` | User CRUD, mentions query, uniqueness checks |
| `ProjectsModule` | Project CRUD, soft delete/restore, workload endpoint |
| `TicketsModule` | Ticket CRUD, export/import, soft delete/restore, status rules |
| `CommentsModule` | Comment CRUD, mention parsing and persistence |
| `DependenciesModule` | Blocker relationships |
| `AttachmentsModule` | Multipart upload, file validation, storage, delete |
| `AuditModule` | Append-only logging and query |
| `SchedulerModule` | Escalation cron job |

### Cross-Cutting Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `JwtAuthGuard` | `src/common/guards/` | Global JWT enforcement (AR-01/AR-02) |
| `RolesGuard` + `@Roles('ADMIN')` | `src/common/guards/` | ADMIN-only routes (AR-03) |
| `HttpExceptionFilter` | `src/common/filters/` | IC-06 error shape |
| `ValidationPipe` | `main.ts` (global) | DTO validation, whitelist, transform |
| `AuditService` | `src/audit/` | IC-02 action catalog |
| `TransactionRunner` | `src/common/database/` | Wraps pessimistic-lock PATCH flows |

### Route Registration Order (IC-05)

Within `TicketsController` and `ProjectsController`, declare routes in this order:

1. Static paths: `/tickets/deleted`, `/tickets/export`, `POST /tickets/import`, `/projects/deleted`
2. Collection paths: `/tickets`, `/projects`
3. Parameterized paths: `/tickets/:ticketId`, `/projects/:projectId`
4. Nested static-before-param: `/tickets/:ticketId/comments` before any ambiguous patterns

---

## Services & Business Logic

### AuthModule

| Service | Responsibilities |
|---------|------------------|
| `AuthService` | Login (username exists per PD-09), issue JWT with `jti` + `sub`, logout |
| `TokenRevocationService` | Insert/check `RevokedToken`; purge expired rows |

**Authentication flow**:

1. `POST /auth/login` — public; validate DTO; find user by username (CI); if missing → `401`;
   if present → sign JWT (`expiresIn: 3600`, `tokenType: Bearer` in response).
2. Protected requests — `JwtAuthGuard` extracts Bearer token, verifies signature/exp,
   checks deny-list, attaches `user` to request.
3. `POST /auth/logout` — add current token `jti` to deny-list until `exp`.
4. `GET /auth/me` — return authenticated user (same shape as `GET /users/:userId` per A-03).

### UsersModule

| Service | Responsibilities |
|---------|------------------|
| `UsersService` | CRUD, duplicate detection, delete + cascade (BR-14, BR-18) |
| `MentionsService` | Paginated mentions query for `GET /users/:userId/mentions` |

### ProjectsModule

| Service | Responsibilities |
|---------|------------------|
| `ProjectsService` | CRUD, soft delete cascade (BR-10), restore selective (BR-11/IC-09), cascade audit |
| `ProjectMembershipService` | Create/list `ProjectMember` on explicit linkage only (IC-11) |
| `WorkloadService` | IC-11 pool = `ProjectMember` DEVELOPERs; aggregate `openTicketCount` |

**Workload query** (IC-11 — members only):

```sql
SELECT u.id, u.username,
       COUNT(t.id) FILTER (WHERE t.status != 'DONE' AND t.deleted_at IS NULL) AS open_ticket_count
FROM project_members pm
JOIN users u ON u.id = pm.user_id AND u.role = 'DEVELOPER'
LEFT JOIN tickets t ON t.assignee_id = u.id AND t.project_id = :projectId
WHERE pm.project_id = :projectId
GROUP BY u.id
ORDER BY open_ticket_count ASC, u.created_at ASC
```

**Auto-assign pool**: `ProjectMember` DEVELOPERs only. Empty pool → `assigneeId: null`.
Auto-assign does **not** create new `ProjectMember` rows (assignee already linked).

### TicketsModule

| Service | Responsibilities |
|---------|------------------|
| `TicketsService` | CRUD, soft delete/restore, orchestrates sub-services |
| `TicketStatusService` | Forward-only transitions (BR-01), DONE immutability (BR-02) |
| `TicketPatchService` | PATCH with `FOR UPDATE NOWAIT` (IC-10), priority reset (BR-05) |
| `AutoAssignService` | BR-07 on create when `assigneeId` omitted; IC-11 `ProjectMember` pool only |
| `TicketEscalationService` | BR-04/BR-06; one step per cycle (IC-07) |
| `CsvExportService` | BR-17; RFC 4180 quoting |
| `CsvImportService` | BR-16/PD-01; row-level errors |
| `OverdueCalculator` | Pure function: sets `isOverdue` on read/write |

**Ticket create flow**:

1. Validate project active, enums, optional assignee; reject ops on soft-deleted project → `404`.
2. If explicit `assigneeId` → `ProjectMembershipService.link(projectId, assigneeId)` when DEVELOPER.
3. If no `assigneeId` → `AutoAssignService.resolve(projectId)` from `ProjectMember` pool only; null if empty.
4. Persist ticket; compute `isOverdue`.
5. Audit: `CREATE` (USER) + `AUTO_ASSIGN` (SYSTEM) if assigned.

**Ticket PATCH flow** (IC-10):

1. Begin transaction.
2. `SELECT * FROM tickets WHERE id = ? FOR UPDATE NOWAIT` — on lock failure → `409`.
3. Reject if `DONE` (BR-02).
4. Validate status transition if provided (BR-01).
5. Check direct blockers if transitioning to `DONE` (BR-12/BR-13).
6. Apply fields; clear `isOverdue` on manual priority change (BR-05).
7. Commit; audit `UPDATE`.

### CommentsModule

| Service | Responsibilities |
|---------|------------------|
| `CommentsService` | CRUD; verify ticket active; `authorId` match (PD-04) |
| `MentionParserService` | Regex `@(\w+)` CI lookup; rebuild mentions (BR-15) |
| `CommentPatchService` | PATCH with `FOR UPDATE NOWAIT` (IC-10) |

### DependenciesModule

| Service | Responsibilities |
|---------|------------------|
| `DependenciesService` | Add/remove/list; same-project/self/active-ticket checks; exclude soft-deleted blockers |

### AttachmentsModule

| Service | Responsibilities |
|---------|------------------|
| `AttachmentsService` | Upload/delete metadata |
| `FileStorageService` | Write/delete files under `ATTACHMENTS_PATH` |
| `FileValidationService` | Size, MIME allowlist, magic bytes (IC-04) |

### AuditModule

| Service | Responsibilities |
|---------|------------------|
| `AuditService` | `log({ action, entityType, entityId, performedBy, actor, metadata? })` |

Invoked from domain services after successful mutations. System actions (`AUTO_ASSIGN`,
`ESCALATE`) use `actor: SYSTEM`; `performedBy` null for SYSTEM-only rows. Historical `performedBy`
user ids retained after user delete (PD-10 / FR-AUD-005).

### SchedulerModule

| Job | Schedule | Action |
|-----|----------|--------|
| `EscalationJob` | `*/1 * * * *` (every minute) | `TicketEscalationService.processOverdueTickets()` |
| `TokenCleanupJob` | `0 */6 * * *` | Remove expired `RevokedToken` rows |

---

## Repositories & Persistence

TypeORM entities per [data-model.md](./data-model.md). Custom repository/query helpers:

| Repository / Query | Purpose |
|--------------------|---------|
| `UsersRepository` | CI uniqueness lookups |
| `TicketsRepository` | Soft-delete scoping, `FOR UPDATE NOWAIT` fetch |
| `ProjectMemberRepository` | Membership upsert/list |
| `WorkloadRepository` | IC-11 aggregation over members |
| `AuditLogRepository` | Filtered paginated queries |
| `RevokedTokenRepository` | Deny-list check by `jti` |

**Migrations** (in `src/database/migrations/`):

1. `InitialSchema` — enums, tables, indexes
2. `SeedAdminUser` — PD-08 ADMIN with bcrypt password hash

**Soft-delete convention**: Global `WHERE deleted_at IS NULL` in standard queries via
repository base or explicit query conditions. ADMIN deleted-list endpoints invert filter.

**Project cascade** (IC-09): On project delete, `UPDATE tickets SET deleted_at = now(), deleted_with_project_id = :projectId WHERE project_id = :id AND deleted_at IS NULL`. Individual ticket delete sets only `deleted_at`.

**User deletion**: See [User Deletion (PD-10)](#user-deletion-pd-10) and [data-model.md](./data-model.md#user-deletion-strategy-pd-10--br-18).

---

## Validation Strategy

### Boundary Validation (DTOs + class-validator)

- Global `ValidationPipe`: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- One DTO per request body; enums via `@IsEnum`
- Param parsing via `ParseIntPipe`

### Domain Validation (services)

| Rule | Service | Error |
|------|---------|-------|
| Status transitions forward-only | `TicketStatusService` | `400` |
| DONE ticket immutable | `TicketStatusService` | `400` |
| DONE + unresolved direct blockers | `TicketStatusService` | `400` |
| PATCH ticket: reject `type` field | `TicketPatchService` | `400` |
| PATCH ticket: allowed fields only per README | `TicketPatchService` | `400` |
| Create/PATCH ticket on soft-deleted project | `TicketsService` | `404` |
| `projectId` / import target project active | `TicketsService` / `CsvImportService` | `404` |
| `ownerId` references existing user | `ProjectsService` | `400` |
| User create: `username` no whitespace (single token) | `UsersService` | `400` |
| User update: ≥1 of `fullName`, `role` | `UsersService` | `400` |
| authorId === JWT | `CommentsService` | `400` |
| Comment/attachment on soft-deleted ticket | `CommentsService` / `AttachmentsService` | `404` |
| User delete guard (owner, non-DONE assignee) | `UsersService` | `409` |
| Dependency: same project, not self, **both active** | `DependenciesService` | `400` |
| Import row defaults/errors | `CsvImportService` | row-level |
| Attachment size/type/content | `FileValidationService` | `400` |
| Login: non-empty username + password | `AuthService` | `401` |
| Unknown username on login | `AuthService` | `401` |
| Duplicate username/email (CI) | `UsersService` | `409` |

Invalid domain state → throw `BadRequestException`, `ConflictException`, or `NotFoundException`;
filter maps to IC-06 shape.

---

## Background Jobs

| Job | Module | Behavior |
|-----|--------|----------|
| Priority escalation | `SchedulerModule` | Scan non-DONE tickets with `dueDate < UTC now()`; escalate one priority step unless CRITICAL (then set `isOverdue`); audit `ESCALATE` |
| Token cleanup | `AuthModule` | Delete `RevokedToken` where `expiresAt < now()` |

Escalation does not change `status` (FR-ESC-004). DONE tickets skipped (BR-03).

---

## Audit Logging

Append-only `audit_logs` table. Every state-changing operation in IC-02 catalog calls
`AuditService.log`. Query via `GET /audit-logs` with optional filters (`entityType`, `entityId`,
`action`, `actor`). No update/delete of audit records.

**`performedBy` mapping (PD-10)**: Store as a plain nullable integer column — **no** `@ManyToOne`
to `User`, **no** DB foreign key, **no** `ON DELETE` behavior. Historical ids are retained after
user hard-delete (FR-AUD-005). API consumers must not assume `GET /users/:performedBy` succeeds.

### IC-02 catalog (base + cascade extension)

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

**Cascade extension** (PDF §3.1):

- `DELETE /projects/:id` → `SOFT_DELETE` `PROJECT` + one `SOFT_DELETE` `TICKET` per
  cascade-affected ticket (`metadata: { cascade: true, projectId }`).
- `POST /projects/:id/restore` → `RESTORE` `PROJECT` + one `RESTORE` `TICKET` per ticket
  restored via `deletedWithProjectId`.

LOGIN is not audited (no persistent domain state change).

---

## File Storage

- Path: `{ATTACHMENTS_PATH}/tickets/{ticketId}/{uuid}-{sanitizedOriginalName}`
- `storage/` directory gitignored; created on startup if missing
- Delete attachment: remove DB row and filesystem object in same transaction where possible
- No download endpoint (out of scope per spec)

---

## Testing Approach

### Unit Tests (`src/**/*.spec.ts`)

| Area | Examples |
|------|----------|
| `TicketStatusService` | Forward/backward transitions, DONE immutability |
| `AutoAssignService` | IC-11 member pool only, tie-break, null when no members |
| `ProjectMembershipService` | Link on DEVELOPER owner or explicit assigneeId only |
| `MentionParserService` | CI match, unknown ignored; re-eval on PATCH |
| `CsvImportService` | BR-16 defaults, invalid enum row, header-only CSV |
| `TicketEscalationService` | One-step ladder, CRITICAL + isOverdue idempotent (mocked clock) |
| `FileValidationService` | MIME spoof rejection |
| `UsersService` | BR-14 guards; BR-18 cascade; username whitespace rejection |

### Integration Tests

- Repository queries: soft-delete scoping, `ProjectMember` workload aggregation, cascade restore
- Transaction + `FOR UPDATE NOWAIT` conflict detection against real PostgreSQL
- Cascade audit: project delete emits per-ticket `SOFT_DELETE` entries
- User delete cascade (comments, mentions, members, assignee null)
- Audit `performedBy` retained after user delete

### E2E Test Files

| File | Focus |
|------|-------|
| `test/contract.e2e-spec.ts` | README endpoint sweep (matrix below) — min. one happy path per route |
| `test/auth.e2e-spec.ts` | Login/logout/me, 401 invalid JWT, 401 unknown username |
| `test/users.e2e-spec.ts` | User CRUD, update, delete cascade (BR-18), BR-14 409, audit performedBy retained |
| `test/projects.e2e-spec.ts` | Project CRUD, cascade delete/restore, workload, deleted list |
| `test/tickets.e2e-spec.ts` | Ticket lifecycle, GET by id, restore, edge cases |
| `test/concurrency.e2e-spec.ts` | IC-10 ticket + comment concurrent PATCH |
| `test/comments.e2e-spec.ts` | Comments CRUD, mentions, re-eval on PATCH, soft-deleted ticket 404 |
| `test/dependencies.e2e-spec.ts` | Add/list/remove, circular allowed, DONE blocked |
| `test/attachments.e2e-spec.ts` | Upload/delete, soft-deleted ticket 404 |
| `test/import-export.e2e-spec.ts` | CSV round-trip, partial import, empty export |
| `test/audit.e2e-spec.ts` | Filters, cascade audit, SYSTEM actor, performedBy after user delete |
| `test/escalation.e2e-spec.ts` | Scheduler with injected clock |
| `test/helpers/` | Auth helpers, fixtures, test data builders |

### README Endpoint → E2E Coverage Matrix

| # | Method | Endpoint | E2E file | Min coverage |
|---|--------|----------|----------|--------------|
| 1 | POST | `/auth/login` | auth | 200 valid; 401 unknown user; 401 empty fields |
| 2 | POST | `/auth/logout` | auth | 200; token invalidated |
| 3 | GET | `/auth/me` | auth | 200 profile shape |
| 4 | GET | `/users` | users | 200 list |
| 5 | GET | `/users/:userId` | users | 200; 404 |
| 6 | POST | `/users` | users | 200; 400 username with whitespace; 409 duplicate username/email |
| 7 | POST | `/users/update/:userId` | users | 200; 400 empty body |
| 8 | DELETE | `/users/:userId` | users | 200 cascade (BR-18); 409 BR-14; audit performedBy retained |
| 9 | GET | `/users/:userId/mentions` | comments | 200 paginated; newest first |
| 10 | GET | `/projects` | projects | 200 list |
| 11 | GET | `/projects/:projectId` | projects | 200; 404 soft-deleted |
| 12 | POST | `/projects` | projects | 200; upserts DEVELOPER owner member |
| 13 | PATCH | `/projects/:projectId` | projects | 200 |
| 14 | DELETE | `/projects/:projectId` | projects | 200 cascade; per-ticket audit |
| 15 | GET | `/projects/deleted` | projects | 403 DEVELOPER; 200 ADMIN |
| 16 | POST | `/projects/:projectId/restore` | projects | 200 ADMIN; selective ticket restore |
| 17 | GET | `/projects/:projectId/workload` | projects | 200 members only, sorted |
| 18 | GET | `/tickets?projectId=` | tickets | 200; excludes soft-deleted |
| 19 | GET | `/tickets/:ticketId` | tickets | 200; 404 soft-deleted |
| 20 | POST | `/tickets` | tickets | 200; auto-assign from members; null if no members; explicit assignee links member |
| 21 | PATCH | `/tickets/:ticketId` | tickets | 200; 400 DONE/backward; rejects `type` |
| 22 | DELETE | `/tickets/:ticketId` | tickets | 200 |
| 23 | GET | `/tickets/export?projectId=` | import-export | 200 CSV; empty project header only |
| 24 | POST | `/tickets/import` | import-export | 200 partial; header-only CSV |
| 25 | GET | `/tickets/deleted?projectId=` | tickets | 403; 200 ADMIN |
| 26 | POST | `/tickets/:ticketId/restore` | tickets | 200 ADMIN |
| 27 | GET | `/tickets/:ticketId/comments` | comments | 200; 404 soft-deleted ticket |
| 28 | POST | `/tickets/:ticketId/comments` | comments | 200; 400 authorId mismatch |
| 29 | PATCH | `/tickets/:ticketId/comments/:commentId` | concurrency | 200; 409 concurrent |
| 30 | DELETE | `/tickets/:ticketId/comments/:commentId` | comments | 200 |
| 31 | GET | `/audit-logs` | audit | 200; filters |
| 32 | POST | `/tickets/:ticketId/dependencies` | dependencies | 200; 400 self/cross-project/inactive |
| 33 | GET | `/tickets/:ticketId/dependencies` | dependencies | 200; excludes soft-deleted blocker |
| 34 | DELETE | `/tickets/:ticketId/dependencies/:blockerId` | dependencies | 200 |
| 35 | POST | `/tickets/:ticketId/attachments` | attachments | 200; 400 size/type; 404 deleted ticket |
| 36 | DELETE | `/tickets/:ticketId/attachments/:attachmentId` | attachments | 200 |

### Spec Edge Cases → E2E mapping

| # | Edge case | E2E file |
|---|-----------|----------|
| 1 | Ticket create on soft-deleted project → 404 | tickets |
| 2 | Restore ticket while project deleted | tickets |
| 3 | User delete blocked (BR-14) | users |
| 4 | User delete with comments cascade (BR-18) | users, comments |
| 5–7 | Mentions/audit/JWT after user delete | users, audit, auth |
| 8–12 | Re-register, assignee null, members, import | users, tickets, import-export |
| 13 | Manual assignee any existing user | tickets |
| 14 | Auto-assign null (no ProjectMembers) | tickets |
| 15 | Tie-break oldest registration | projects |
| 16 | CRITICAL + overdue idempotent | escalation |
| 17 | Import header-only CSV | import-export |
| 18 | Import duplicate titles allowed | import-export |
| 19 | Circular dependencies; DONE checks direct blockers | dependencies |
| 20 | Export empty project → header only | import-export |
| 21 | Priority PATCH clears `isOverdue` | escalation |
| 22 | Concurrent ticket/comment edits | concurrency |
| 23 | Import blank title → row error | import-export |
| 24 | Comments/attachments on soft-deleted ticket → 404 | comments, attachments |
| 25 | Seeded ADMIN delete blocked (BR-14) | users |
| — | Explicit assignee on create skips auto-assign | tickets |
| — | Auto-assign not on PATCH | tickets |
| — | Comment PATCH re-evaluates mentions | comments |
| — | Project cascade audit per ticket | audit |

### Test Infrastructure

- E2E setup: spin up test DB, run migrations, seed users
- `jest-e2e.json` configured; helper for authenticated requests (ADMIN + DEVELOPER tokens)
- Injectable `Clock` interface for time-dependent tests

---

## Project Structure

### Documentation (this feature)

```text
specs/001-issueflow-backend/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities
├── quickstart.md        # Phase 1 validation scenarios
├── contracts/           # Phase 1 API contracts (README-aligned)
│   ├── README.md
│   ├── openapi.yaml
│   └── error-responses.md
├── decision-log.md      # PD-* and IC-* source
├── spec.md              # Requirements source of truth
└── tasks.md             # Phase 2 (/speckit-tasks — not yet created)
```

### Source Code (repository root)

```text
src/
├── main.ts
├── app.module.ts
├── common/
│   ├── decorators/          # @Roles(), @CurrentUser()
│   ├── filters/             # HttpExceptionFilter
│   ├── guards/              # JwtAuthGuard, RolesGuard
│   ├── pipes/               # Optional custom pipes
│   ├── database/            # TransactionRunner
│   └── utils/               # Clock, sanitize filename
├── config/
│   └── configuration.ts
├── database/
│   ├── data-source.ts
│   └── migrations/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── token-revocation.service.ts
│   ├── jwt.strategy.ts
│   └── dto/
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── mentions.service.ts
│   ├── entities/user.entity.ts
│   └── dto/
├── projects/
│   ├── projects.module.ts
│   ├── projects.controller.ts
│   ├── projects.service.ts
│   ├── workload.service.ts
│   ├── project-membership.service.ts
│   ├── entities/project.entity.ts, project-member.entity.ts
│   └── dto/
├── tickets/
│   ├── tickets.module.ts
│   ├── tickets.controller.ts
│   ├── tickets.service.ts
│   ├── ticket-status.service.ts
│   ├── ticket-patch.service.ts
│   ├── auto-assign.service.ts
│   ├── ticket-escalation.service.ts
│   ├── csv-export.service.ts
│   ├── csv-import.service.ts
│   ├── entities/ticket.entity.ts
│   └── dto/
├── comments/
│   ├── comments.module.ts
│   ├── comments.controller.ts
│   ├── comments.service.ts
│   ├── comment-patch.service.ts
│   ├── mention-parser.service.ts
│   ├── entities/comment.entity.ts, mention.entity.ts
│   └── dto/
├── dependencies/
│   ├── dependencies.module.ts
│   ├── dependencies.controller.ts
│   ├── dependencies.service.ts
│   └── entities/ticket-dependency.entity.ts
├── attachments/
│   ├── attachments.module.ts
│   ├── attachments.controller.ts
│   ├── attachments.service.ts
│   ├── file-storage.service.ts
│   ├── file-validation.service.ts
│   └── entities/attachment.entity.ts
├── audit/
│   ├── audit.module.ts
│   ├── audit.controller.ts
│   ├── audit.service.ts
│   └── entities/audit-log.entity.ts
└── scheduler/
    ├── scheduler.module.ts
    └── escalation.job.ts

test/
├── contract.e2e-spec.ts     # README endpoint sweep
├── auth.e2e-spec.ts
├── users.e2e-spec.ts
├── projects.e2e-spec.ts
├── tickets.e2e-spec.ts
├── comments.e2e-spec.ts
├── dependencies.e2e-spec.ts
├── attachments.e2e-spec.ts
├── concurrency.e2e-spec.ts
├── import-export.e2e-spec.ts
├── audit.e2e-spec.ts
├── escalation.e2e-spec.ts
└── helpers/                 # Test auth helpers, fixtures

storage/attachments/         # Gitignored upload root
```

**Structure Decision**: Single NestJS project at repository root (matches existing skeleton).
Feature modules map 1:1 to README API groups. Tests split unit (`src/`) and e2e (`test/`).

---

## Risks, Assumptions & Tradeoffs

### Risks

| Risk | Mitigation |
|------|------------|
| `FOR UPDATE NOWAIT` under high contention returns many 409s | Acceptable for assignment scale; clients retry |
| MVP login without password verification (PD-09) | Approved PD-09; seed ADMIN hashed; document in `run.md` |
| Scheduler timing flaky in e2e | Injectable `Clock`; unit test escalation logic |
| File upload attacks | IC-04 three-layer validation; store outside web root |
| Route shadowing | IC-05 explicit registration order + e2e route tests |

### Assumptions (from spec A-01–A-11)

Plan depends on camelCase JSON, `200 OK` success codes, `GET /auth/me` ≡ user profile shape,
mention notification via persistence only, no extra role gates, circular deps allowed,
PD-10 user delete cascade, username no-whitespace (A-11).
No new assumptions introduced beyond spec A-01–A-11.

### Tradeoffs

| Choice | Benefit | Cost |
|--------|---------|------|
| IC-10 NOWAIT vs optimistic version | README PATCH unchanged | Concurrent edits fail rather than merge; client must retry |
| IC-11 ProjectMember strict linkage | Explicit “in project” semantics; null without members | First ticket unassigned until DEVELOPER linked |
| Deny-list vs stateless JWT | True logout | Extra DB read per request |
| Local file storage vs S3 | Simplicity | Not production-scalable for large files |

---

## Complexity Tracking

| Violation / addition | Why needed | Simpler alternative rejected because |
|----------------------|------------|--------------------------------------|
| `ProjectMember` internal entity | IC-11 sole source of truth without membership APIs | Option A breaks “linked/in project”; bootstrap removed per correction |

Repository helpers and transaction wrapper justified by IC-10 and IC-11 query complexity.

---

## Implementation Phases (for `/speckit-tasks`)

Suggested task generation order:

1. **Foundation** — NestJS 10 skeleton setup, TypeORM, migrations, seed, global guards/filters/pipes, audit service
2. **US1–US2** — Auth + Users (P1)
3. **US3–US4** — Projects + Tickets core lifecycle (P1)
4. **US5–US8** — Comments, dependencies, attachments, CSV (P2)
5. **US9–US10** — Soft delete admin + audit query (P2)
6. **US11–US12** — Auto-assign, workload, escalation scheduler (P3)
7. **Documentation** — `run.md`, `prompts.md` updates
8. **Hardening** — Concurrency e2e, coverage gaps

---

## Post-Design Constitution Re-Check

All gates remain **passed** after Phase 1 design. API contract preserved in `contracts/`.
Data model supports all business rules without exposing internal fields. Testing approach
covers SC-001 through SC-007 from spec.

**Ready for**: `/speckit-tasks` to generate dependency-ordered `tasks.md`.
