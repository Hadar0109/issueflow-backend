# Feature Specification: IssueFlow Ticket Management Backend

**Feature Branch**: `001-issueflow-backend`  
**Created**: 2026-06-05  
**Last Reviewed**: 2026-06-06  
**Status**: Requirements (behavior-focused)  
**Input**: TDP 2026 assignment (`docs/TDP_issueflow_requirements.pdf`), README API contract,
Constitution v1.1.1.

**Related artifact**: Implementation alternatives and open decisions → [`decision-log.md`](decision-log.md)

---

## Source of Truth Precedence

When documents conflict, resolve in this order (highest first):

1. **Assignment PDF** (`docs/TDP_issueflow_requirements.pdf`) — behavioral requirements
2. **README API contract** (`README.md`) — HTTP paths, bodies, status codes
3. **Constitution** (`.specify/memory/constitution.md`) — project principles
4. **This specification** — consolidated requirements and product rules
5. **Implementation plan** (`plan.md`) — technical design (created during `/speckit-plan`)

This specification MUST NOT override higher-priority sources. Where README and PDF
diverge on HTTP shape, README governs the contract; PDF governs behavior. Gaps MUST be
recorded as open product decisions in `decision-log.md` and resolved during planning —
not by redesigning the API.

---

## Scope

IssueFlow is a RESTful backend for project and issue tracking: users, projects, tickets,
comments, audit logging, dependencies, attachments, CSV import/export, soft delete with
restore, @mentions, automatic priority escalation, and automatic developer assignment.

**In scope**: All README endpoints; all assignment behavioral rules; validation; informative
errors; persistence of domain data; tests for key behaviors; `run.md` and `prompts.md`.

**Out of scope**: Frontend; external notification delivery; project membership APIs not in
assignment; hard delete for tickets/projects; attachment download endpoints; endpoints not
in README.

**Contract preservation**: Endpoint paths, documented request/response bodies, and
documented success status codes MUST match README. JSON field names use camelCase per
README examples.

---

## User Scenarios & Testing

### User Story 1 — Authenticated API Access (Priority: P1)

As an API client, I authenticate with username and password and access protected
endpoints with a JWT.

**Acceptance Scenarios**:

1. **Given** valid credentials, **When** `POST /auth/login`, **Then** `200` with
   `{ accessToken, tokenType: "Bearer", expiresIn: 3600 }`.
2. **Given** valid JWT, **When** calling a protected endpoint with valid input, **Then**
   success per README.
3. **Given** missing or invalid JWT, **When** calling a protected endpoint, **Then**
   `401 Unauthorized`.
4. **Given** valid JWT, **When** `POST /auth/logout`, **Then** `200` and that token no
   longer grants access.
5. **Given** valid JWT, **When** `GET /auth/me`, **Then** `200` with authenticated user
   profile.

---

### User Story 2 — User Registry (Priority: P1)

As an administrator, I register and manage users for assignments and comments.

**Acceptance Scenarios**:

1. **Given** valid data per README, **When** `POST /users`, **Then** `200` with
   `id`, `username`, `email`, `fullName`, `role`.
2. **Given** users exist, **When** `GET /users` or `GET /users/:userId`, **Then** `200`
   or `404` as appropriate.
3. **Given** a user, **When** `POST /users/update/:userId` with `fullName` and/or `role`,
   **Then** `200` on success.
4. **Given** a user who owns a project or is assignee on a non-DONE ticket, **When**
   `DELETE /users/:userId`, **Then** `409` and user not deleted.
5. **Given** no BR-14 blocking references, **When** `DELETE /users/:userId`, **Then** `200`
   and user is hard-deleted (PD-10).
6. **Given** a user who authored comments but passes BR-14, **When** `DELETE /users/:userId`,
   **Then** `200`; authored comments and their mention rows are removed; mention rows where
   the user was mentioned on others' comments are removed (PD-10 / BR-18).
7. **Given** a deleted user, **When** `GET /users/:userId` or `GET /users/:userId/mentions`,
   **Then** `404`.
