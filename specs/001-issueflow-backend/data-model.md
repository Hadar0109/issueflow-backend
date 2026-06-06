# IssueFlow — Data Model

**Feature**: `001-issueflow-backend`  
**Date**: 2026-06-06  
**Last Updated**: 2026-06-06 (IC-11 strict linkage; username validation)
**Source**: `spec.md`, `decision-log.md`, `research.md`

All tables use PostgreSQL. Primary keys are auto-increment integers unless noted.
Timestamps are `timestamptz` stored in UTC. Soft-deleted entities use `deletedAt` (null = active).

---

## Entity Relationship Overview

```text
User ──────────────< Project (ownerId)
  │                    │
  │                    ├──< ProjectMember (internal, IC-11)
  │                    └──< Ticket (projectId, assigneeId, deletedWithProjectId)
  │                              │
  │                              ├──< Comment ──< Mention >── User
  │                              ├──< TicketDependency (blocked / blockedBy)
  │                              └──< Attachment
  │
  └──< RevokedToken

AuditLog.performedBy: nullable integer user id — **not** an FK to User (PD-10 / FR-AUD-005).
Historical ids survive user hard-delete; `GET /users/:performedBy` may return `404`.

TicketDependency: ticketId (blocked) → blockedByTicketId (blocker), same project enforced in service layer.
ProjectMember: internal linkage for IC-11 “DEVELOPER in the project”; not exposed in API responses.
```

---

## User

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | Exposed in API |
| username | varchar(64) | NOT NULL, unique (case-insensitive via `LOWER`); **no whitespace** | PD-05; @mentions |
| email | varchar(255) | NOT NULL, unique (case-insensitive) | PD-05 |
| fullName | varchar(255) | NOT NULL | |
| role | enum | `ADMIN`, `DEVELOPER` | FR-USER-002 |
| passwordHash | varchar(255) | NULLABLE | Seeded ADMIN only (PD-09); not in API |
| createdAt | timestamptz | NOT NULL, default now() | Tie-break for auto-assign (BR-07) |
| updatedAt | timestamptz | NOT NULL | Internal concurrency metadata |

**Indexes**: `UNIQUE (LOWER(username))`, `UNIQUE (LOWER(email))`

