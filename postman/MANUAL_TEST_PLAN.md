# IssueFlow Manual Test Plan

**Version**: 1.0  
**Date**: 2026-06-06  
**API base URL**: `http://localhost:3000`  
**Seeded admin**: `admin` / `admin123` (password not verified in MVP — any non-empty value works per PD-09)

## Smoke Test (under 15 minutes)

For a quick end-to-end check, use the smoke subset instead of the full collection:

- **Collection**: `IssueFlow-Smoke.postman_collection.json` (22 requests)
- **Plan**: [`SMOKE_TEST_PLAN.md`](./SMOKE_TEST_PLAN.md)
- **Generate**: `node postman/generate-smoke-collection.js`

Same environment file; run folder **Smoke — Critical Path E2E** sequentially in Collection Runner.

---

## Import Instructions

1. Start PostgreSQL and the API (`run.md`).
2. In Postman: **Import** → `postman/IssueFlow.postman_environment.json` and `postman/IssueFlow.postman_collection.json`.
3. Select environment **IssueFlow Local**.
4. Set `testRunSuffix` to a unique value per run (e.g. `run20260606`) to avoid username collisions.
5. Run folder **00 Setup & Auth** first, then remaining folders in order (01→13).
6. For **ATT-001** and **CSV-*** requests, attach files manually (see notes below).
7. For **CONC-*** requests, use Collection Runner with **2 iterations** and **0 ms delay** on the same request.

### Sample CSV files (create locally)

**partial-import.csv**
```csv
title,description,status,priority,type,assigneeId
Valid row,,,,,
,empty title,,,,
```

**header-only.csv**
```csv
title,description,status,priority,type,assigneeId
```

**invalid-enum.csv**
```csv
title,description,status,priority,type,assigneeId
Good row,,INVALID,,,
Another good,,,,,
```

---

## Test Cases

### 00 Authentication

| ID | Postman Request | Method & Path | Expected | Validates |
|----|-----------------|---------------|----------|-----------|
| TC-AUTH-001 | AUTH-001 | POST `/auth/login` | 200 + `{ accessToken, tokenType: "Bearer", expiresIn: 3600 }` | FR-AUTH-002, README login shape |
| TC-AUTH-002 | AUTH-003 | POST `/auth/login` (unknown user) | 401 | Invalid credentials handling |
| TC-AUTH-003 | AUTH-004 | POST `/auth/login` (empty fields) | 401 | Login requires non-empty username/password |
| TC-AUTH-004 | AUTH-005 | POST `/auth/login` (username `ADMIN`) | 200 | Case-insensitive username lookup (PD-09) |
| TC-AUTH-005 | AUTH-002 | GET `/auth/me` | 200 + user profile | FR-AUTH-005, A-03 |
| TC-AUTH-006 | AUTH-007 | POST `/auth/logout` | 200 | FR-AUTH-004 token revocation |
| TC-AUTH-007 | AUTH-006 | GET `/users` (no token) | 401 | AR-01, FR-AUTH-003 |
| TC-AUTH-008 | AUTH-009 | GET `/auth/me` (revoked token) | 401 | Logout invalidates JWT |
| TC-AUTH-009 | AUTH-010 | POST `/auth/login` (re-login) | 200 | Setup for subsequent tests |

### 01 Users