8. **Given** audit log entries where `performedBy` references a deleted user, **When**
   `GET /audit-logs`, **Then** `performedBy` retains the original numeric user id (PD-10).

---

### User Story 3 — Project Management (Priority: P1)

As a project owner, I manage projects as containers for tickets.

**Acceptance Scenarios**:

1. **Given** valid `name`, `description`, `ownerId`, **When** `POST /projects`,
   **Then** `200` with project per README.
2. **Given** active projects, **When** `GET /projects` or `GET /projects/:projectId`,
   **Then** `200`; soft-deleted projects not included.
3. **Given** a project, **When** `PATCH /projects/:projectId`, **Then** `200`.
4. **Given** a project with tickets, **When** `DELETE /projects/:projectId`, **Then**
   `200`; project and its non-individually-deleted tickets become soft-deleted and hidden
   from standard APIs.
5. **Given** ADMIN, **When** `GET /projects/deleted` or `POST /projects/:id/restore`,
   **Then** per README; restore also restores tickets deleted as part of that project
   delete, not tickets individually deleted earlier.

---

### User Story 4 — Ticket Lifecycle (Priority: P1)

As a team member, I manage tickets through a forward-only status lifecycle.

**Acceptance Scenarios**:

1. **Given** valid ticket data, **When** `POST /tickets`, **Then** `200` per README
   including `dueDate` and `isOverdue` when applicable.
2. **Given** `projectId`, **When** `GET /tickets?projectId=`, **Then** `200` with active
   tickets for that project only.
3. **Given** a ticket, **When** `GET /tickets/:ticketId`, **Then** `200` or `404` if
   soft-deleted.
4. **Given** non-DONE ticket, **When** `PATCH` with valid forward status, **Then** `200`.
5. **Given** DONE ticket, **When** `PATCH`, **Then** `400`.
6. **Given** backward status transition, **When** `PATCH`, **Then** `400`.
7. **Given** two users update the same ticket at the same time, **When** both submit,
   **Then** only one update succeeds; the other receives an informative error indicating
   concurrent modification (see FR-TKT-009).
8. **Given** a ticket, **When** `DELETE /tickets/:ticketId`, **Then** `200`; hidden from
   standard APIs.

---

### User Story 5 — Comments and Mentions (Priority: P2)

As a team member, I comment on tickets and @mention users.

**Acceptance Scenarios**:

1. **Given** active ticket, **When** `POST /tickets/:ticketId/comments`, **Then** `200`
   with `mentionedUsers` per README.
2. **Given** `@username` matching a user (case-insensitive), **When** comment saved,
   **Then** user in `mentionedUsers`.
3. **Given** `@unknown`, **When** comment saved, **Then** `200`; unknown mention ignored.
4. **Given** comment update, **When** content changes, **Then** mentions re-evaluated.
5. **Given** user id, **When** `GET /users/:userId/mentions`, **Then** `200` with paginated
   results, newest first.
6. **Given** soft-deleted ticket, **When** comment operations, **Then** `404`.

---

### User Story 6 — Ticket Dependencies (Priority: P2)

As a team member, I declare blockers so tickets cannot complete while dependencies are open.

**Acceptance Scenarios**:

1. **Given** two tickets in same project, **When**
   `POST /tickets/:ticketId/dependencies` with `{ blockedBy }`, **Then** `200`.
2. **Given** self-dependency or cross-project pair, **When** POST, **Then** `400`.
3. **Given** dependencies, **When** `GET /tickets/:ticketId/dependencies`, **Then** `200`
   with blocker summary per README.
4. **Given** direct blocker not DONE, **When** PATCH status to DONE, **Then** `400`.
5. **Given** soft-deleted blocker, **When** list or DONE transition, **Then** blocker does
   not block.

---

### User Story 7 — Attachments (Priority: P2)

As a team member, I attach files within assignment limits.

**Acceptance Scenarios**:

