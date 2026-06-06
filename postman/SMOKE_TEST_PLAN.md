# IssueFlow Smoke Test Plan

**Target runtime**: under 15 minutes  
**Collection**: `IssueFlow-Smoke.postman_collection.json`  
**Environment**: `IssueFlow.postman_environment.json` (same as full QA suite)

## Purpose

This subset exercises the **critical path** only — enough to confirm the system works end-to-end after deploy, migration, or a quick regression check. It deliberately skips negative cases, concurrency, user-delete cascade, attachments (manual file), CSV import, escalation scheduler, and extended validation.

## Prerequisites

1. PostgreSQL running (`docker compose -f compose.yml up -d db`)
2. Migrations applied (`npm run migration:run`)
3. API running (`npm run start:dev`) on `http://localhost:3000`
4. Postman with **IssueFlow Local** environment selected
5. Set `testRunSuffix` to a unique value (e.g. `smoke20260606`)

## How to Run

1. Import `IssueFlow-Smoke.postman_collection.json` (environment already imported from full suite).
2. Open collection → folder **Smoke — Critical Path E2E**.
3. Click **Run** (Collection Runner).
4. Leave iterations at **1**, delay **0 ms**.
5. All 22 requests should pass (~5–10 minutes typical).

Regenerate collection after edits: `node postman/generate-smoke-collection.js`

---

## Test Cases

| Step | ID | Request | Validates |
|------|-----|---------|-----------|
| 1 | SMK-AUTH-01 | POST `/auth/login` | Admin login, JWT shape, token saved |
| 2 | SMK-AUTH-02 | GET `/auth/me` | Authenticated profile (FR-AUTH-005) |
| 3 | SMK-USER-01 | POST `/users` | Create DEVELOPER (FR-USER-003) |
| 4 | SMK-USER-02 | POST `/users` | Second user for mentions |
| 5 | SMK-AUTH-03 | POST `/auth/login` (dev) | Developer auth (PD-09) |
| 6 | SMK-PROJ-01 | POST `/projects` | Project create, dev owner → ProjectMember (IC-11) |
| 7 | SMK-TKT-01 | POST `/tickets` (no assignee) | Ticket create + auto-assign (BR-07) |
| 8 | SMK-TKT-02 | GET `/tickets?projectId=` | Project-scoped list, `isOverdue` field |
| 9 | SMK-TKT-03 | PATCH `/tickets/:id` | Forward status transition (BR-01) |
| 10 | SMK-DEP-01 | POST `/tickets` (blocker) | Second ticket for dependency |
| 11 | SMK-DEP-02 | POST `/tickets/:id/dependencies` | Add blocker link (FR-DEP-001) |
| 12 | SMK-DEP-03 | GET `/tickets/:id/dependencies` | List blockers |
| 13 | SMK-CMT-01 | POST `/tickets/:id/comments` | Comment + @mention (FR-CMT-003) |
| 14 | SMK-MEN-01 | GET `/users/:id/mentions` | Paginated mentions (FR-MEN-001) |
| 15 | SMK-WL-01 | GET `/projects/:id/workload` | Workload for project devs (BR-08) |
| 16 | SMK-CSV-01 | GET `/tickets/export?projectId=` | CSV export (FR-CSV-001) |
| 17 | SMK-SD-01 | DELETE `/tickets/:id` | Soft-delete ticket |
| 18 | SMK-SD-02 | GET `/tickets/:id` | Deleted ticket → 404 (BR-09) |
| 19 | SMK-SD-03 | GET `/tickets/deleted?projectId=` | ADMIN deleted list (AR-03) |
| 20 | SMK-SD-04 | POST `/tickets/:id/restore` | ADMIN restore |
| 21 | SMK-AUD-01 | GET `/audit-logs?entityType=TICKET` | Audit trail exists (FR-AUD-001) |
| 22 | SMK-AUTH-04 | POST `/auth/logout` | Token revocation (FR-AUTH-004) |

---

## Critical Path Coverage

| Area | Covered in Smoke | Deferred to Full Suite |
|------|------------------|------------------------|
| Authentication | Login, me, logout | Revoked token, invalid JWT, empty credentials |
| Users | Create, dev login | Update, delete, duplicates, BR-14/18 |
| Projects | Create (dev owner) | Update, project soft-delete/restore |
| Tickets | Create, list, PATCH status | DONE immutability, blocker→DONE 400, enums |
| Dependencies | Add, list | Self/cross-project 400, circular, remove |
| Comments | Create with mention | Update, delete, authorId mismatch |
| Mentions | Paginated GET | Deleted user 404 |
| Workload | GET | Tie-break, empty admin project |
| Export | GET CSV | Import, partial success, quoting |
| Soft delete | Ticket delete/restore | Project cascade, DEVELOPER 403 |
| Audit | Filtered GET | SYSTEM actor, AUTO_ASSIGN, cascade |
| Attachments | — | Upload, size/type validation |
| Concurrency | — | Parallel PATCH 409 |
| Escalation | — | Scheduler, isOverdue ladder |

---

## Pass Criteria

- **22/22** requests return expected status codes.
- Auto-assign sets `assigneeId` to the DEVELOPER project owner.
- Mention resolves exactly one user in comment response.
- Soft-deleted ticket returns 404 then appears in ADMIN deleted list and restores successfully.
- Audit log contains at least one `CREATE` entry for the main ticket.

## If Smoke Fails

| Failure at step | Likely cause |
|-----------------|--------------|
| 01 Login | DB/migrations not run; admin seed missing |
| 03–04 Create user | Duplicate `testRunSuffix` — change env value |
| 07 Auto-assign null | Project owner not DEVELOPER or membership not linked |
| 13 Comment 400 | `authorId` ≠ JWT user — re-run from step 05 |
| 16 Export empty | Non-fatal if project has tickets from step 07+10 |
| 19 Deleted list empty | Step 17 used wrong ticket id |

For full regression, run `IssueFlow.postman_collection.json` and see `MANUAL_TEST_PLAN.md`.