| ID | Postman Request | Method & Path | Expected | Validates |
|----|-----------------|---------------|----------|-----------|
| TC-USER-001 | USER-001 | GET `/users` | 200 array | FR-USER-001 list users |
| TC-USER-002 | USER-002 | POST `/users` | 200 + user object | FR-USER-003 create with README fields |
| TC-USER-003 | USER-003 | POST `/auth/login` (new dev) | 200 | PD-09: users created via API can login |
| TC-USER-004 | USER-004 | GET `/users/:userId` | 200 | FR-USER-001 get by id |
| TC-USER-005 | USER-005 | GET `/users/999999` | 404 | FR-USER-006 deleted/unknown user |
| TC-USER-006 | USER-006 | POST `/users/update/:userId` | 200 | FR-USER-004 update fullName/role |
| TC-USER-007 | USER-007 | POST `/users/update/:userId` `{}` | 400 | Update requires at least one field |
| TC-USER-008 | USER-008 | POST `/users` (whitespace username) | 400 | A-11, username single token for mentions |
| TC-USER-009 | USER-009 | POST `/users` (duplicate username) | 409 | A-06 case-insensitive uniqueness |
| TC-USER-010 | USER-010 | POST `/users` (duplicate email) | 409 | A-06 email uniqueness |
| TC-USER-011 | USER-011 | POST `/users` (invalid email) | 400 | DTO `@IsEmail` validation |
| TC-USER-012 | USER-012 | POST `/users` (role `MANAGER`) | 400 | FR-USER-002 ADMIN\|DEVELOPER only |
| TC-USER-013 | USER-013 | POST `/users` (second dev) | 200 | Setup for mentions tests |
| TC-USER-014 | USER-014 | POST `/users` (owner dev) | 200 | Setup for BR-14 owner test |
| TC-USER-015 | BR14-002 | DELETE `/users/:ownerUserId` | 409 | BR-14: cannot delete project owner |
| TC-USER-016 | BR14-005 | DELETE `/users/:assigneeUserId` | 409 | BR-14: assignee on non-DONE ticket |
| TC-USER-017 | BR18-005 | DELETE `/users/:deletableUserId` | 200 | BR-18 hard delete with cascade |
| TC-USER-018 | BR18-006 | GET `/users/:deletableUserId` | 404 | User removed after delete |
| TC-USER-019 | BR18-007 | GET `/auth/me` (deleted user token) | 401 | Edge-8: JWT invalid after user delete |
| TC-USER-020 | BR18-008 | GET `/audit-logs?entityType=USER&action=DELETE` | 200, `performedBy` numeric | PD-10 / FR-AUD-005 audit retention |

### 02 Projects

| ID | Postman Request | Method & Path | Expected | Validates |
|----|-----------------|---------------|----------|-----------|
| TC-PROJ-001 | PROJ-001 | POST `/projects` | 200 | FR-PROJ-002 create project |
| TC-PROJ-002 | PROJ-002 | POST `/projects` (dev owner) | 200 | IC-11 ProjectMember on dev owner |
| TC-PROJ-003 | PROJ-003 | GET `/projects` | 200, no soft-deleted | FR-PROJ-003, BR-09 |
| TC-PROJ-004 | PROJ-004 | GET `/projects/:projectId` | 200 | Get active project |
| TC-PROJ-005 | PROJ-005 | GET `/projects/999999` | 404 | Unknown project |
| TC-PROJ-006 | PROJ-006 | PATCH `/projects/:projectId` | 200 | FR-PROJ-001 update |
| TC-PROJ-007 | PROJ-007 | POST `/projects` (bad ownerId) | 400 | ownerId must exist |
| TC-PROJ-008 | PROJ-008 | GET `/projects/:id/workload` (admin owner) | 200 `[]` | BR-08 ADMIN excluded from pool |
| TC-PROJ-009 | PROJ-009 | GET `/projects/:id/workload` (dev owner) | 200 with dev entry | BR-08 workload listing |

### 03 Tickets