1. **Given** valid file (≤10 MB, allowed type), **When** upload, **Then** `200` per README.
2. **Given** oversize or disallowed type, **When** upload, **Then** `400`.
3. **Given** attachment, **When** delete, **Then** `200`; attachment no longer retrievable.
4. **Given** soft-deleted ticket, **When** upload, **Then** `404`.

---

### User Story 8 — Export and Import (Priority: P2)

As a team member, I export and import tickets via CSV.

**Acceptance Scenarios**:

1. **Given** project tickets, **When** `GET /tickets/export?projectId=`, **Then** `200`
   CSV with documented columns; soft-deleted excluded.
2. **Given** CSV and `projectId`, **When** `POST /tickets/import`, **Then** `200` with
   `{ created, failed, errors }`.
3. **Given** row with invalid enum, **When** import, **Then** row fails; valid rows still
   created.
4. **Given** commas/quotes in values, **When** export/import, **Then** correct handling.

---

### User Story 9 — Soft Delete and Restore (Priority: P2)

As an ADMIN, I list and restore soft-deleted records.

**Acceptance Scenarios**:

1. **Given** non-ADMIN, **When** deleted-list or restore endpoints, **Then** `403`.
2. **Given** ADMIN, **When** `GET /tickets/deleted` or restore ticket, **Then** per README.
3. **Given** ADMIN, **When** `GET /projects/deleted` or restore project, **Then** per README.

---

### User Story 10 — Audit Log (Priority: P2)

As an auditor, I query a history of state-changing actions.

**Acceptance Scenarios**:

1. **Given** successful state-changing operation, **When** `GET /audit-logs`, **Then**
   retrievable entry with `action`, `entityType`, `entityId`, `performedBy`, `actor`,
   `timestamp` per README.
2. **Given** system-initiated change (auto-assign, escalation), **When** query
   `actor=SYSTEM`, **Then** distinguishable from user actions.
3. **Given** filter params, **When** `GET /audit-logs`, **Then** filtered results.

---

### User Story 11 — Auto-Assignment and Workload (Priority: P3)

As a team lead, I have unassigned tickets auto-assigned to the least-loaded DEVELOPER
in the project and can view workload.

**Acceptance Scenarios**:

1. **Given** ticket create without `assigneeId`, **When** `POST /tickets`, **Then**
   `assigneeId` set to least-loaded DEVELOPER in the project per assignment §3.8, or
   `null` if no DEVELOPER is available in the project without error.
2. **Given** explicit `assigneeId` on create, **When** `POST /tickets`, **Then** no
   auto-assign.
3. **Given** project, **When** `GET /projects/:projectId/workload`, **Then** `200` per
   README sorted by `openTicketCount` ascending.
4. **Given** ticket PATCH, **When** assignee changed, **Then** auto-assign not re-triggered.
5. **Given** auto-assign occurs, **When** audit queried, **Then** auditable system action.

---

### User Story 12 — Auto-Escalation (Priority: P3)

As a team lead, overdue tickets escalate in priority automatically.

**Acceptance Scenarios**:

1. **Given** overdue non-DONE ticket below CRITICAL, **When** escalation runs, **Then**
   priority increases one level.
2. **Given** CRITICAL and still overdue, **When** escalation runs, **Then** `isOverdue: true`;
   priority not increased further.
3. **Given** user changes priority via PATCH, **When** success, **Then** `isOverdue` cleared.
4. **Given** DONE ticket, **When** escalation runs, **Then** no change.
5. **Given** ticket with `dueDate`, **When** any GET ticket response, **Then** `isOverdue`
   present.

---

## Functional Requirements

### Authentication

- **FR-AUTH-001**: Expose `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` per README.
- **FR-AUTH-002**: Login accepts `username` and `password`; returns JWT per README.
- **FR-AUTH-003**: All endpoints except login require valid JWT (PDF §2.2).
- **FR-AUTH-004**: Logout invalidates the current token per PDF §2.2.
- **FR-AUTH-005**: `GET /auth/me` returns the authenticated user's profile.

### Users

