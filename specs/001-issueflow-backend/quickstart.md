# IssueFlow — Quickstart Validation Guide

**Feature**: `001-issueflow-backend`  
**Date**: 2026-06-06  
**Last Updated**: 2026-06-06 (IC-11 strict linkage + username validation)  
**Purpose**: Runnable scenarios to validate end-to-end behavior after implementation.
Detailed setup steps will live in `run.md` (deliverable); this guide defines *what to verify*.

**References**: [plan.md](./plan.md) (E2E matrix) · [data-model.md](./data-model.md) · [contracts/](./contracts/) · [spec.md](./spec.md)

---

## Prerequisites

- Node.js 20+
- Docker (for PostgreSQL via `compose.yml` — PostgreSQL 16 pinned)
- NestJS **11** dependencies installed
- `npm install` completed
- Database running: `docker compose up -d db`
- Migrations applied and seed ADMIN created (see `run.md`)
- Application running: `npm run start:dev` (default port 3000)

Environment variables (minimum):

| Variable | Example | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://issueflow:issueflow@localhost:5432/issueflow` | TypeORM connection |
| `JWT_SECRET` | `dev-secret-change-me` | Token signing |
| `ATTACHMENTS_PATH` | `./storage/attachments` | File storage |

---

## Scenario 1 — Authentication (US1, PD-08/PD-09)

1. Login as seeded ADMIN:
   ```http
   POST /auth/login
   { "username": "admin", "password": "admin123" }
   ```
   **Expected**: `200`, `{ accessToken, tokenType: "Bearer", expiresIn: 3600 }`.

2. Login with wrong password for seeded ADMIN → `401`.

3. **PD-09**: Login with unknown username → `401`.

4. **PD-09**: Login with empty `username` or `password` → `401`.

5. `GET /auth/me` with token → `200`, profile matches `GET /users/:userId` (A-03).

6. `POST /auth/logout` then reuse token → `401`.

7. `GET /users` without token → `401`.

---

## Scenario 2 — User Registry (US2)

1. Create DEVELOPER via `POST /users` (README body, no `password` field).
2. `POST /users` with `username: "john doe"` (whitespace) → `400`.
3. New user first login enrolls password (PD-09) → `200`; wrong password on later login → `401`.
4. `GET /users` and `GET /users/:userId` → `200`.
5. `POST /users/update/:userId` with `fullName` and/or `role` → `200`; empty body → `400`.
6. Duplicate username (case variant) → `409`.
7. Duplicate email (case variant) → `409`.
8. User owns project → `DELETE /users/:id` → `409` (BR-14).
9. User assignee on non-DONE ticket → `409` (BR-14).
10. User with DONE-only assignments and authored comments → `DELETE /users/:id` → `200` (BR-18):
    - Authored comments removed from `GET /tickets/:id/comments`.
    - Received mention rows removed; `@username` text may remain in other comments.
11. `GET /users/:deletedId` and `GET /users/:deletedId/mentions` → `404`.
12. `GET /audit-logs` still shows `performedBy` = deleted user id on historical rows (PD-10).
13. Deleted user's JWT → `401` on protected endpoints.
14. Same `username` may be re-registered via `POST /users` after delete.

---

## Scenario 3 — Project & Ticket Lifecycle (US3, US4)

1. `POST /projects` with ADMIN owner → `200`; no `ProjectMember` yet.
2. `POST /projects` with DEVELOPER owner → owner linked as `ProjectMember`.
3. `GET /projects/:projectId` → `200`; soft-deleted project → `404`.
4. `PATCH /projects/:projectId` → `200`.
5. ADMIN-owned project, first ticket without `assigneeId` → `assigneeId: null` (no members).
6. DEVELOPER-owned project, ticket without `assigneeId` → auto-assign to owner (member pool).
7. `POST /tickets` with explicit `assigneeId` (DEVELOPER) → links assignee as member; no auto-assign.
8. `GET /tickets?projectId=` and `GET /tickets/:ticketId` → `200` with `isOverdue`.
9. Forward status `TODO → IN_PROGRESS` → `200`; backward → `400`.
10. `PATCH` with `type` field → `400` (not in README PATCH contract).
11. Move to `DONE` → `200`; further `PATCH` → `400`.
12. `DELETE /tickets/:id` → hidden from standard GET.

**Edge cases**:

- **#1** Create ticket on soft-deleted project → `404`.
- **#4** Manual `assigneeId` may be any existing user (including ADMIN) → `200`.

---

## Scenario 4 — Concurrent Update (IC-10)

1. Two users; `Promise.all` two `PATCH /tickets/:id` → one `200`, one `409`.
2. Same for `PATCH /tickets/:ticketId/comments/:commentId`.

---

## Scenario 5 — Comments & Mentions (US5)