| ID | Postman Request | Method & Path | Expected | Validates |
|----|-----------------|---------------|----------|-----------|
| TC-TKT-001 | TKT-001 | POST `/tickets` (explicit assignee) | 200 + full shape incl. `isOverdue` | FR-TKT-003, FR-TKT-011 |
| TC-TKT-002 | TKT-002 | POST `/tickets` (no assigneeId) | 200, auto-assigned to dev owner | BR-07, FR-TKT-012 |
| TC-TKT-003 | TKT-003 | GET `/tickets?projectId=` | 200 array | FR-TKT-002 project scope |
| TC-TKT-004 | TKT-004 | GET `/tickets/:ticketId` | 200 | Get active ticket |
| TC-TKT-005 | TKT-005 | PATCH status → `IN_PROGRESS` | 200 | BR-01 forward transition |
| TC-TKT-006 | TKT-006 | PATCH status → `TODO` | 400 | BR-01 backward rejected |
| TC-TKT-007 | TKT-007 | PATCH `{ type: "FEATURE" }` | 400 | type immutable on update |
| TC-TKT-008 | TKT-008 | PATCH priority | 200, `isOverdue: false` | BR-05 manual priority reset |
| TC-TKT-009 | TKT-009/010 | POST `/tickets` (blocker pair) | 200 | Setup for dependencies |
| TC-TKT-010 | TKT-011 | POST `/tickets/:id/dependencies` | 200 | Setup blocker link |
| TC-TKT-011 | TKT-012 | PATCH blocked → `DONE` | 400 | BR-12 unresolved blocker |
| TC-TKT-012 | TKT-013 | PATCH `{ assigneeId: 999999 }` | 400 | FR-TKT-011 assignee exists |
| TC-TKT-013 | TKT-014 | POST `/tickets` on deleted project | 404 | Edge-1 soft-deleted project |
| TC-TKT-014 | TKT-015 | POST `/tickets` (status `OPEN`) | 400 | Enum validation |
| TC-TKT-015 | TKT-016 | GET `/tickets/999999` | 404 | Unknown ticket |
| TC-TKT-016 | TKT-019 | PATCH blocker → `DONE` | 200 | Blocker resolved |
| TC-TKT-017 | TKT-021 | PATCH blocked → `DONE` | 200 | DONE allowed after blocker done |
| TC-TKT-018 | TKT-022 | PATCH DONE ticket | 400 | BR-02 DONE immutability |
| TC-TKT-019 | SEC-005 | POST `/tickets` assigneeId=ADMIN | 200 | Edge-13 manual ADMIN assignee OK |
| TC-TKT-020 | TKT-002 (admin project) | POST `/tickets` no assignee, admin project | 200, `assigneeId: null` | IC-11 no dev members → null |

### 04 Comments

| ID | Postman Request | Method & Path | Expected | Validates |
|----|-----------------|---------------|----------|-----------|
| TC-CMT-001 | CMT-001 | POST `/tickets/:id/comments` | 200 + `mentionedUsers` | FR-CMT-003, FR-MEN-002 |
| TC-CMT-002 | CMT-002 | GET `/tickets/:id/comments` | 200 array | FR-CMT-001 list |
| TC-CMT-003 | CMT-003 | PATCH comment | 200, mentions re-parsed | BR-15 |
| TC-CMT-004 | CMT-004 | POST comment (authorId ≠ JWT) | 400 | FR-CMT-002, AR-04 |
| TC-CMT-005 | CMT-005 | POST comment empty content | 400 | content non-empty |
| TC-CMT-006 | CMT-006 | PATCH comment (non-author) | 400 | Author-only edit (implementation) |
| TC-CMT-007 | CMT-007 | DELETE comment (author) | 200 | FR-CMT-005 |
| TC-CMT-008 | CMT-008 | POST comment on deleted ticket | 404 | Edge-24 |

### 05 Dependencies

| ID | Postman Request | Method & Path | Expected | Validates |
|----|-----------------|---------------|----------|-----------|
| TC-DEP-001 | DEP-001 | POST `/tickets/:id/dependencies` | 200 | FR-DEP-001 add blocker |
| TC-DEP-002 | DEP-002 | GET `/tickets/:id/dependencies` | 200 blocker summary | FR-DEP-001 list shape |
| TC-DEP-003 | DEP-003 | POST self-dependency | 400 | FR-DEP-004 |
| TC-DEP-004 | DEP-004 | POST cross-project dependency | 400 | FR-DEP-003 same project |
| TC-DEP-005 | DEP-005 | POST circular dependency | 200 | BR-12 circular allowed |
| TC-DEP-006 | DEP-006 | DELETE dependency | 200 | Remove blocker |
| TC-DEP-007 | DEP-007 | DELETE unknown dependency | 404 | Not found |
| TC-DEP-008 | Manual | Soft-delete blocker, list deps | Blocker excluded | BR-13 soft-deleted blockers |

