# Tasks: IssueFlow Ticket Management Backend

**Input**: Design documents from `/specs/001-issueflow-backend/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included per NFR-03 and plan.md Testing Approach (unit + e2e in Polish phase; story checkpoints define independent verification via quickstart scenarios).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1–US12) for story-phase tasks only
- Include exact file paths in descriptions

## Path Conventions

- Single NestJS project at repository root: `src/`, `test/`
- Migrations: `src/database/migrations/`
- E2E tests: `test/*.e2e-spec.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Upgrade skeleton to NestJS 11 and prepare local development environment

- [X] T001 Upgrade all `@nestjs/*` packages from v10 to v11 in `package.json` (core, platform-express, typeorm, cli, schematics, testing) per IC-08
- [X] T002 Add implementation dependencies to `package.json`: `@nestjs/jwt`, `@nestjs/passport`, `@nestjs/schedule`, `@nestjs/config`, `passport`, `passport-jwt`, `bcrypt`, `file-type`
- [X] T003 Run `npm install` and verify `npm run build` succeeds after NestJS 11 upgrade
- [X] T004 Create `compose.yml` with PostgreSQL 16 service and documented credentials per research.md IC-08
- [X] T005 Create `.env.example` with `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `ATTACHMENTS_PATH` at repository root
- [X] T006 [P] Add `storage/attachments/` to `.gitignore`
- [X] T007 [P] Create environment loader in `src/config/configuration.ts` for ConfigModule

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database, shared infrastructure, and cross-cutting services that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T008 Create shared TypeORM `forRoot` options const in `src/database/data-source.ts` (reuse reference per IC-08 NestJS 11 dynamic-module note)
- [X] T009 Create `DatabaseModule` registering TypeORM in `src/database/database.module.ts`
- [X] T010 [P] Create `User` entity in `src/users/entities/user.entity.ts` per data-model.md
- [X] T011 [P] Create `RevokedToken` entity in `src/auth/entities/revoked-token.entity.ts`
- [X] T012 [P] Create `Project` entity in `src/projects/entities/project.entity.ts`
- [X] T013 [P] Create `ProjectMember` entity in `src/projects/entities/project-member.entity.ts`
- [X] T014 [P] Create `Ticket` entity in `src/tickets/entities/ticket.entity.ts` (incl. `deletedWithProjectId` IC-09)
- [X] T015 [P] Create `Comment` entity in `src/comments/entities/comment.entity.ts`
- [X] T016 [P] Create `Mention` entity in `src/comments/entities/mention.entity.ts`
- [X] T017 [P] Create `TicketDependency` entity in `src/dependencies/entities/ticket-dependency.entity.ts`
- [X] T018 [P] Create `Attachment` entity in `src/attachments/entities/attachment.entity.ts`
- [X] T019 [P] Create `AuditLog` entity in `src/audit/entities/audit-log.entity.ts` (`performedBy` as plain int, no FK per PD-10)
- [X] T020 Create `InitialSchema` migration in `src/database/migrations/` with all enums, tables, and indexes from data-model.md
- [X] T021 Create `SeedAdminUser` migration in `src/database/migrations/` with bcrypt `passwordHash` for seeded ADMIN (PD-08)
- [X] T022 Add migration npm scripts to `package.json` (`migration:run`, `migration:revert`, `migration:generate`)
- [X] T023 [P] Implement `HttpExceptionFilter` in `src/common/filters/http-exception.filter.ts` per contracts/error-responses.md (IC-06)
- [X] T024 [P] Create `@Public()`, `@Roles()`, `@CurrentUser()` decorators in `src/common/decorators/`
- [X] T025 Configure global `ValidationPipe` (whitelist, forbidNonWhitelisted, transform) in `src/main.ts`
- [X] T026 Register global `HttpExceptionFilter` in `src/main.ts`
- [X] T027 Create `TransactionRunner` in `src/common/database/transaction-runner.ts` for IC-10 pessimistic locks
- [X] T028 [P] Create injectable `Clock` interface and default implementation in `src/common/utils/clock.ts`
- [X] T029 Implement `AuditService.log()` in `src/audit/audit.service.ts` with IC-02 action catalog support
- [X] T030 Create `AuditModule` exporting `AuditService` in `src/audit/audit.module.ts`
- [X] T031 Create `CommonModule` exporting shared guards, filters, `TransactionRunner` in `src/common/common.module.ts`
- [X] T032 Wire `ConfigModule`, `DatabaseModule`, `CommonModule`, `AuditModule` in `src/app.module.ts`
- [X] T033 Remove or replace skeleton `AppController`/`AppService` in `src/app.controller.ts` and `src/app.service.ts` with production module wiring

**Checkpoint**: Database migrates cleanly; global validation and error shape work; audit service callable

---

## Phase 3: User Story 1 — Authenticated API Access (Priority: P1) 🎯 MVP

**Goal**: JWT login, logout, me, and global auth guard protecting all routes except login

**Independent Test**: quickstart.md Scenario 1 — login returns token; protected route without token → 401; logout invalidates token; `GET /auth/me` returns profile

### Implementation for User Story 1

- [X] T034 [P] [US1] Create auth DTOs (`LoginDto`, etc.) in `src/auth/dto/`
- [X] T035 [P] [US1] Implement `TokenRevocationService` in `src/auth/token-revocation.service.ts` (IC-01 deny-list)
- [X] T036 [US1] Implement `AuthService` login/logout/me in `src/auth/auth.service.ts` (PD-09 username existence, non-empty fields)
- [X] T037 [US1] Implement JWT strategy in `src/auth/jwt.strategy.ts` loading user by `sub`
- [X] T038 [US1] Implement `JwtAuthGuard` in `src/common/guards/jwt-auth.guard.ts` with `@Public()` bypass
- [X] T039 [US1] Implement `AuthController` (`POST /auth/login`, `POST /auth/logout`, `GET /auth/me`) in `src/auth/auth.controller.ts`
- [X] T040 [US1] Create `AuthModule` and register global `JwtAuthGuard` in `src/auth/auth.module.ts` and `src/app.module.ts`
- [X] T041 [US1] Implement `TokenCleanupJob` cron in `src/auth/token-cleanup.job.ts` (purge expired revoked tokens)

**Checkpoint**: US1 complete — all endpoints except login require valid JWT

---

## Phase 4: User Story 2 — User Registry (Priority: P1)

**Goal**: User CRUD, update, hard delete with BR-14/BR-18 cascade, username validation

**Independent Test**: quickstart.md Scenario 2 — create/list/get/update users; duplicate → 409; delete blocked by BR-14 → 409; successful delete cascades comments/mentions

### Implementation for User Story 2

- [X] T042 [P] [US2] Create user DTOs in `src/users/dto/` (create, update, response shapes per README)
- [X] T043 [US2] Implement `UsersRepository` CI uniqueness helpers in `src/users/users.repository.ts`
- [X] T044 [US2] Implement `UsersService` create/list/get/update in `src/users/users.service.ts` (PD-05 whitespace rejection, CI duplicates → 409)
- [X] T045 [US2] Implement `UsersService.delete` with BR-14 guards and BR-18 cascade transaction in `src/users/users.service.ts` (PD-10)
- [X] T046 [US2] Implement `UsersController` in `src/users/users.controller.ts` (GET/POST/POST update/DELETE per README)
- [X] T047 [US2] Wire `UsersModule` in `src/users/users.module.ts` and import in `src/app.module.ts`
- [X] T048 [US2] Add USER CREATE/UPDATE/DELETE audit calls in `src/users/users.service.ts`

**Checkpoint**: User registry fully functional; deleted user → 401 on subsequent JWT use

---

## Phase 5: User Story 3 — Project Management (Priority: P1)

**Goal**: Project CRUD, soft delete with ticket cascade (BR-10), DEVELOPER owner membership (IC-11)

**Independent Test**: quickstart.md Scenario 3 — create project; list excludes soft-deleted; delete cascades tickets; PATCH updates fields

### Implementation for User Story 3

- [X] T049 [P] [US3] Create project DTOs in `src/projects/dto/`
- [X] T050 [US3] Implement `ProjectMembershipService` in `src/projects/project-membership.service.ts` (link DEVELOPER owner on create, explicit assignee linkage IC-11)
- [X] T051 [US3] Implement `ProjectsService` CRUD in `src/projects/projects.service.ts`
- [X] T052 [US3] Implement project soft delete with ticket cascade and `deletedWithProjectId` in `src/projects/projects.service.ts` (BR-10, IC-09)
- [X] T053 [US3] Implement per-ticket cascade `SOFT_DELETE` audit entries in `src/projects/projects.service.ts` (IC-02 extension)
- [X] T054 [US3] Implement `ProjectsController` with IC-05 route order in `src/projects/projects.controller.ts` (static `/projects/deleted` before `/:projectId`)
- [X] T055 [US3] Wire `ProjectsModule` in `src/projects/projects.module.ts` and import in `src/app.module.ts`
- [X] T056 [US3] Add PROJECT CREATE/UPDATE/SOFT_DELETE audit calls in `src/projects/projects.service.ts`

**Checkpoint**: Projects and cascade delete work; soft-deleted projects hidden from standard GET

---

## Phase 6: User Story 4 — Ticket Lifecycle (Priority: P1)

**Goal**: Ticket CRUD, forward-only status, DONE immutability, soft delete, IC-10 concurrent PATCH

**Independent Test**: quickstart.md Scenario 4 — create/list/get tickets; status transitions; DONE PATCH → 400; concurrent PATCH → 409

### Implementation for User Story 4

- [X] T057 [P] [US4] Create ticket DTOs in `src/tickets/dto/` (create, patch — no `type` on PATCH per README)
- [X] T058 [P] [US4] Implement `OverdueCalculator` pure helper in `src/tickets/overdue-calculator.ts`
- [X] T059 [US4] Implement `TicketStatusService` forward-only and DONE rules in `src/tickets/ticket-status.service.ts` (BR-01, BR-02)
- [X] T060 [US4] Implement `TicketPatchService` with `FOR UPDATE NOWAIT` in `src/tickets/ticket-patch.service.ts` (IC-10)
- [X] T061 [US4] Implement `TicketsRepository` soft-delete scoping and lock fetch in `src/tickets/tickets.repository.ts`
- [X] T062 [US4] Implement `TicketsService` create/list/get/delete in `src/tickets/tickets.service.ts` (reject ops on soft-deleted project → 404)
- [X] T063 [US4] Wire PATCH through `TicketPatchService` with priority `isOverdue` reset (BR-05) in `src/tickets/tickets.service.ts`
- [X] T064 [US4] Implement `TicketsController` with IC-05 route order in `src/tickets/tickets.controller.ts`
- [X] T065 [US4] Wire `TicketsModule` in `src/tickets/tickets.module.ts` and import in `src/app.module.ts`
- [X] T066 [US4] Add TICKET CREATE/UPDATE/SOFT_DELETE audit calls in `src/tickets/tickets.service.ts`

**Checkpoint**: Ticket lifecycle complete without auto-assign, CSV, or escalation

---

## Phase 7: User Story 5 — Comments and Mentions (Priority: P2)

**Goal**: Comment CRUD on tickets, @mention parsing, mentions query, IC-10 comment PATCH

**Independent Test**: quickstart.md Scenario 5 — post comment with @mention; unknown @ignored; PATCH re-evaluates mentions; soft-deleted ticket → 404

### Implementation for User Story 5

- [X] T067 [P] [US5] Create comment DTOs in `src/comments/dto/`
- [X] T068 [US5] Implement `MentionParserService` in `src/comments/mention-parser.service.ts` (BR-15, PD-06)
- [X] T069 [US5] Implement `CommentPatchService` with `FOR UPDATE NOWAIT` in `src/comments/comment-patch.service.ts` (IC-10)
- [X] T070 [US5] Implement `CommentsService` CRUD with `authorId === jwt.sub` check in `src/comments/comments.service.ts` (PD-04)
- [X] T071 [US5] Implement `MentionsService` paginated query in `src/users/mentions.service.ts` for `GET /users/:userId/mentions`
- [X] T072 [US5] Implement `CommentsController` nested under tickets in `src/comments/comments.controller.ts`
- [X] T073 [US5] Wire `CommentsModule` in `src/comments/comments.module.ts` and import in `src/app.module.ts`
- [X] T074 [US5] Add COMMENT CREATE/UPDATE/DELETE audit calls in `src/comments/comments.service.ts`

**Checkpoint**: Comments and mentions work independently of dependencies/attachments

---

## Phase 8: User Story 6 — Ticket Dependencies (Priority: P2)

**Goal**: Add/list/remove blockers; DONE blocked by unresolved direct blockers; circular allowed

**Independent Test**: quickstart.md Scenario 6 — add dependency; self/cross-project → 400; DONE with open blocker → 400

### Implementation for User Story 6

- [X] T075 [P] [US6] Create dependency DTOs in `src/dependencies/dto/`
- [X] T076 [US6] Implement `DependenciesService` add/list/remove with validation in `src/dependencies/dependencies.service.ts` (BR-12/BR-13, PD-03)
- [X] T077 [US6] Integrate direct-blocker check into `TicketStatusService` for DONE transition in `src/tickets/ticket-status.service.ts`
- [X] T078 [US6] Implement `DependenciesController` in `src/dependencies/dependencies.controller.ts`
- [X] T079 [US6] Wire `DependenciesModule` in `src/dependencies/dependencies.module.ts` and import in `src/app.module.ts`
- [X] T080 [US6] Add DEPENDENCY ADD/REMOVE audit calls in `src/dependencies/dependencies.service.ts`

**Checkpoint**: Dependencies enforce DONE rules; soft-deleted blockers excluded

---

## Phase 9: User Story 7 — Attachments (Priority: P2)

**Goal**: Multipart upload/delete with size, MIME, and magic-byte validation (IC-04)

**Independent Test**: quickstart.md Scenario 7 — valid upload → 200; oversize/wrong type → 400; soft-deleted ticket → 404

### Implementation for User Story 7

- [X] T081 [P] [US7] Create attachment DTOs and multer config in `src/attachments/dto/` and `src/attachments/multer.config.ts`
- [X] T082 [US7] Implement `FileValidationService` in `src/attachments/file-validation.service.ts` (IC-04 size, MIME, magic bytes)
- [X] T083 [US7] Implement `FileStorageService` in `src/attachments/file-storage.service.ts` under `ATTACHMENTS_PATH`
- [X] T084 [US7] Implement `AttachmentsService` upload/delete in `src/attachments/attachments.service.ts`
- [X] T085 [US7] Implement `AttachmentsController` multipart endpoints in `src/attachments/attachments.controller.ts`
- [X] T086 [US7] Wire `AttachmentsModule` in `src/attachments/attachments.module.ts`; ensure upload dir created on startup in `src/main.ts`
- [X] T087 [US7] Add ATTACHMENT UPLOAD/DELETE audit calls in `src/attachments/attachments.service.ts`

**Checkpoint**: Attachments stored locally with validation; no download endpoint

---

## Phase 10: User Story 8 — Export and Import (Priority: P2)

**Goal**: CSV export/import with RFC 4180 quoting, row-level errors, PD-01 defaults

**Independent Test**: quickstart.md Scenario 8 — export CSV; import partial success; header-only CSV; soft-deleted excluded from export

### Implementation for User Story 8

- [X] T088 [P] [US8] Create import DTOs in `src/tickets/dto/import-tickets.dto.ts`
- [X] T089 [US8] Implement `CsvExportService` in `src/tickets/csv-export.service.ts` (BR-17, PD-07)
- [X] T090 [US8] Implement `CsvImportService` in `src/tickets/csv-import.service.ts` (BR-16, PD-01 row defaults/errors)
- [X] T091 [US8] Add `GET /tickets/export` and `POST /tickets/import` routes to `src/tickets/tickets.controller.ts` (IC-05 static before param)
- [X] T092 [US8] Wire import assignee linkage via `ProjectMembershipService` in `src/tickets/csv-import.service.ts`
- [X] T093 [US8] Add TICKET CREATE audit per imported row in `src/tickets/csv-import.service.ts`

**Checkpoint**: CSV round-trip works; invalid rows reported without failing entire import

---

## Phase 11: User Story 9 — Soft Delete and Restore (Priority: P2)

**Goal**: ADMIN-only deleted lists and restore endpoints with selective ticket restore (BR-11)

**Independent Test**: quickstart.md Scenario 9 — DEVELOPER → 403 on deleted endpoints; ADMIN restore project restores cascade-deleted tickets only

### Implementation for User Story 9

- [X] T094 [US9] Implement `RolesGuard` in `src/common/guards/roles.guard.ts` (AR-03, PD-02)
- [X] T095 [US9] Add `@Roles('ADMIN')` to `GET /projects/deleted` and `POST /projects/:projectId/restore` in `src/projects/projects.controller.ts`
- [X] T096 [US9] Implement project restore with selective ticket restore via `deletedWithProjectId` in `src/projects/projects.service.ts` (BR-11, IC-09)
- [X] T097 [US9] Add per-ticket RESTORE cascade audit entries in `src/projects/projects.service.ts`
- [X] T098 [US9] Add `@Roles('ADMIN')` to `GET /tickets/deleted` and `POST /tickets/:ticketId/restore` in `src/tickets/tickets.controller.ts`
- [X] T099 [US9] Implement ticket restore in `src/tickets/tickets.service.ts` with RESTORE audit

**Checkpoint**: ADMIN soft-delete admin surfaces work; non-ADMIN receives 403

---

## Phase 12: User Story 10 — Audit Log (Priority: P2)

**Goal**: Queryable append-only audit log with filters and SYSTEM actor support

**Independent Test**: quickstart.md Scenario 10 — mutations appear in `GET /audit-logs`; filter by entityType/action/actor

### Implementation for User Story 10

- [X] T100 [US10] Implement `AuditLogRepository` filtered pagination in `src/audit/audit-log.repository.ts`
- [X] T101 [US10] Implement `GET /audit-logs` controller in `src/audit/audit.controller.ts` per README query params
- [X] T102 [US10] Verify all IC-02 catalog actions emit audit entries across modules (audit integration pass)

**Checkpoint**: Audit query returns historical `performedBy` ids after user delete (PD-10)

---

## Phase 13: User Story 11 — Auto-Assignment and Workload (Priority: P3)

**Goal**: Auto-assign on ticket create from ProjectMember DEVELOPER pool; workload endpoint

**Independent Test**: quickstart.md Scenario 11 — create without assignee assigns least-loaded member; empty pool → null; explicit assignee skips auto-assign; workload sorted

### Implementation for User Story 11

- [X] T103 [US11] Implement `AutoAssignService` in `src/tickets/auto-assign.service.ts` (BR-07, IC-11 ProjectMember pool, tie-break)
- [X] T104 [US11] Integrate auto-assign into ticket create in `src/tickets/tickets.service.ts` (create/import only, not PATCH)
- [X] T105 [US11] Add AUTO_ASSIGN SYSTEM audit on auto-assign in `src/tickets/tickets.service.ts`
- [X] T106 [US11] Implement `WorkloadRepository` aggregation query in `src/projects/workload.repository.ts`
- [X] T107 [US11] Implement `WorkloadService` in `src/projects/workload.service.ts` (IC-11 members only)
- [X] T108 [US11] Add `GET /projects/:projectId/workload` to `src/projects/projects.controller.ts`

**Checkpoint**: Auto-assign and workload share same ProjectMember pool; no bootstrap

---

## Phase 14: User Story 12 — Auto-Escalation (Priority: P3)

**Goal**: Background scheduler escalates overdue tickets one priority step per cycle (IC-07)

**Independent Test**: quickstart.md Scenario 12 — overdue ticket escalates; CRITICAL sets isOverdue; DONE skipped; manual priority clears isOverdue

### Implementation for User Story 12

- [X] T109 [US12] Implement `TicketEscalationService` in `src/tickets/ticket-escalation.service.ts` (BR-04, BR-06, IC-07, injectable Clock)
- [X] T110 [US12] Implement `EscalationJob` cron (`*/1 * * * *`) in `src/scheduler/escalation.job.ts`
- [X] T111 [US12] Create `SchedulerModule` registering `@nestjs/schedule` in `src/scheduler/scheduler.module.ts`
- [X] T112 [US12] Wire `SchedulerModule` in `src/app.module.ts` and import `TicketEscalationService`
- [X] T113 [US12] Add ESCALATE SYSTEM audit entries in `src/tickets/ticket-escalation.service.ts`
- [X] T114 [US12] Ensure `isOverdue` computed on ticket read responses in `src/tickets/tickets.service.ts`

**Checkpoint**: Escalation runs every minute; does not change ticket status

---

## Phase 15: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, test coverage (NFR-03), e2e hardening, quickstart validation

- [X] T115 [P] Create e2e test helpers in `test/helpers/auth.helpers.ts` and `test/helpers/fixtures.ts`
- [X] T116 [P] Implement `test/auth.e2e-spec.ts` per plan.md E2E matrix rows 1–3
- [ ] T117 [P] Implement `test/users.e2e-spec.ts` per plan.md E2E matrix rows 4–8
- [ ] T118 [P] Implement `test/projects.e2e-spec.ts` per plan.md E2E matrix rows 9–17
- [ ] T119 [P] Implement `test/tickets.e2e-spec.ts` per plan.md E2E matrix rows 18–22, 25–26
- [ ] T120 [P] Implement `test/comments.e2e-spec.ts` per plan.md E2E matrix rows 27–29
- [ ] T121 [P] Implement `test/dependencies.e2e-spec.ts` per plan.md E2E matrix rows 32–34
- [ ] T122 [P] Implement `test/attachments.e2e-spec.ts` per plan.md E2E matrix rows 35–36
- [ ] T123 [P] Implement `test/import-export.e2e-spec.ts` per plan.md E2E matrix rows 23–24
- [ ] T124 [P] Implement `test/audit.e2e-spec.ts` per plan.md E2E matrix row 31
- [ ] T125 [P] Implement `test/concurrency.e2e-spec.ts` for IC-10 ticket and comment concurrent PATCH
- [ ] T126 [P] Implement `test/escalation.e2e-spec.ts` with injected Clock
- [ ] T127 [P] Implement `test/contract.e2e-spec.ts` README endpoint sweep (min. one happy path per route)
- [X] T128 [P] Add unit tests for `TicketStatusService` in `src/tickets/ticket-status.service.spec.ts`
- [ ] T129 [P] Add unit tests for `AutoAssignService` in `src/tickets/auto-assign.service.spec.ts`
- [X] T130 [P] Add unit tests for `MentionParserService` in `src/comments/mention-parser.service.spec.ts`
- [ ] T131 [P] Add unit tests for `CsvImportService` in `src/tickets/csv-import.service.spec.ts`
- [ ] T132 [P] Add unit tests for `TicketEscalationService` in `src/tickets/ticket-escalation.service.spec.ts`
- [ ] T133 [P] Add unit tests for `UsersService` delete cascade in `src/users/users.service.spec.ts`
- [X] T134 Create `run.md` at repository root with setup, migrate, seed ADMIN credentials, MVP login semantics (PD-09)
- [X] T135 Update `docs/prompts.md` with implementation prompt log per constitution deliverable
- [ ] T136 Run quickstart.md validation scenarios and fix any gaps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **User Stories (Phases 3–14)**: Depend on Foundational completion
- **Polish (Phase 15)**: Depends on desired user stories being complete

### User Story Dependencies

| Story | Depends on | Notes |
|-------|------------|-------|
| US1 (P1) | Foundational | MVP entry point |
| US2 (P1) | US1 | JWT required for user endpoints |
| US3 (P1) | US2 | Projects reference `ownerId` users |
| US4 (P1) | US3 | Tickets belong to projects |
| US5 (P2) | US4 | Comments on tickets |
| US6 (P2) | US4 | Dependencies between tickets |
| US7 (P2) | US4 | Attachments on tickets |
| US8 (P2) | US3, US4 | CSV import/export tickets |
| US9 (P2) | US3, US4 | ADMIN restore builds on soft delete |
| US10 (P2) | US1+ | Audit query after mutations exist |
| US11 (P3) | US3, US4 | Auto-assign + workload need ProjectMember |
| US12 (P3) | US4 | Escalation operates on tickets |

### Within Each User Story

- DTOs/entities before services
- Services before controllers
- Core logic before audit integration
- Story checkpoint before next priority

### Parallel Opportunities

- All Setup tasks marked [P] (T006, T007)
- Entity creation T010–T019 (after T008–T009)
- Foundational T023, T024, T028 in parallel
- After Foundational: US5, US6, US7 can proceed in parallel once US4 completes
- US8, US9, US10 can overlap after US4/US3
- All Polish e2e tasks T116–T127 marked [P]
- All Polish unit tests T128–T133 marked [P]

---

## Parallel Example: User Story 1

```bash
# Parallel DTO + revocation service:
T034: src/auth/dto/
T035: src/auth/token-revocation.service.ts