**Lifecycle**: Hard delete per assignment §2.1. See [User Deletion Strategy](#user-deletion-strategy).

---

## Project

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| name | varchar(255) | NOT NULL | |
| description | text | NOT NULL, default '' | |
| ownerId | int | FK → User, NOT NULL | |
| deletedAt | timestamptz | NULLABLE | Soft delete (BR-09) |
| createdAt | timestamptz | NOT NULL | |
| updatedAt | timestamptz | NOT NULL | |

**Queries**: Standard APIs filter `deletedAt IS NULL`.

**Lifecycle**: Soft delete cascades to active tickets (BR-10). Restore per BR-11 using
`Ticket.deletedWithProjectId`. On create, upsert `ProjectMember` when owner is `DEVELOPER`.

---

## ProjectMember (internal — IC-11)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | Internal only |
| projectId | int | FK → Project, NOT NULL | |
| userId | int | FK → User, NOT NULL | Must be `DEVELOPER` |
| createdAt | timestamptz | NOT NULL, default now() | |

**Indexes**: `UNIQUE (projectId, userId)`, `(projectId)`

**Rules**: **Sole source of truth** for DEVELOPERs “in the project” (IC-11). Rows created
only via explicit linkage:

1. `POST /projects` with `DEVELOPER` owner.
2. Explicit `assigneeId` on ticket create, `PATCH`, or import row.

Not created by auto-assign. Sticky — not removed on unassign. Not exposed in API responses.
Drives **both** auto-assign pool and workload listing (same member set).

**FK on user delete**: `ON DELETE CASCADE` (see User Deletion Strategy).

---

## Ticket

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| title | varchar(500) | NOT NULL | |
| description | text | NOT NULL, default '' | |
| status | enum | `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE` | BR-01 |
| priority | enum | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` | BR-04 |
| type | enum | `BUG`, `FEATURE`, `TECHNICAL` | |
| projectId | int | FK → Project, NOT NULL | |
| assigneeId | int | FK → User, NULLABLE | |
| dueDate | timestamptz | NULLABLE | ISO-8601 in API |
| isOverdue | boolean | NOT NULL, default false | BR-04, BR-06 |
| deletedAt | timestamptz | NULLABLE | Soft delete |
| deletedWithProjectId | int | FK → Project, NULLABLE | IC-09; internal only |
| createdAt | timestamptz | NOT NULL | |
| updatedAt | timestamptz | NOT NULL | Lock target for IC-10 |

**Indexes**: `(projectId, deletedAt)`, `(assigneeId, projectId, status)`, `(dueDate, status, priority)`

**State transitions**: Forward-only status (BR-01). DONE immutable (BR-02). Priority PATCH
clears `isOverdue` (BR-05).

**Computed on read**: `isOverdue` recalculated when `dueDate` set, status ≠ DONE, and now > dueDate
(unless manually escalated flag set at CRITICAL).

---

## Comment

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| ticketId | int | FK → Ticket, NOT NULL | |
| authorId | int | FK → User, NOT NULL | Must match JWT (FR-CMT-002) |
| content | text | NOT NULL | @mention parsing on write |
| createdAt | timestamptz | NOT NULL | |
| updatedAt | timestamptz | NOT NULL | IC-10 lock target |

**Lifecycle**: Hard delete (assignment §2.5). Hidden when parent ticket soft-deleted.

---

## Mention

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| commentId | int | FK → Comment, NOT NULL | |
| userId | int | FK → User, NOT NULL | Mentioned user |
| createdAt | timestamptz | NOT NULL | |

**Indexes**: `UNIQUE (commentId, userId)`, `(userId, createdAt DESC)` for mentions API

**Rules**: Case-insensitive `@username` match (BR-15). Unknown usernames ignored (PD-06).
Rebuilt on comment update.

---

## TicketDependency

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| ticketId | int | FK → Ticket, NOT NULL | The blocked ticket |
| blockedByTicketId | int | FK → Ticket, NOT NULL | The blocker |
| createdAt | timestamptz | NOT NULL | |

**Indexes**: `UNIQUE (ticketId, blockedByTicketId)`

**Rules**: Same project (FR-DEP-003), no self (FR-DEP-004), circular allowed (BR-12, PD-03).
Soft-deleted blockers excluded from list and DONE checks (BR-13).

---

## Attachment

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| ticketId | int | FK → Ticket, NOT NULL | |
| filename | varchar(255) | NOT NULL | Sanitized original name |
| contentType | varchar(100) | NOT NULL | Verified MIME |
| storagePath | varchar(500) | NOT NULL | Internal path |
| sizeBytes | int | NOT NULL | |
| createdAt | timestamptz | NOT NULL | |

**Lifecycle**: Hard delete removes DB row and filesystem object (FR-ATT-001).

---

## AuditLog

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| action | varchar(32) | NOT NULL | IC-02 catalog |
| entityType | varchar(32) | NOT NULL | USER, PROJECT, TICKET, etc. |
| entityId | int | NOT NULL | |
| performedBy | int | NULLABLE; **no FK to users** (PD-10) | Retains historical user id after user delete; null for SYSTEM-only |
| actor | enum | `USER`, `SYSTEM` | FR-AUD-003 |
| metadata | jsonb | NULLABLE | Optional context (e.g., import row) |
| timestamp | timestamptz | NOT NULL, default now() | |

**Indexes**: `(entityType, entityId)`, `(action)`, `(actor)`, `(timestamp DESC)`

**Rules**: Append-only; no update/delete API. Written by `AuditService` on state changes.

**TypeORM / migration**: Map `performedBy` as `@Column({ type: 'int', nullable: true })` only.
Do **not** add `@ManyToOne(() => User)`, `@JoinColumn`, or a PostgreSQL FK constraint on
`audit_logs.performed_by` — otherwise user delete would cascade-null or block delete.

---

## RevokedToken

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| jti | varchar(64) | NOT NULL, UNIQUE | JWT ID claim |
| expiresAt | timestamptz | NOT NULL | Align with token exp |
| revokedAt | timestamptz | NOT NULL, default now() | |

**Indexes**: `(jti)`, `(expiresAt)` for cleanup

---

## Validation Rules Summary

| Entity | Key rules |
|--------|-----------|
| User | username/email unique CI; username single token (no whitespace); role enum; fullName non-empty |
| User update | At least one of `fullName`, `role`; valid `role` enum |
| Project | name non-empty; `ownerId` references existing user |
| Ticket create | title non-empty; enums valid; `projectId` references **active** (non-soft-deleted) project |
| Ticket PATCH | Allowed fields per README only — **`type` rejected** if sent; `status` forward-only; DONE immutable |
| Ticket | `assigneeId` references existing user if set; `dueDate` ISO-8601 |
| Comment | content non-empty; `authorId` = JWT sub |
| Dependency | `blockedBy` exists, same project, **both tickets active** (not soft-deleted), not self |
| Attachment | ≤10 MB; allowed MIME + magic bytes; parent ticket active |
| Import | `projectId` active; row rules per BR-16/PD-01 |
| Auth login | non-empty `username` and `password` (PD-09) |

---

## User Deletion Strategy (PD-10 / BR-18)

Assignment §2.1 requires **hard delete** for users. No user soft-delete. Option 1: cascade
cleanup when BR-14 passes. Spec: [`spec.md` BR-18](../spec.md).

### Service-layer guards (`UsersService.delete`) → `409 Conflict`

| Guard | Rule |
|-------|------|
| BR-14a | User owns any project (`projects.ownerId`), including soft-deleted projects |
| BR-14b | User is assignee on any non-`DONE` ticket (incl. on soft-deleted projects) |

Comment authorship and received mentions **do not** block delete.

### Transactional delete steps (after guards pass)

1. Delete `mentions` for all comments authored by the user.
2. Hard-delete all `comments` authored by the user.
3. Delete `mentions` rows where `userId = :userId` (received mentions on others' comments).
4. Delete `project_members` for the user.
5. `UPDATE tickets SET assignee_id = NULL WHERE assignee_id = :userId` (BR-14 ensures only DONE assignments remain).
6. Append audit: `DELETE` / `USER` / `entityId = :userId` / `performedBy = actor`.
7. Hard-delete `users` row.

**Not modified**: existing `audit_logs.performedBy` values (FR-AUD-005).  
**Not emitted**: per-comment `DELETE` audit for cascade-removed comments.

### Post-delete API behavior

| Endpoint / query | Result |
|------------------|--------|
| `GET /users/:id` | `404` |
| `GET /users/:id/mentions` | `404` |
| `GET /tickets/:id/comments` | Excludes cascade-deleted authored comments |
| `GET /audit-logs` | `performedBy` unchanged on historical rows |
| JWT of deleted user | `401` on protected routes (user lookup fails) |

### Foreign-key policies

| Child table | FK column | ON DELETE / handling |
|-------------|-----------|----------------------|
| `projects` | `ownerId` | RESTRICT (BR-14a guard) |
| `tickets` | `assigneeId` | SET NULL (step 5 in transaction) |
| `comments` | `authorId` | Removed in transaction (steps 1–2) |
| `mentions` | `userId` | Removed in transaction (steps 1, 3) |
| `project_members` | `userId` | Removed in transaction (step 4) |
| `audit_logs` | `performedBy` | **No FK** — integer retained (PD-10) |

### Implementation implications (pre-code review)

| Topic | Guidance |
|-------|----------|
| `RevokedToken` | Optional cleanup of tokens for deleted user not required; JWT guard fails on missing user |
| `entityId` on `DELETE USER` audit | Points to deleted id — valid for audit query |
| Re-registration | Hard delete frees `username`/`email` unique indexes |
| Export CSV | May contain `assigneeId` of since-deleted users until tickets updated |
| Comment `content` | `@username` text may remain after mention row deleted |

---

## Migration Strategy

1. `InitialSchema` — all tables and enums
2. `SeedAdminUser` — PD-08 bootstrap ADMIN
3. Future changes via timestamped TypeORM migrations only (`synchronize: false` in all environments)