### 06 Attachments

| ID | Postman Request | Method & Path | Expected | Validates |
|----|-----------------|---------------|----------|-----------|
| TC-ATT-001 | ATT-001 | POST multipart `file` (PNG ≤10MB) | 200 attachment metadata | FR-ATT-001/002 |
| TC-ATT-002 | ATT-002 | DELETE attachment | 200 | FR-ATT-001 delete |
| TC-ATT-003 | ATT-003 | POST without file | 400 | File required |
| TC-ATT-004 | ATT-004 | POST on deleted ticket | 404 | Edge-24 |
| TC-ATT-005 | Manual | POST file >10MB | 400 | Max size 10 MB |
| TC-ATT-006 | Manual | POST disallowed MIME (e.g. `.exe`) | 400 | Allowed types only |
| TC-ATT-007 | Manual | POST MIME spoof (png header, exe body) | 400 | Magic-byte validation |

### 07 Import & Export

| ID | Postman Request | Method & Path | Expected | Validates |
|----|-----------------|---------------|----------|-----------|
| TC-CSV-001 | CSV-001 | GET `/tickets/export?projectId=` | 200 CSV with columns | FR-CSV-001, BR-17 |
| TC-CSV-002 | CSV-002 | POST `/tickets/import` partial CSV | 200 `{ created:1, failed:1 }` | FR-CSV-003 partial success |
| TC-CSV-003 | CSV-003 | POST import header-only | 200 `{ created:0 }` | Edge-17 |
| TC-CSV-004 | CSV-004 | POST import no file | 400 | File required |
| TC-CSV-005 | CSV-005 | POST import invalid enum row | 200, row in errors | BR-16 invalid enum fails row |
| TC-CSV-006 | Manual | Export then re-import round-trip | Values preserved | FR-CSV-004 commas/quotes |
| TC-CSV-007 | Manual | Import row blank title | Row fails | BR-16 title mandatory |
| TC-CSV-008 | Manual | Import missing enums | Defaults TODO/MEDIUM/FEATURE* | BR-16 defaults (*see findings) |
| TC-CSV-009 | Manual | Import with deleted assigneeId | Row fails | Edge-12 |

### 08 Soft Delete & Restore

| ID | Postman Request | Method & Path | Expected | Validates |
|----|-----------------|---------------|----------|-----------|
| TC-SD-001 | SD-001 | DELETE `/tickets/:id` | 200 | Soft-delete ticket |
| TC-SD-002 | SD-002 | GET deleted ticket | 404 | BR-09 visibility |
| TC-SD-003 | SD-003 | DELETE `/projects/:id` | 200 | BR-10 cascade tickets |
| TC-SD-004 | SD-004 | GET `/tickets/deleted` as DEVELOPER | 403 | AR-03 ADMIN-only |
| TC-SD-005 | SD-005 | GET `/tickets/deleted` as ADMIN | 200 | FR-SD-001 |
| TC-SD-006 | SD-006 | POST `/tickets/:id/restore` | 200 | Restore ticket |
| TC-SD-007 | SD-007 | GET `/projects/deleted` as DEVELOPER | 403 | AR-03 |
| TC-SD-008 | SD-008 | GET `/projects/deleted` as ADMIN | 200 | FR-SD-001 |
| TC-SD-009 | SD-009 | POST `/projects/:id/restore` | 200 + tickets back | BR-11 cascade restore |
| TC-SD-010 | SD-010 | POST restore as DEVELOPER | 403 | AR-03 |
| TC-SD-011 | Manual | Delete ticket individually, delete project, restore project | Individually deleted stays deleted | BR-11 |
| TC-SD-012 | Manual | Restore ticket while project still deleted | 404 parent project | Edge-2 |

### 09 Mentions & Workload