- **FR-USER-001**: Support user endpoints per README.
- **FR-USER-002**: Role MUST be `ADMIN` or `DEVELOPER`.
- **FR-USER-003**: Registration accepts README fields: `username`, `email`, `fullName`, `role`.
- **FR-USER-004**: Update allows `fullName` and `role` only.
- **FR-USER-005**: Delete hard-removes user when permitted (BR-14); cascade per BR-18 / PD-10.
- **FR-USER-006**: `GET /users` and `GET /users/:userId` exclude deleted users (`404` by id).

### Projects

- **FR-PROJ-001**: Support project endpoints per README including soft delete.
- **FR-PROJ-002**: Project has `name`, `description`, `ownerId` (existing user).
- **FR-PROJ-003**: Soft-deleted projects hidden from standard project APIs.
- **FR-PROJ-004**: Project delete soft-deletes associated active tickets (see BR-10).
- **FR-PROJ-005**: Project restore restores tickets deleted with the project, not
  individually deleted tickets (see BR-11).

### Tickets

- **FR-TKT-001**: Support ticket endpoints per README including export, import, restore.
- **FR-TKT-002**: Each ticket belongs to exactly one project.
- **FR-TKT-003**: Fields per README including optional `dueDate`, `isOverdue` in responses.
- **FR-TKT-004**: Status enum: `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`.
- **FR-TKT-005**: Priority enum: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- **FR-TKT-006**: Type enum: `BUG`, `FEATURE`, `TECHNICAL`.
- **FR-TKT-007**: DONE tickets cannot be updated (PDF §2.4).
- **FR-TKT-008**: Status transitions forward-only (PDF §2.4).
- **FR-TKT-009**: Simultaneous updates to the same ticket by multiple users MUST NOT both
  succeed; the unsuccessful client MUST receive an informative error.
- **FR-TKT-010**: DONE transition blocked when direct blocker dependencies are unresolved.
- **FR-TKT-011**: `assigneeId`, when provided, MUST reference an existing user.
- **FR-TKT-012**: When `assigneeId` omitted on create, auto-assign per assignment §3.8.

### Comments

- **FR-CMT-001**: Support comment endpoints per README.
- **FR-CMT-002**: `authorId` MUST match authenticated user.
- **FR-CMT-003**: Responses include `mentionedUsers` per README.
- **FR-CMT-004**: Simultaneous edits to the same comment by multiple users MUST NOT both
  succeed; the unsuccessful client MUST receive an informative error.
- **FR-CMT-005**: Comment delete removes the comment.

### Dependencies

- **FR-DEP-001**: Support dependency endpoints per README.
- **FR-DEP-002**: `{ blockedBy }` means ticket is blocked by that ticket.
- **FR-DEP-003**: Both tickets MUST exist, same project, active at creation.
- **FR-DEP-004**: Self-dependency rejected.

### Attachments

- **FR-ATT-001**: Upload/delete per README; field name `file`.
- **FR-ATT-002**: Max 10 MB; types: `image/png`, `image/jpeg`, `application/pdf`,
  `text/plain` (PDF §3.3).
- **FR-ATT-003**: Reject disallowed uploads with informative error.

### Export / Import

- **FR-CSV-001**: Export active project tickets as CSV per README columns.
- **FR-CSV-002**: Import via multipart `file` + `projectId`; return summary per README.
- **FR-CSV-003**: Row-level processing; partial success allowed.
- **FR-CSV-004**: CSV MUST handle commas and quotes in values (PDF §3.4).

### Soft Delete / Restore

- **FR-SD-001**: Deleted-list and restore endpoints ADMIN-only (PDF §3.5).
- **FR-SD-002**: Tickets and projects soft-deleted only via API.

### Mentions

- **FR-MEN-001**: `GET /users/:userId/mentions` per README with optional pagination.
- **FR-MEN-002**: Case-insensitive `@username` matching (PDF §3.6).
- **FR-MEN-003**: Mention associations persisted and retrievable; notification satisfied
  by persistence and mentions API (no external delivery required).

### Workload