1. `POST .../comments` with `@jdoe` → `mentionedUsers` populated.
2. `@unknownuser` → `200`, not in `mentionedUsers`.
3. `PATCH .../comments/:id` changing content → mentions re-evaluated (BR-15).
4. `authorId` mismatch JWT → `400`.
5. `GET /users/:userId/mentions?page=1&pageSize=10` → paginated, newest first.
6. **#15** Comment on soft-deleted ticket → `404`.

---

## Scenario 6 — Dependencies (US6)

1. `POST .../dependencies` same project → `200`.
2. `PATCH` to `DONE` with open blocker → `400`.
3. Self-dependency → `400`. Cross-project → `400`.
4. Dependency involving soft-deleted ticket → `400`.
5. **#10** Circular dependency allowed; only direct blockers affect DONE.
6. `GET .../dependencies` excludes soft-deleted blockers.
7. `DELETE .../dependencies/:blockerId` → `200`.

---

## Scenario 7 — Attachments (US7)

1. Valid PNG ≤10 MB → `200`.
2. 11 MB → `400`. Disallowed type → `400`.
3. `DELETE` attachment → `200`.
4. **#15** Upload on soft-deleted ticket → `404`.

---

## Scenario 8 — CSV Export/Import (US8, PD-01)

1. **#11** Export empty project → CSV header only.
2. Export ticket with comma in title → quoted correctly.
3. Partial import: one invalid row, one valid → `created: 1`, `failed: 1`.
4. **#8** Header-only CSV → `created: 0`.
5. **#9** Duplicate titles on import → allowed.
6. Blank `title` row → `errors`.
7. Missing enums → defaults `TODO`/`MEDIUM`/`FEATURE`.
8. Import to soft-deleted project → `404`.
9. Import row with explicit `assigneeId` → links DEVELOPER member; row without assignee on memberless project → `null` assignee.

---

## Scenario 9 — Soft Delete & Restore (US9, IC-09)

1. DEVELOPER `GET /tickets/deleted` → `403`; ADMIN → `200`.
2. `POST /tickets/:id/restore` as ADMIN → `200`.
3. `GET /projects/deleted` / `POST /projects/:id/restore` — same ADMIN gate.
4. Project delete cascades tickets; individually deleted ticket stays deleted on project restore.
5. **#2** Restore ticket while project still deleted → not in project-scoped lists.
6. Cascade emits per-ticket `SOFT_DELETE` / `RESTORE` audit entries.

---

## Scenario 10 — Audit Log (US10)

1. `POST /tickets` → `CREATE` TICKET auditable.
2. Auto-assign → `AUTO_ASSIGN` / `actor: SYSTEM`.
3. `DELETE /projects/:id` → `SOFT_DELETE` PROJECT + per-ticket `SOFT_DELETE`.
4. `GET /audit-logs?entityType=&action=&actor=` filters work.

---

## Scenario 11 — Workload & Auto-Assign (US11, IC-11)

1. ADMIN-owned project, no explicit linkage → `GET .../workload` → `[]`.
2. First ticket without assignee on memberless project → `assigneeId: null`.
3. `POST /projects` with DEVELOPER owner → owner in workload with `openTicketCount: 0`.
4. Ticket without assignee on DEVELOPER-owned project → auto-assign to least-loaded member (owner).
5. Add second linked DEVELOPER via explicit `assigneeId` on a ticket → both appear in workload.
6. **#6** Tied workload → oldest registration wins.
7. **#5** No linked DEVELOPER members → `assigneeId: null` (not system-wide fallback).
8. `GET .../workload` → linked members only, sorted ascending.
9. Auto-assign **not** triggered on `PATCH`.
10. `PATCH` with new explicit `assigneeId` → links new DEVELOPER member.

---

## Scenario 12 — Auto-Escalation (US12)

1. Past `dueDate`, `priority: LOW` → escalates one step per cycle.
2. **#7** At `CRITICAL` still overdue → `isOverdue: true`, priority unchanged.
3. **#12** Manual priority `PATCH` → `isOverdue: false`.
4. Audit shows `ESCALATE` / `actor: SYSTEM`.

---

## Test Commands

```bash
npm run test          # Unit tests
npm run test:e2e      # Full README contract + edge cases
npm run test:cov      # Coverage
```

E2E suite structure defined in [plan.md § README Endpoint → E2E Coverage Matrix](./plan.md#readme-endpoint--e2e-coverage-matrix).

---

## Success Checklist

- [ ] All 36 README endpoints covered
- [ ] NestJS 11 stack running
- [ ] PD-01–PD-10 verified (PD-09 login semantics in `run.md`; PD-10 delete cascade)
- [ ] IC-10 → `409` on concurrent PATCH
- [ ] IC-11: `ProjectMember` sole pool; no bootstrap; null without members
- [ ] Username whitespace rejected on `POST /users`
- [ ] Cascade audit per ticket on project delete/restore
- [ ] All spec edge cases covered
- [ ] `run.md` reproduces validation from clean clone