| ID | Postman Request | Method & Path | Expected | Validates |
|----|-----------------|---------------|----------|-----------|
| TC-MEN-001 | MEN-001 | GET `/users/:id/mentions?page=1` | 200 paginated shape | FR-MEN-001 |
| TC-MEN-002 | MEN-002 | GET mentions deleted user | 404 | Edge-6 |
| TC-MEN-003 | Manual | `@Username` case variant in comment | Case-insensitive match | FR-MEN-002 |
| TC-MEN-004 | Manual | User deleted, `@username` text in others' comments | Text remains, not in mentionedUsers | Edge-5 |
| TC-WL-001 | WL-001 | GET `/projects/:id/workload` | Sorted by openTicketCount asc | BR-08 |
| TC-WL-002 | Manual | Two devs tied workload | Older registration wins auto-assign | Edge-15, BR-07 tie-break |

### 10 Audit Log

| ID | Postman Request | Method & Path | Expected | Validates |
|----|-----------------|---------------|----------|-----------|
| TC-AUD-001 | AUD-001 | GET `/audit-logs` | 200 array with standard fields | FR-AUD-001 |
| TC-AUD-002 | AUD-002 | GET with entityType + entityId | Filtered results | FR-AUD-002 |
| TC-AUD-003 | AUD-003 | GET `actor=SYSTEM` | All SYSTEM actor | FR-AUD-003 |
| TC-AUD-004 | AUD-004 | GET `action=AUTO_ASSIGN` | Auto-assign entries | BR-07 auditable |
| TC-AUD-005 | Manual | Project delete | CASCADE SOFT_DELETE ticket audits | Story 10 |
| TC-AUD-006 | Manual | Escalation job runs | ESCALATE SYSTEM entries | FR-ESC-004 |

### 11 Auto-Escalation (Manual / Scheduler)

| ID | Postman Request | Method & Path | Expected | Validates |
|----|-----------------|---------------|----------|-----------|
| TC-ESC-001 | Manual | Create overdue LOW ticket, run scheduler | Priority → MEDIUM | BR-04 escalation ladder |
| TC-ESC-002 | Manual | CRITICAL overdue ticket, run scheduler | `isOverdue: true`, priority unchanged | BR-04 at CRITICAL |
| TC-ESC-003 | Manual | PATCH priority on overdue ticket | `isOverdue` cleared in response | BR-05 |
| TC-ESC-004 | Manual | DONE ticket overdue | No escalation | FR-ESC-004 |
| TC-ESC-005 | Manual | GET ticket past dueDate before escalation | `isOverdue` behavior | BR-06 (*see findings) |

### 12 Security & Authorization

| ID | Postman Request | Method & Path | Expected | Validates |
|----|-----------------|---------------|----------|-----------|
| TC-SEC-001 | SEC-001 | GET with invalid JWT | 401 | Token integrity |
| TC-SEC-002 | SEC-002 | POST `/users` with extra field | 400 | forbidNonWhitelisted |
| TC-SEC-003 | SEC-003 | DEVELOPER on `/projects/deleted` | 403 | AR-03 |
| TC-SEC-004 | SEC-004 | DEVELOPER POST `/tickets` | 200 | AR-05 no extra role gates |
| TC-SEC-005 | SEC-005 | Assign ticket to ADMIN | 200 | Edge-13 |

### 13 Concurrency

| ID | Postman Request | Method & Path | Expected | Validates |
|----|-----------------|---------------|----------|-----------|
| TC-CONC-001 | CONC-001 | Two parallel PATCH `/tickets/:id` | One 200, one 409 | FR-TKT-009, IC-10 |
| TC-CONC-002 | CONC-002 | Two parallel PATCH comment | One 200, one 409 | FR-CMT-004, IC-10 |

---

## Recommended Execution Order

```
00 Setup & Auth
01 Users (through USER-014)
02 Projects
03 Tickets (through TKT-016)
04 Comments (CMT-001 to CMT-006; skip CMT-007 until after CONC if testing concurrency on same comment)
05 Dependencies
06 Attachments
07 Import & Export
08 Soft Delete & Restore
09 Mentions & Workload
10 Audit Log
11 User Delete & BR-14/BR-18
12 Security & Validation
13 Concurrency
04 Comments (CMT-007 cleanup)
```