- **FR-WL-001**: `GET /projects/:projectId/workload` per README.

### Audit Log

- **FR-AUD-001**: Persistent append-only record of state-changing actions (PDF §3.1).
- **FR-AUD-002**: `GET /audit-logs` with optional filters per README.
- **FR-AUD-003**: User-initiated and system-initiated actions MUST be distinguishable
  (`actor`: `USER` vs `SYSTEM` per README example).
- **FR-AUD-004**: Auto-assign and escalation MUST be auditable as system actions.
- **FR-AUD-005**: `performedBy` on historical audit rows MUST retain the original user id
  after that user is hard-deleted (PD-10); no FK cascade that nulls or removes audit attribution.

### Auto-Escalation

- **FR-ESC-001**: Overdue tickets with `dueDate` escalate per PDF §3.7.
- **FR-ESC-002**: One priority level per escalation step until CRITICAL; then `isOverdue`.
- **FR-ESC-003**: Manual priority change resets `isOverdue` per PDF §3.7.
- **FR-ESC-004**: Escalation does not change `status`.

---

## Business Rules

### BR-01: Ticket Status Lifecycle

Forward only: `TODO → IN_PROGRESS → IN_REVIEW → DONE`. No backward transitions.

### BR-02: DONE Immutability

Tickets in `DONE` cannot be updated.

### BR-03: DONE with dueDate

When ticket reaches DONE, `dueDate`, `priority`, and `isOverdue` remain unchanged;
escalation stops.

### BR-04: Priority Escalation Ladder

Overdue unresolved tickets: `LOW → MEDIUM → HIGH → CRITICAL` (one step per escalation
evaluation). At CRITICAL + overdue: set `isOverdue: true`; no further priority increase.

### BR-05: Manual Priority Reset

User priority change via PATCH clears `isOverdue`; next escalation re-evaluates from new
priority.

### BR-06: Overdue Definition

Ticket is overdue when `dueDate` is set and current time is past `dueDate`.

### BR-07: Auto-Assignment (assignment §3.8)

- On create only when `assigneeId` not provided.
- Assign to least-loaded DEVELOPER **in the project**.
- Workload = count of non-DONE tickets assigned to the user within the same project.
- Tie-break: oldest user registration order.
- `ADMIN` users excluded from auto-assignment.
- If no DEVELOPER is available in the project: `assigneeId: null`, no error.
- Auto-assign not triggered on ticket update.
- Auto-assign auditable as system action.

### BR-08: Workload Listing

`GET /projects/:projectId/workload` returns DEVELOPERs **in the project** with
`openTicketCount` (non-DONE assigned tickets in that project), sorted ascending per README.

### BR-09: Soft Delete Visibility

Soft-deleted records hidden from standard APIs; ADMIN endpoints access deleted records.

### BR-10: Project Delete Effect

Deleting a project soft-deletes the project and its tickets that were not already
individually soft-deleted.

### BR-11: Project Restore Effect

Restoring a project restores tickets soft-deleted as part of that project delete.
Individually soft-deleted tickets remain deleted.

### BR-12: Dependency Blocking

Only **direct** blockers affect DONE transition; blocker must be DONE. Circular
dependencies are **not forbidden** for MVP (may revisit later).

### BR-13: Soft-Deleted Blockers

Soft-deleted blockers excluded from dependency list; do not prevent DONE.

### BR-14: User Delete Guard

Cannot delete user who owns any project (including soft-deleted projects) or is assignee
on a non-DONE ticket (including tickets on soft-deleted projects). Comment authorship and
received mentions do **not** block delete (PD-10).

### BR-18: User Hard Delete Cascade (PD-10)

When `DELETE /users/:userId` succeeds (`200`), the system hard-deletes the user and cleans up
related data in one transaction:

1. Delete `mentions` on comments authored by the user.
2. Hard-delete all comments authored by the user.
3. Delete `mentions` rows where `userId` is the deleted user (received mentions).
4. Delete `project_members` rows for the user.
5. Set `assigneeId = null` on tickets where the user was assignee (only reachable when all
   assigned tickets are `DONE` per BR-14).