# Then sequential: AuthService → JwtStrategy → Guard → Controller → Module
```

## Parallel Example: Foundational Entities

```bash
# After T008–T009, launch all entities together:
T010: src/users/entities/user.entity.ts
T011: src/auth/entities/revoked-token.entity.ts
T012: src/projects/entities/project.entity.ts
# ... through T019
```

## Parallel Example: Polish E2E

```bash
# After core stories complete, launch e2e files in parallel:
test/auth.e2e-spec.ts
test/users.e2e-spec.ts
test/projects.e2e-spec.ts
# ... etc.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (NestJS 11 upgrade first — T001–T003)
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: quickstart.md Scenario 1
5. Demo JWT-protected API shell

### Incremental Delivery (P1 Core)

1. Setup + Foundational → foundation ready
2. US1 → US2 → US3 → US4 (P1 chain)
3. Validate quickstart Scenarios 1–4
4. Add P2 stories (US5–US10) incrementally
5. Add P3 stories (US11–US12)
6. Polish: tests + run.md

### Suggested MVP Scope

**Minimum viable demo**: Phases 1–3 (Setup + Foundational + US1 Auth)

**Assignment core**: Phases 1–6 (through US4 Ticket Lifecycle)

---

## Notes

- NestJS 11 upgrade (T001–T003) MUST complete before all other implementation tasks
- README API contract is immutable — no new endpoints or response fields
- `synchronize: false` always — use migrations only
- IC-11: no DEVELOPER bootstrap; ProjectMember rows from explicit linkage only
- PD-09: document MVP login (no password verification) in `run.md` (T134)
- Commit after each task or logical group
- [P] tasks = different files, no incomplete dependencies