---

## Coverage Summary by Module

| Module | Endpoints | Postman Requests | Manual-Only | Notes |
|--------|-----------|------------------|-------------|-------|
| Auth | 3 | 10 | 0 | Full JWT lifecycle |
| Users | 5 + mentions | 14 + 11 BR | 2 | Delete cascade, re-register |
| Projects | 7 | 9 | 1 | Restore cascade edge case |
| Tickets | 8 | 22 | 2 | Status lifecycle, auto-assign |
| Comments | 4 | 8 | 0 | Author-only edit enforced |
| Dependencies | 3 | 7 + 1 manual | 1 | Soft-deleted blocker |
| Attachments | 2 | 4 + 3 manual | 3 | File attach manual |
| Import/Export | 2 | 5 + 4 manual | 4 | CSV files manual |
| Soft Delete | 4 | 10 + 2 manual | 2 | ADMIN gates |
| Mentions | 1 | 2 + 2 manual | 2 | Pagination |
| Workload | 1 | 2 + 1 manual | 1 | Tie-break manual |
| Audit | 1 | 4 + 2 manual | 2 | Escalation manual |
| Escalation | (scheduler) | 0 + 5 manual | 5 | Requires time/scheduler trigger |
| Security | — | 5 | 0 | |
| Concurrency | — | 3 | 0 | Runner parallel |

**Total test cases**: 118 (87 in Postman collection + 31 manual-only/scheduler)

---

## Coverage Summary by Business Rule

| Rule | Test Case IDs | Covered |
|------|---------------|---------|
| BR-01 Status forward-only | TC-TKT-005, TC-TKT-006 | Yes |
| BR-02 DONE immutability | TC-TKT-018 | Yes |
| BR-03 DONE stops escalation | TC-ESC-004 | Manual |
| BR-04 Priority escalation ladder | TC-ESC-001, TC-ESC-002 | Manual |
| BR-05 Manual priority reset | TC-TKT-008, TC-ESC-003 | Yes |
| BR-06 Overdue definition | TC-ESC-005 | Partial (see findings) |
| BR-07 Auto-assignment | TC-TKT-002, TC-TKT-020, TC-AUD-004, TC-WL-002 | Yes |
| BR-08 Workload listing | TC-PROJ-008, TC-PROJ-009, TC-WL-001 | Yes |
| BR-09 Soft delete visibility | TC-SD-002, TC-SD-004 | Yes |
| BR-10 Project delete effect | TC-SD-003 | Yes |
| BR-11 Project restore effect | TC-SD-009, TC-SD-011 | Yes |
| BR-12 Dependency blocking | TC-TKT-011, TC-TKT-017, TC-DEP-005 | Yes |
| BR-13 Soft-deleted blockers | TC-DEP-008 | Manual |
| BR-14 User delete guard | TC-USER-015, TC-USER-016 | Yes |
| BR-15 Mention re-evaluation | TC-CMT-003 | Yes |
| BR-16 Import defaults | TC-CSV-002, TC-CSV-005, TC-CSV-007, TC-CSV-008 | Partial |
| BR-17 Export scope | TC-CSV-001 | Yes |
| BR-18 User hard delete cascade | TC-USER-017–020 | Yes |

---

## Edge Cases Covered