6. Record `DELETE` / `USER` in the audit log (`entityId` = deleted user, `performedBy` = actor).
7. Hard-delete the `users` row.

**Not cascade-deleted**: audit log rows (append-only). **Not nulled**: `audit_logs.performedBy`
on historical entries — original user id is preserved (FR-AUD-005).

**API after delete**:

- `GET /users/:userId` → `404`.
- `GET /users/:userId/mentions` → `404`.
- `GET /tickets/:ticketId/comments` → authored comments by deleted user no longer appear.
- Other users' comments may still contain `@username` text; `mentionedUsers` omits deleted user.
- `GET /audit-logs` → `performedBy` may reference a user id that returns `404` on `GET /users/:id`.

Per-comment `DELETE` audit entries are not required for cascade-removed comments.

### BR-15: Mention Re-evaluation

Comment update re-parses mentions; add new, remove dropped. Unknown usernames ignored.

### BR-16: Import Defaults

| Column | Rule |
|--------|------|
| `title` | **Mandatory**; row fails if missing or empty |
| `description` | Optional; empty string if missing |
| `status` | Optional; default `TODO` if missing/empty |
| `priority` | Optional; default `MEDIUM` if missing/empty |
| `type` | Optional; default `FEATURE` if missing/empty |
| `assigneeId` | Optional; empty triggers auto-assign rules |
| `id` | Ignored on import |

Invalid enum value when present → row fails (no default for invalid values).

### BR-17: Export Scope

Export includes only non-soft-deleted tickets for the project.

---

## Validation Rules

### User Creation (`POST /users`)

| Field | Rule |
|-------|------|
| `username` | Required; unique (case-insensitive); single token — no whitespace (for `@mentions`) |
| `email` | Required; valid format; unique (case-insensitive) |
| `fullName` | Required; non-empty |
| `role` | Required; `ADMIN` or `DEVELOPER` |

Request body MUST match README (no additional fields required by this spec).

### User Update

At least one of `fullName`, `role`; valid `role` enum.

### Project

`name` non-empty; `ownerId` references existing user.

### Ticket

| Field | Rule |
|-------|------|
| `title` | Required on create; non-empty |
| `status`, `priority`, `type` | Valid enums |
| `projectId` | Required on create; active project |
| `assigneeId` | Optional; existing user if set |
| `dueDate` | Optional; ISO-8601 datetime |

### Comment

`content` non-empty; `authorId` matches authenticated user.

### Dependency

`blockedBy` required; valid ticket in same project; not self.

### Attachment

File required; ≤10 MB; allowed MIME types per PDF §3.3.

### Import CSV

Per BR-16; RFC 4180 quoting; case-sensitive enum matching to README values.

### Authentication

Login requires non-empty `username` and `password`.

---

## Authorization Rules

### AR-01: Public Endpoint

Only `POST /auth/login` is unauthenticated.

### AR-02: Authenticated Access

All other endpoints require valid JWT.

### AR-03: ADMIN-Only (PDF §3.5)

| Endpoint | Non-ADMIN result |
|----------|------------------|
| `GET /tickets/deleted` | `403` |
| `POST /tickets/:ticketId/restore` | `403` |
| `GET /projects/deleted` | `403` |
| `POST /projects/:projectId/restore` | `403` |

### AR-04: Identity Trust

Authenticated identity from JWT governs authorization. `authorId` in comments must match
authenticated user. Client-supplied identity MUST NOT override JWT.

### AR-05: No Additional Role Gates

Beyond AR-03, any authenticated user (`ADMIN` or `DEVELOPER`) may use all endpoints.

---

## Data Requirements

The system MUST persist domain data for:

- **Users** — identity for auth, assignment, comments
- **Projects** — ticket containers with owner
- **Tickets** — work items with status, priority, type, assignee, due date, overdue flag
- **Comments** — ticket discussion with mention associations
- **Dependencies** — blocker relationships between tickets in same project
- **Attachments** — file metadata linked to tickets
- **Audit log** — append-only state-change history

Relationships and lifecycle:

- Tickets belong to one project.
- Soft-deleted tickets and projects are hidden from standard queries but recoverable by
  ADMIN per assignment.
- Users are **hard-deleted** per assignment §2.1 (no user soft-delete). Comments are
  hard-deleted individually via API or **cascade-deleted** when their author user is
  hard-deleted (BR-18 / PD-10).
- Audit log is append-only; `performedBy` retains historical user ids after user delete
  (FR-AUD-005).
- Referential references (`ownerId`, `assigneeId`, `projectId`) MUST point to existing
  active records when set on **create/update**, unless specified otherwise in edge cases.
  Historical audit rows and export CSV may reference deleted user ids.

Detailed schema, storage, and audit action mapping → `decision-log.md` (planning phase).

---

## Non-Functional Requirements

### NFR-01: Persistence

Domain data MUST persist across restarts (assignment §4.2).

### NFR-02: Input Validation

Invalid values MUST NOT enter the system; errors MUST be informative (assignment §4.1).

### NFR-03: Testing

Automated tests MUST cover key behaviors (assignment §4.3).

### NFR-04: Documentation

`run.md` and `prompts.md` required for submission (assignment §4.4–4.5).

### NFR-05: Timestamps

API datetime fields use ISO-8601 format per README examples.

---

## Error Scenarios

| Scenario | Expected outcome |
|----------|------------------|
| Missing/invalid JWT | `401`; informative message |
| Logged-out or invalid token | `401` |
| ADMIN-only endpoint as non-ADMIN | `403` |
| Resource not found | `404` |
| Soft-deleted on standard route | `404` |
| Validation failure | `400`; field-level detail |
| Invalid enum | `400`; allowed values indicated |
| Backward status transition | `400` |
| PATCH on DONE ticket | `400` |
| DONE with unresolved blockers | `400` |
| Self-dependency / cross-project dependency | `400` |
| Concurrent update conflict | Informative error; unsuccessful update rejected (mechanism → IC-10) |
| Duplicate username/email | `409` |
| Delete user: owns project or assignee on non-DONE ticket (BR-14) | `409` |
| Delete user: success with cascade (BR-18) | `200`; comments/mentions cleaned per PD-10 |
| Attachment size/type violation | `400` |
| `authorId` mismatch | `400` |
| Invalid login credentials | `401` |


---

## Edge Cases

1. Create ticket on soft-deleted project → `404`.
2. Restore ticket while project still deleted → hidden from project-scoped lists until
   project restored.
3. User delete blocked when owner or active assignee (BR-14).
4. User delete with authored comments succeeds when BR-14 passes; comments cascade-deleted (BR-18).
5. User delete removes received `mentions` rows; `@username` text may remain in comment content.
6. After user delete, `GET /users/:userId/mentions` → `404`.
7. Audit log keeps `performedBy` user id; `GET /users/:performedBy` may be `404`.
8. Deleted user's JWT no longer valid for protected endpoints (`401` on user lookup failure).
9. Username/email may be re-registered after hard delete (unique constraint released).
10. `assigneeId` cleared on DONE tickets when assignee user deleted.
11. `ProjectMember` rows for deleted user removed; workload/auto-assign pool updated.
12. Import row with `assigneeId` of deleted user fails row validation (user must exist).
13. Manual assignee may be any existing user when explicitly set.
14. Auto-assign yields `null` assignee when no linked DEVELOPER members (IC-11).
15. Tied workload for auto-assign → oldest registration wins (assignment §3.8).
16. CRITICAL + overdue: `isOverdue` set idempotently.
17. Import header-only CSV → `created: 0`.
18. Import duplicate titles allowed.
19. Circular dependencies allowed; DONE checks direct blockers only.
20. Export empty project → CSV header only.
21. Priority PATCH clears `isOverdue`.
22. Concurrent ticket/comment edits → one succeeds, one fails (IC-10).
23. Import row with blank `title` → row fails.
24. Comments/attachments on soft-deleted ticket → `404`.
25. Seeded ADMIN delete blocked if owner of any project or active assignee (same BR-14).
26. Project owner delete blocked even when project is soft-deleted (`ownerId` still references user).