1. Create ticket on soft-deleted project → 404 (TC-TKT-013)
2. Restore ticket while project deleted → manual (TC-SD-012)
3. User delete blocked as owner/assignee (TC-USER-015, TC-USER-016)
4. User delete cascades comments (TC-USER-017)
5. Deleted user mention text vs mentionedUsers (TC-MEN-004 manual)
6. Mentions 404 for deleted user (TC-MEN-002)
7. Audit performedBy after user delete (TC-USER-020)
8. Deleted user JWT invalid (TC-USER-019)
9. Username re-register after delete — manual
10. assigneeId cleared on DONE tickets when user deleted — covered in BR-18 flow
11. ProjectMember removed on user delete — implicit in BR-18
12. Import invalid assigneeId — manual (TC-CSV-009)
13. Manual ADMIN assignee (TC-SEC-005)
14. Auto-assign null when no dev members (TC-TKT-020)
15. Tied workload tie-break — manual (TC-WL-002)
16. CRITICAL + overdue isOverdue — manual (TC-ESC-002)
17. Header-only CSV import (TC-CSV-003)
18. Duplicate titles on import — implicit (allowed)
19. Circular dependencies (TC-DEP-005)
20. Export empty project — manual with new project
21. Priority PATCH clears isOverdue (TC-TKT-008)
22. Concurrent ticket/comment edits (TC-CONC-001, TC-CONC-002)
23. Import blank title row (TC-CSV-007)
24. Comments/attachments on soft-deleted ticket (TC-CMT-008, TC-ATT-004)
25. Seeded ADMIN delete blocked — same BR-14 as TC-USER-015 if admin owns project
26. Owner delete blocked on soft-deleted project — manual

---

## Findings: Bugs, Inconsistencies, Missing Validations, Spec Mismatches

### Spec / Implementation Mismatches

| # | Severity | Area | Finding |
|---|----------|------|---------|
| F-01 | **Medium** | CSV Import (BR-16) | Spec default `type` is `FEATURE`; `csv-import.service.ts` defaults to `BUG`. |
| F-02 | **Medium** | Attachments (FR-ATT-002) | Spec allows `image/png`, `image/jpeg`, `application/pdf`, `text/plain` only. Implementation also allows `image/gif` and `text/csv`. |
| F-03 | **Medium** | isOverdue (BR-06) | `computeIsOverdue()` ignores `dueDate` vs current time in GET responses; returns `true` only when DB `isOverdue` flag set (after CRITICAL escalation). Past-due tickets may show `isOverdue: false` until scheduler runs. |
| F-04 | **Low** | Dependencies | Soft-deleted/inactive tickets return **400** (`Ticket not found or inactive`) instead of **404** per standard not-found pattern. |
| F-05 | **Low** | Comments | PATCH/DELETE restricted to comment **author** only — not documented in README/spec (AR-05 says no extra role gates). Reasonable security but undocumented. |
| F-06 | **Low** | User update | `fullName` can be set to empty string — no `@IsNotEmpty()` on update DTO. |
| F-07 | **Low** | Project update | `name` can be patched to empty string — no `@IsNotEmpty()` on optional name field. |
| F-08 | **Info** | Login (PD-09) | Password never verified for any user; documented in `run.md` but differs from README implying real password check. |
| F-09 | **Info** | Duplicate dependency | Adding same dependency twice is idempotent (200, no error) — acceptable but unspecified. |
| F-10 | **Info** | Ticket restore | Restoring ticket whose project is still soft-deleted returns 404 `"Parent project is still deleted"` — correct per Edge-2. |
| F-11 | **Info** | Audit response | May include optional `metadata` field not shown in README examples — additive only. |
| F-12 | **Info** | Import enum | Import accepts case-insensitive enum values (`upper()`) while spec says case-sensitive matching to README values. |

### Missing Validations (Not Enforced)

- `POST /users/update/:userId` — empty `fullName` string accepted
- `PATCH /projects/:projectId` — empty `name` accepted
- `PATCH /tickets/:ticketId` — empty `title` if provided (no `@IsNotEmpty` on optional title)
- No rate limiting / brute-force protection on login (out of MVP scope)

### Route Ordering Note

NestJS registers `GET /projects/deleted` before `GET /projects/:projectId` — correct. Same for `GET /tickets/deleted`, `export` before `:ticketId` — verified in controllers.

---

## Files in This Workspace

| File | Purpose |
|------|---------|
| `IssueFlow.postman_collection.json` | Importable Postman collection (14 folders, ~90 requests) |
| `IssueFlow.postman_environment.json` | Local environment variables |
| `MANUAL_TEST_PLAN.md` | This document |
| `generate-collection.js` | Regenerates collection JSON after edits |