---

## Success Criteria

- **SC-001**: All README endpoints return documented success shapes for valid input.
- **SC-002**: All PDF mandatory business rules enforced with test coverage.
- **SC-003**: Invalid input rejected with informative errors.
- **SC-004**: CSV round-trip preserves commas and quotes in field values.
- **SC-005**: Simultaneous ticket/comment updates do not both succeed.
- **SC-006**: `run.md` enables setup, run, and test without undocumented steps.
- **SC-007**: Approved product decisions (PD-01–PD-10) and IC-10/IC-11 planning choices
  reflected in `plan.md` before implementation tasks begin.

---

## Assumptions

Genuine product-level assumptions only. Implementation choices → `decision-log.md`.

| ID | Assumption |
|----|------------|
| A-01 | JSON request/response fields use camelCase per README examples |
| A-02 | Successful mutations return `200 OK` per README tables |
| A-03 | `GET /auth/me` response shape matches `GET /users/:userId` (README incomplete) |
| A-04 | Mention “notification” = persist association + retrievable via mentions API |
| A-05 | Unknown `@mentions` in comment text are ignored |
| A-06 | Username and email are globally unique (case-insensitive) |
| A-07 | Import: only `title` mandatory; missing enums default per BR-16; invalid enums fail row |
| A-08 | Export `id` column ignored on import (new tickets created) |
| A-09 | No role restrictions beyond ADMIN soft-delete operations (AR-05) |
| A-10 | Circular ticket dependencies allowed for MVP (BR-12) |
| A-11 | Username must not contain whitespace (single token for `@mentions`) |

---

## Resolved Product Decisions

All product ambiguities are resolved in [`decision-log.md`](decision-log.md)
(PD-01–PD-10). Key resolutions affecting this spec:

| ID | Summary |
|----|---------|
| PD-08 | Seeded initial ADMIN; credentials in `run.md` |
| PD-09 | MVP login: username existence check; no password persistence on `POST /users` |
| PD-10 | User hard delete with cascade; audit `performedBy` retained |

**Planning (not product decisions)**:

- DEVELOPER “in the project” modeling → `decision-log.md` **IC-11**
- Concurrency mechanism → **IC-10**

Other implementation details → `decision-log.md` Implementation Candidates (IC-*).

---

## Requirement Traceability

| Assignment Section | Spec Coverage |
|--------------------|---------------|
| 2.1 User Management | FR-USER, Story 2, VR Users |
| 2.2 Authentication | FR-AUTH, Story 1, AR-01 |
| 2.3 Project Management | FR-PROJ, Story 3, BR-10/11 |
| 2.4 Ticket Management | FR-TKT, Story 4, BR-01–03, FR-TKT-009 |
| 2.5 Comments | FR-CMT, Story 5, FR-CMT-004 |
| 3.1 Audit Log | FR-AUD, Story 10 |
| 3.2 Dependencies | FR-DEP, Story 6, BR-12/13 |
| 3.3 Attachments | FR-ATT, Story 7 |
| 3.4 Export/Import | FR-CSV, Story 8, BR-16/17 |
| 3.5 Soft Delete | FR-SD, Story 9, BR-09 |
| 3.6 Mentions | FR-MEN, Story 5, BR-15 |
| 3.7 Auto-Escalation | FR-ESC, Story 12, BR-04–06 |
| 3.8 Auto-Assignment | FR-TKT-012, Story 11, BR-07/08, IC-11 |
| 4.1 Validation/Errors | VR-*, NFR-02, Error Scenarios |
| 4.2 Persistence | NFR-01, Data Requirements |
| 4.3 Testing | NFR-03, Success Criteria |
| 4.4–4.5 Documentation | NFR-04, PD-08 |
