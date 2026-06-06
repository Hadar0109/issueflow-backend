/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const test = (lines) => ({ listen: 'test', script: { exec: lines, type: 'text/javascript' } });
const pre = (lines) => ({ listen: 'prerequest', script: { exec: lines, type: 'text/javascript' } });

const expectStatus = (code) =>
  test([`pm.test("Status is ${code}", () => pm.response.to.have.status(${code}));`]);

const saveToken = (varName = 'accessToken') =>
  test([
    'pm.test("Returns accessToken", () => {',
    '  const body = pm.response.json();',
    '  pm.expect(body.accessToken).to.be.a("string");',
    `  pm.environment.set("${varName}", body.accessToken);`,
    '});',
  ]);

const saveId = (field, envVar) =>
  test([
    `pm.test("Save ${envVar}", () => {`,
    `  const body = pm.response.json();`,
    `  pm.expect(body.${field}).to.exist;`,
    `  pm.environment.set("${envVar}", String(body.${field}));`,
    '});',
  ]);

const saveFirstArrayId = (envVar) =>
  test([
    `pm.test("Save ${envVar} from array", () => {`,
    '  const body = pm.response.json();',
    '  pm.expect(body).to.be.an("array");',
    '  if (body.length > 0) pm.environment.set("' + envVar + '", String(body[0].id));',
    '});',
  ]);

const rawJson = (obj) => ({
  mode: 'raw',
  raw: JSON.stringify(obj, null, 2),
  options: { raw: { language: 'json' } },
});

const url = (pathStr, query = []) => ({
  raw: `{{baseUrl}}${pathStr}`,
  host: ['{{baseUrl}}'],
  path: pathStr.replace(/^\//, '').split('/'),
  ...(query.length ? { query } : {}),
});

const req = (name, method, pathStr, opts = {}) => ({
  name,
  event: opts.events || [],
  request: {
    method,
    header: opts.headers || [{ key: 'Content-Type', value: 'application/json' }],
    body: opts.body,
    url: typeof pathStr === 'string' ? url(pathStr, opts.query) : pathStr,
    auth: opts.noAuth
      ? { type: 'noauth' }
      : opts.authOverride
        ? opts.authOverride
        : { type: 'bearer', bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }] },
    description: opts.description || '',
  },
  ...(opts.description ? { description: opts.description } : {}),
});

const folder = (name, items, description) => ({
  name,
  description,
  item: items,
});

const collection = {
  info: {
    _postman_id: 'issueflow-api-collection',
    name: 'IssueFlow API — Full QA',
    description:
      'End-to-end manual QA collection for IssueFlow backend. Import IssueFlow.postman_environment.json first. Run folder "00 Setup & Auth" before other modules. Uses seeded admin (admin/admin123). See MANUAL_TEST_PLAN.md for test case IDs and execution order.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
  },
  item: [
    folder('00 Setup & Auth', [
      req('AUTH-001 Login as admin (success)', 'POST', '/auth/login', {
        noAuth: true,
        body: rawJson({ username: '{{adminUsername}}', password: '{{adminPassword}}' }),
        events: [
          expectStatus(200),
          saveToken('accessToken'),
          test([
            'pm.environment.set("adminToken", pm.response.json().accessToken);',
            'pm.test("tokenType Bearer", () => pm.expect(pm.response.json().tokenType).to.eql("Bearer"));',
            'pm.test("expiresIn 3600", () => pm.expect(pm.response.json().expiresIn).to.eql(3600));',
          ]),
        ],
        description: 'TC-AUTH-001: Valid login returns JWT per README.',
      }),
      req('AUTH-002 GET /auth/me', 'GET', '/auth/me', {
        events: [
          expectStatus(200),
          test([
            'const u = pm.response.json();',
            'pm.test("Profile shape", () => {',
            '  pm.expect(u).to.have.keys("id","username","email","fullName","role");',
            '  pm.environment.set("adminUserId", String(u.id));',
            '});',
          ]),
        ],
        description: 'TC-AUTH-005: Authenticated profile.',
      }),
      req('AUTH-003 Login unknown username → 401', 'POST', '/auth/login', {
        noAuth: true,
        body: rawJson({ username: 'nonexistent_user_xyz', password: 'secret' }),
        events: [expectStatus(401)],
        description: 'TC-AUTH-002: Unknown username rejected.',
      }),
      req('AUTH-004 Login empty credentials → 401', 'POST', '/auth/login', {
        noAuth: true,
        body: rawJson({ username: '', password: '' }),
        events: [expectStatus(401)],
        description: 'TC-AUTH-003: Empty login fields rejected.',
      }),
      req('AUTH-005 Login case-insensitive username', 'POST', '/auth/login', {
        noAuth: true,
        body: rawJson({ username: 'ADMIN', password: 'any' }),
        events: [expectStatus(200)],
        description: 'TC-AUTH-004: Username match is case-insensitive (PD-09).',
      }),
      req('AUTH-006 Protected route without token → 401', 'GET', '/users', {
        noAuth: true,
        events: [expectStatus(401)],
        description: 'TC-AUTH-007 / AR-01: JWT required.',
      }),
      req('AUTH-007 Logout and save revoked token', 'POST', '/auth/logout', {
        events: [
          expectStatus(200),
          test(['pm.environment.set("revokedToken", pm.environment.get("adminToken"));']),
        ],
        description: 'TC-AUTH-006: Logout invalidates token.',
      }),
      req('AUTH-008 Re-login admin for subsequent tests', 'POST', '/auth/login', {
        noAuth: true,
        body: rawJson({ username: '{{adminUsername}}', password: '{{adminPassword}}' }),
        events: [expectStatus(200), saveToken('accessToken'), test(['pm.environment.set("adminToken", pm.response.json().accessToken);'])],
      }),
      req('AUTH-009 Revoked token → 401', 'GET', '/auth/me', {
        authOverride: { type: 'bearer', bearer: [{ key: 'token', value: '{{revokedToken}}', type: 'string' }] },
        events: [expectStatus(401)],
        description: 'TC-AUTH-008: Revoked JWT rejected (FR-AUTH-004).',
      }),
      req('AUTH-010 Re-login after revoke test', 'POST', '/auth/login', {
        noAuth: true,
        body: rawJson({ username: '{{adminUsername}}', password: '{{adminPassword}}' }),
        events: [expectStatus(200), saveToken('accessToken'), test(['pm.environment.set("adminToken", pm.response.json().accessToken);'])],
      }),
    ], 'Authentication flows. Run first.'),

    folder('01 Users', [
      req('USER-001 GET /users list', 'GET', '/users', {
        events: [expectStatus(200), test(['pm.test("Array", () => pm.expect(pm.response.json()).to.be.an("array"));'])],
        description: 'TC-USER-001: List all users.',
      }),
      req('USER-002 POST /users create DEVELOPER', 'POST', '/users', {
        body: rawJson({
          username: 'dev_{{testRunSuffix}}',
          email: 'dev_{{testRunSuffix}}@example.com',
          fullName: 'QA Developer {{testRunSuffix}}',
          role: 'DEVELOPER',
        }),
        events: [
          expectStatus(200),
          saveId('id', 'developerUserId'),
          test([
            'const u = pm.response.json();',
            'pm.environment.set("developerUsername", u.username);',
            'pm.test("Role DEVELOPER", () => pm.expect(u.role).to.eql("DEVELOPER"));',
          ]),
        ],
        description: 'TC-USER-002: Create user with README fields.',
      }),
      req('USER-003 Login as new DEVELOPER', 'POST', '/auth/login', {
        noAuth: true,
        body: rawJson({ username: '{{developerUsername}}', password: 'anypassword' }),
        events: [expectStatus(200), saveToken('developerToken')],
        description: 'TC-USER-003: PD-09 login by username existence.',
      }),
      req('USER-004 GET /users/:userId', 'GET', '/users/{{developerUserId}}', {
        events: [expectStatus(200)],
        description: 'TC-USER-004: Get user by ID.',
      }),
      req('USER-005 GET /users/:userId → 404', 'GET', '/users/{{invalidUserId}}', {
        events: [expectStatus(404)],
        description: 'TC-USER-005: Unknown user returns 404.',
      }),
      req('USER-006 POST /users/update/:userId', 'POST', '/users/update/{{developerUserId}}', {
        body: rawJson({ fullName: 'Updated QA Developer', role: 'DEVELOPER' }),
        events: [expectStatus(200), test(['pm.test("fullName updated", () => pm.expect(pm.response.json().fullName).to.eql("Updated QA Developer"));'])],
        description: 'TC-USER-006: Update fullName and role.',
      }),
      req('USER-007 POST /users/update empty body → 400', 'POST', '/users/update/{{developerUserId}}', {
        body: rawJson({}),
        events: [expectStatus(400)],
        description: 'TC-USER-007: At least one field required on update.',
      }),
      req('USER-008 POST /users whitespace username → 400', 'POST', '/users', {
        body: rawJson({
          username: 'bad user',
          email: 'bad_{{testRunSuffix}}@example.com',
          fullName: 'Bad',
          role: 'DEVELOPER',
        }),
        events: [expectStatus(400)],
        description: 'TC-USER-008: Username must not contain whitespace.',
      }),
      req('USER-009 POST /users duplicate username → 409', 'POST', '/users', {
        body: rawJson({
          username: '{{developerUsername}}',
          email: 'dup_u_{{testRunSuffix}}@example.com',
          fullName: 'Dup',
          role: 'DEVELOPER',
        }),
        events: [expectStatus(409)],
        description: 'TC-USER-009: Case-insensitive username uniqueness.',
      }),
      req('USER-010 POST /users duplicate email → 409', 'POST', '/users', {
        body: rawJson({
          username: 'other_{{testRunSuffix}}',
          email: 'dev_{{testRunSuffix}}@example.com',
          fullName: 'Dup Email',
          role: 'DEVELOPER',
        }),
        events: [expectStatus(409)],
        description: 'TC-USER-010: Case-insensitive email uniqueness.',
      }),
      req('USER-011 POST /users invalid email → 400', 'POST', '/users', {
        body: rawJson({
          username: 'invalid_email_{{testRunSuffix}}',
          email: 'not-an-email',
          fullName: 'Bad Email',
          role: 'DEVELOPER',
        }),
        events: [expectStatus(400)],
        description: 'TC-USER-011: DTO email validation.',
      }),
      req('USER-012 POST /users invalid role → 400', 'POST', '/users', {
        body: rawJson({
          username: 'badrole_{{testRunSuffix}}',
          email: 'badrole_{{testRunSuffix}}@example.com',
          fullName: 'Bad Role',
          role: 'MANAGER',
        }),
        events: [expectStatus(400)],
        description: 'TC-USER-012: Role enum ADMIN|DEVELOPER only.',
      }),
      req('USER-013 Create second DEVELOPER for mentions', 'POST', '/users', {
        body: rawJson({
          username: 'dev2_{{testRunSuffix}}',
          email: 'dev2_{{testRunSuffix}}@example.com',
          fullName: 'QA Developer 2',
          role: 'DEVELOPER',
        }),
        events: [expectStatus(200), saveId('id', 'developer2UserId'), test(['pm.environment.set("developer2Username", pm.response.json().username);'])],
      }),
      req('USER-014 Create DEVELOPER project owner (for BR-14)', 'POST', '/users', {
        body: rawJson({
          username: 'owner_{{testRunSuffix}}',
          email: 'owner_{{testRunSuffix}}@example.com',
          fullName: 'Project Owner',
          role: 'DEVELOPER',
        }),
        events: [expectStatus(200), test(['pm.environment.set("ownerUserId", String(pm.response.json().id));'])],
      }),
    ], 'User registry CRUD and validation.'),

    folder('02 Projects', [
      req('PROJ-001 POST /projects (ADMIN owner)', 'POST', '/projects', {
        body: rawJson({
          name: 'QA Admin Project {{testRunSuffix}}',
          description: 'Admin-owned project for QA',
          ownerId: '{{adminUserId}}',
        }),
        events: [expectStatus(200), saveId('id', 'projectId')],
        description: 'TC-PROJ-001: Create project with valid ownerId.',
      }),
      req('PROJ-002 POST /projects (DEVELOPER owner)', 'POST', '/projects', {
        body: rawJson({
          name: 'QA Dev Project {{testRunSuffix}}',
          description: 'Developer-owned project for auto-assign',
          ownerId: '{{developerUserId}}',
        }),
        events: [expectStatus(200), saveId('id', 'projectId2')],
        description: 'TC-PROJ-002: DEVELOPER owner linked as ProjectMember (IC-11).',
      }),
      req('PROJ-003 GET /projects list', 'GET', '/projects', {
        events: [expectStatus(200)],
        description: 'TC-PROJ-003: Active projects only.',
      }),
      req('PROJ-004 GET /projects/:projectId', 'GET', '/projects/{{projectId}}', {
        events: [expectStatus(200)],
        description: 'TC-PROJ-004: Get project by ID.',
      }),
      req('PROJ-005 GET /projects/:projectId → 404', 'GET', '/projects/{{invalidProjectId}}', {
        events: [expectStatus(404)],
        description: 'TC-PROJ-005: Unknown project 404.',
      }),
      req('PROJ-006 PATCH /projects/:projectId', 'PATCH', '/projects/{{projectId}}', {
        body: rawJson({ name: 'Updated QA Project', description: 'Updated desc' }),
        events: [expectStatus(200)],
        description: 'TC-PROJ-006: Update name and description.',
      }),
      req('PROJ-007 POST /projects invalid owner → 400', 'POST', '/projects', {
        body: rawJson({ name: 'Bad Owner', description: '', ownerId: 999999 }),
        events: [expectStatus(400)],
        description: 'TC-PROJ-007: ownerId must reference existing user.',
      }),
      req('PROJ-008 GET /projects/:projectId/workload (ADMIN owner → empty)', 'GET', '/projects/{{projectId}}/workload', {
        events: [expectStatus(200), test(['pm.test("No ADMIN in workload", () => pm.expect(pm.response.json()).to.be.an("array").that.is.empty);'])],
        description: 'TC-PROJ-008 / BR-08: ADMIN excluded from workload pool.',
      }),
      req('PROJ-009 GET /projects/:projectId/workload (DEVELOPER owner)', 'GET', '/projects/{{projectId2}}/workload', {
        events: [
          expectStatus(200),
          test([
            'const w = pm.response.json();',
            'pm.test("Developer in workload", () => {',
            '  pm.expect(w.length).to.be.at.least(1);',
            '  pm.expect(w[0]).to.have.keys("userId","username","openTicketCount");',
            '});',
          ]),
        ],
        description: 'TC-PROJ-009: Workload lists project DEVELOPERs.',
      }),
    ], 'Project management and workload.'),

    folder('03 Tickets', [
      req('TKT-001 POST /tickets with explicit assignee', 'POST', '/tickets', {
        body: rawJson({
          title: 'QA Ticket Explicit Assignee',
          description: 'Assigned to developer',
          status: 'TODO',
          priority: 'HIGH',
          type: 'BUG',
          projectId: '{{projectId}}',
          assigneeId: '{{developerUserId}}',
          dueDate: '2099-06-01T00:00:00.000Z',
        }),
        events: [
          expectStatus(200),
          saveId('id', 'ticketId'),
          test([
            'const t = pm.response.json();',
            'pm.test("assigneeId set", () => pm.expect(String(t.assigneeId)).to.eql(pm.environment.get("developerUserId")));',
            'pm.test("isOverdue present", () => pm.expect(t).to.have.property("isOverdue");',
          ]),
        ],
        description: 'TC-TKT-001: Create ticket with all README fields.',
      }),
      req('TKT-002 POST /tickets auto-assign (no assigneeId)', 'POST', '/tickets', {
        body: rawJson({
          title: 'QA Ticket Auto Assign',
          description: 'Should auto-assign to dev project owner',
          status: 'TODO',
          priority: 'MEDIUM',
          type: 'FEATURE',
          projectId: '{{projectId2}}',
        }),
        events: [
          expectStatus(200),
          saveId('id', 'ticketId2'),
          test([
            'pm.test("Auto-assigned to dev owner", () => pm.expect(String(pm.response.json().assigneeId)).to.eql(pm.environment.get("developerUserId")));',
          ]),
        ],
        description: 'TC-TKT-002 / BR-07: Auto-assign on create when assigneeId omitted.',
      }),
      req('TKT-003 GET /tickets?projectId=', 'GET', '/tickets', {
        query: [{ key: 'projectId', value: '{{projectId}}' }],
        events: [expectStatus(200)],
        description: 'TC-TKT-003: List tickets by project.',
      }),
      req('TKT-004 GET /tickets/:ticketId', 'GET', '/tickets/{{ticketId}}', {
        events: [expectStatus(200)],
        description: 'TC-TKT-004: Get ticket by ID.',
      }),
      req('TKT-005 PATCH status forward TODO→IN_PROGRESS', 'PATCH', '/tickets/{{ticketId}}', {
        body: rawJson({ status: 'IN_PROGRESS' }),
        events: [expectStatus(200)],
        description: 'TC-TKT-005 / BR-01: Forward status transition.',
      }),
      req('TKT-006 PATCH backward status → 400', 'PATCH', '/tickets/{{ticketId}}', {
        body: rawJson({ status: 'TODO' }),
        events: [expectStatus(400)],
        description: 'TC-TKT-006 / BR-01: Backward transition rejected.',
      }),
      req('TKT-007 PATCH type field → 400', 'PATCH', '/tickets/{{ticketId}}', {
        body: rawJson({ type: 'FEATURE' }),
        events: [expectStatus(400)],
        description: 'TC-TKT-007: type is immutable on PATCH.',
      }),
      req('TKT-008 PATCH priority clears isOverdue flag', 'PATCH', '/tickets/{{ticketId}}', {
        body: rawJson({ priority: 'LOW' }),
        events: [expectStatus(200), test(['pm.test("isOverdue false", () => pm.expect(pm.response.json().isOverdue).to.eql(false));'])],
        description: 'TC-TKT-008 / BR-05: Manual priority change clears isOverdue.',
      }),
      req('TKT-009 Create blocker and blocked tickets', 'POST', '/tickets', {
        body: rawJson({
          title: 'Blocker Ticket',
          status: 'TODO',
          priority: 'HIGH',
          type: 'BUG',
          projectId: '{{projectId}}',
        }),
        events: [expectStatus(200), saveId('id', 'blockerTicketId')],
      }),
      req('TKT-010 Create blocked ticket', 'POST', '/tickets', {
        body: rawJson({
          title: 'Blocked Ticket',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          type: 'BUG',
          projectId: '{{projectId}}',
        }),
        events: [expectStatus(200), saveId('id', 'blockedTicketId')],
      }),
      req('TKT-011 POST add blocker dependency', 'POST', '/tickets/{{blockedTicketId}}/dependencies', {
        body: rawJson({ blockedBy: '{{blockerTicketId}}' }),
        events: [expectStatus(200)],
        description: 'Setup for TKT-012: link blocker before DONE transition test.',
      }),
      req('TKT-012 PATCH to DONE with open blocker → 400', 'PATCH', '/tickets/{{blockedTicketId}}', {
        body: rawJson({ status: 'DONE' }),
        events: [expectStatus(400)],
        description: 'TC-TKT-011 / BR-12: DONE blocked by unresolved direct blocker.',
      }),
      req('TKT-013 PATCH invalid assignee → 400', 'PATCH', '/tickets/{{ticketId}}', {
        body: rawJson({ assigneeId: 999999 }),
        events: [expectStatus(400)],
        description: 'TC-TKT-012: assigneeId must reference existing user.',
      }),
      req('TKT-014 POST /tickets on deleted project → 404', 'POST', '/tickets', {
        body: rawJson({
          title: 'Orphan',
          status: 'TODO',
          priority: 'LOW',
          type: 'BUG',
          projectId: '{{deletedProjectId}}',
        }),
        events: [expectStatus(404)],
        description: 'TC-TKT-013 / Edge-1: Soft-deleted project. Run SD-003 first.',
      }),
      req('TKT-015 POST /tickets invalid enum → 400', 'POST', '/tickets', {
        body: rawJson({
          title: 'Bad Enum',
          status: 'OPEN',
          priority: 'HIGH',
          type: 'BUG',
          projectId: '{{projectId}}',
        }),
        events: [expectStatus(400)],
        description: 'TC-TKT-014: Status enum validation.',
      }),
      req('TKT-016 GET /tickets/:ticketId → 404', 'GET', '/tickets/{{invalidTicketId}}', {
        events: [expectStatus(404)],
        description: 'TC-TKT-015: Unknown ticket 404.',
      }),
      req('TKT-017 Advance blocked ticket to IN_REVIEW then DONE after blocker done', 'PATCH', '/tickets/{{blockerTicketId}}', {
        body: rawJson({ status: 'IN_PROGRESS' }),
        events: [expectStatus(200)],
        description: 'Setup: advance blocker through lifecycle.',
      }),
      req('TKT-018 Blocker IN_REVIEW', 'PATCH', '/tickets/{{blockerTicketId}}', {
        body: rawJson({ status: 'IN_REVIEW' }),
        events: [expectStatus(200)],
      }),
      req('TKT-019 Blocker DONE (unblocks dependent)', 'PATCH', '/tickets/{{blockerTicketId}}', {
        body: rawJson({ status: 'DONE' }),
        events: [expectStatus(200)],
        description: 'TC-TKT-016: Blocker resolved allows DONE on dependent.',
      }),
      req('TKT-020 Blocked ticket DONE success', 'PATCH', '/tickets/{{blockedTicketId}}', {
        body: rawJson({ status: 'IN_REVIEW' }),
        events: [expectStatus(200)],
      }),
      req('TKT-021 Blocked ticket to DONE', 'PATCH', '/tickets/{{blockedTicketId}}', {
        body: rawJson({ status: 'DONE' }),
        events: [expectStatus(200)],
        description: 'TC-TKT-017 / BR-02: DONE ticket then immutable.',
      }),
      req('TKT-022 PATCH DONE ticket → 400', 'PATCH', '/tickets/{{blockedTicketId}}', {
        body: rawJson({ title: 'Cannot change' }),
        events: [expectStatus(400)],
        description: 'TC-TKT-018 / BR-02: DONE immutability.',
      }),
    ], 'Ticket lifecycle, status rules, validation.'),

    folder('04 Comments', [
      req('CMT-001 POST /tickets/:ticketId/comments with @mention', 'POST', '/tickets/{{ticketId}}/comments', {
        authOverride: { type: 'bearer', bearer: [{ key: 'token', value: '{{developerToken}}', type: 'string' }] },
        body: rawJson({
          authorId: '{{developerUserId}}',
          content: 'Hello @dev2_{{testRunSuffix}} and @unknownuser please review',
        }),
        events: [
          expectStatus(200),
          saveId('id', 'commentId'),
          test([
            'const c = pm.response.json();',
            'pm.environment.set("mentionedUserId", pm.environment.get("developer2UserId"));',
            'pm.test("One known mention", () => pm.expect(c.mentionedUsers).to.have.lengthOf(1));',
            'pm.test("mentionedUsers shape", () => pm.expect(c.mentionedUsers[0]).to.have.keys("id","username","fullName"));',
          ]),
        ],
        description: 'TC-CMT-001 / BR-15: @mention case-insensitive; unknown ignored.',
      }),
      req('CMT-002 GET /tickets/:ticketId/comments', 'GET', '/tickets/{{ticketId}}/comments', {
        events: [expectStatus(200)],
        description: 'TC-CMT-002: List comments for ticket.',
      }),
      req('CMT-003 PATCH comment re-evaluate mentions', 'PATCH', '/tickets/{{ticketId}}/comments/{{commentId}}', {
        authOverride: { type: 'bearer', bearer: [{ key: 'token', value: '{{developerToken}}', type: 'string' }] },
        body: rawJson({ content: 'Updated mention @owner_{{testRunSuffix}}' }),
        events: [expectStatus(200)],
        description: 'TC-CMT-003 / BR-15: Mention re-parse on update.',
      }),
      req('CMT-004 POST comment authorId mismatch → 400', 'POST', '/tickets/{{ticketId}}/comments', {
        authOverride: { type: 'bearer', bearer: [{ key: 'token', value: '{{developerToken}}', type: 'string' }] },
        body: rawJson({ authorId: '{{adminUserId}}', content: 'Wrong author' }),
        events: [expectStatus(400)],
        description: 'TC-CMT-004 / AR-04: authorId must match JWT.',
      }),
      req('CMT-005 POST comment empty content → 400', 'POST', '/tickets/{{ticketId}}/comments', {
        authOverride: { type: 'bearer', bearer: [{ key: 'token', value: '{{developerToken}}', type: 'string' }] },
        body: rawJson({ authorId: '{{developerUserId}}', content: '' }),
        events: [expectStatus(400)],
        description: 'TC-CMT-005: content required non-empty.',
      }),
      req('CMT-006 PATCH comment by non-author → 400', 'PATCH', '/tickets/{{ticketId}}/comments/{{commentId}}', {
        body: rawJson({ content: 'Admin trying to edit' }),
        events: [expectStatus(400)],
        description: 'TC-CMT-006: Only comment author may edit.',
      }),
      req('CMT-007 DELETE comment by author', 'DELETE', '/tickets/{{ticketId}}/comments/{{commentId}}', {
        authOverride: { type: 'bearer', bearer: [{ key: 'token', value: '{{developerToken}}', type: 'string' }] },
        events: [expectStatus(200)],
        description: 'TC-CMT-007: Author deletes own comment.',
      }),
      req('CMT-008 Comment on soft-deleted ticket → 404', 'POST', '/tickets/{{deletedTicketId}}/comments', {
        authOverride: { type: 'bearer', bearer: [{ key: 'token', value: '{{developerToken}}', type: 'string' }] },
        body: rawJson({ authorId: '{{developerUserId}}', content: 'Too late' }),
        events: [expectStatus(404)],
        description: 'TC-CMT-008 / Edge-24: Soft-deleted ticket. Run SD-001 first.',
      }),
    ], 'Comments and @mentions.'),

    folder('05 Dependencies', [
      req('DEP-001 POST add dependency (same project)', 'POST', '/tickets/{{blockedTicketId}}/dependencies', {
        body: rawJson({ blockedBy: '{{blockerTicketId}}' }),
        events: [expectStatus(200)],
        description: 'TC-DEP-001: Add blocker relationship.',
      }),
      req('DEP-002 GET list dependencies', 'GET', '/tickets/{{blockedTicketId}}/dependencies', {
        events: [
          expectStatus(200),
          test(['pm.test("Blocker listed", () => pm.expect(pm.response.json().some(d => String(d.id) === pm.environment.get("blockerTicketId"))).to.be.true);']),
        ],
        description: 'TC-DEP-002: List direct blockers.',
      }),
      req('DEP-003 POST self-dependency → 400', 'POST', '/tickets/{{blockedTicketId}}/dependencies', {
        body: rawJson({ blockedBy: '{{blockedTicketId}}' }),
        events: [expectStatus(400)],
        description: 'TC-DEP-003 / BR-12: Self-dependency rejected.',
      }),
      req('DEP-004 POST cross-project dependency → 400', 'POST', '/tickets/{{blockedTicketId}}/dependencies', {
        body: rawJson({ blockedBy: '{{ticketId2}}' }),
        events: [expectStatus(400)],
        description: 'TC-DEP-004: Cross-project dependency rejected.',
      }),
      req('DEP-005 POST circular dependency allowed', 'POST', '/tickets/{{blockerTicketId}}/dependencies', {
        body: rawJson({ blockedBy: '{{blockedTicketId}}' }),
        events: [expectStatus(200)],
        description: 'TC-DEP-005 / BR-12 / Edge-19: Circular deps allowed for MVP.',
      }),
      req('DEP-006 DELETE dependency', 'DELETE', '/tickets/{{blockedTicketId}}/dependencies/{{blockerTicketId}}', {
        events: [expectStatus(200)],
        description: 'TC-DEP-006: Remove blocker link.',
      }),
      req('DEP-007 DELETE unknown dependency → 404', 'DELETE', '/tickets/{{blockedTicketId}}/dependencies/{{invalidTicketId}}', {
        events: [expectStatus(404)],
        description: 'TC-DEP-007: Unknown dependency 404.',
      }),
    ], 'Ticket dependency blockers.'),

    folder('06 Attachments', [
      req('ATT-001 POST upload PNG attachment', 'POST', '/tickets/{{ticketId}}/attachments', {
        header: [],
        body: {
          mode: 'formdata',
          formdata: [
            {
              key: 'file',
              type: 'file',
              src: [],
              description: 'Select a valid PNG/JPEG/PDF/TXT file ≤10MB (use test/fixtures or any small image).',
            },
          ],
        },
        events: [
          test([
            'pm.test("Status 200", () => pm.response.to.have.status(200));',
            'if (pm.response.code === 200) {',
            '  const a = pm.response.json();',
            '  pm.environment.set("attachmentId", String(a.id));',
            '  pm.test("Response shape", () => pm.expect(a).to.have.keys("id","ticketId","filename","contentType"));',
            '}',
          ]),
        ],
        description: 'TC-ATT-001: Valid file upload. Manually attach file in Postman.',
      }),
      req('ATT-002 DELETE attachment', 'DELETE', '/tickets/{{ticketId}}/attachments/{{attachmentId}}', {
        events: [expectStatus(200)],
        description: 'TC-ATT-002: Delete attachment.',
      }),
      req('ATT-003 POST upload without file → 400', 'POST', '/tickets/{{ticketId}}/attachments', {
        header: [],
        body: { mode: 'formdata', formdata: [] },
        events: [expectStatus(400)],
        description: 'TC-ATT-003: File required.',
      }),
      req('ATT-004 POST upload on deleted ticket → 404', 'POST', '/tickets/{{deletedTicketId}}/attachments', {
        header: [],
        body: {
          mode: 'formdata',
          formdata: [{ key: 'file', type: 'file', src: [], description: 'Attach any valid file' }],
        },
        events: [expectStatus(404)],
        description: 'TC-ATT-004 / Edge-24: Soft-deleted ticket. Run SD-001 first.',
      }),
    ], 'File attachments. ATT-001 requires manual file selection.'),

    folder('07 Import & Export', [
      req('CSV-001 GET export tickets CSV', 'GET', '/tickets/export', {
        query: [{ key: 'projectId', value: '{{projectId}}' }],
        header: [],
        events: [
          expectStatus(200),
          test([
            'pm.test("Content-Type CSV", () => pm.expect(pm.response.headers.get("Content-Type")).to.include("text/csv"));',
            'pm.test("Has header row", () => pm.expect(pm.response.text).to.include("title"));',
          ]),
        ],
        description: 'TC-CSV-001 / BR-17: Export active project tickets.',
      }),
      req('CSV-002 POST import partial success CSV', 'POST', '/tickets/import', {
        header: [],
        body: {
          mode: 'formdata',
          formdata: [
            {
              key: 'file',
              type: 'file',
              src: [],
              description: 'Create CSV: title,description,status,priority,type,assigneeId\\nValid,,,,,\\n,empty title,,,,',
            },
            { key: 'projectId', value: '{{projectId}}', type: 'text' },
          ],
        },
        events: [
          expectStatus(200),
          test([
            'const b = pm.response.json();',
            'pm.test("Summary shape", () => pm.expect(b).to.have.keys("created","failed","errors"));',
          ]),
        ],
        description: 'TC-CSV-002 / BR-16: Row-level partial success. Attach CSV manually or use pre-request script.',
      }),
      req('CSV-003 POST import header-only CSV', 'POST', '/tickets/import', {
        header: [],
        body: {
          mode: 'formdata',
          formdata: [
            { key: 'file', type: 'file', src: [], description: 'CSV with header row only' },
            { key: 'projectId', value: '{{projectId}}', type: 'text' },
          ],
        },
        events: [
          test([
            'pm.test("Status 200", () => pm.response.to.have.status(200));',
            'pm.test("created 0", () => pm.expect(pm.response.json().created).to.eql(0));',
          ]),
        ],
        description: 'TC-CSV-003 / Edge-17: Header-only import.',
      }),
      req('CSV-004 POST import missing file → 400', 'POST', '/tickets/import', {
        header: [],
        body: {
          mode: 'formdata',
          formdata: [{ key: 'projectId', value: '{{projectId}}', type: 'text' }],
        },
        events: [expectStatus(400)],
        description: 'TC-CSV-004: CSV file required.',
      }),
      req('CSV-005 POST import with invalid enum row', 'POST', '/tickets/import', {
        header: [],
        body: {
          mode: 'formdata',
          formdata: [
            {
              key: 'file',
              type: 'file',
              src: [],
              description: 'CSV: title\\nGood,BADSTATUS,,,,',
            },
            { key: 'projectId', value: '{{projectId}}', type: 'text' },
          ],
        },
        events: [expectStatus(200)],
        description: 'TC-CSV-005 / BR-16: Invalid enum fails row; valid rows still created.',
      }),
    ], 'CSV export/import. Several requests need manual CSV file attachment.'),

    folder('08 Soft Delete & Restore', [
      req('SD-001 DELETE /tickets/:ticketId soft-delete', 'DELETE', '/tickets/{{ticketId2}}', {
        events: [
          expectStatus(200),
          test(['pm.environment.set("deletedTicketId", pm.environment.get("ticketId2"));']),
        ],
        description: 'TC-SD-001: Soft-delete ticket.',
      }),
      req('SD-002 GET deleted ticket → 404', 'GET', '/tickets/{{deletedTicketId}}', {
        events: [expectStatus(404)],
        description: 'TC-SD-002 / BR-09: Soft-deleted hidden from standard routes.',
      }),
      req('SD-003 DELETE /projects/:projectId soft-delete', 'DELETE', '/projects/{{projectId}}', {
        events: [
          expectStatus(200),
          test(['pm.environment.set("deletedProjectId", pm.environment.get("projectId"));']),
        ],
        description: 'TC-SD-003 / BR-10: Project delete cascades tickets.',
      }),
      req('SD-004 GET /tickets/deleted as DEVELOPER → 403', 'GET', '/tickets/deleted', {
        query: [{ key: 'projectId', value: '{{projectId2}}' }],
        authOverride: { type: 'bearer', bearer: [{ key: 'token', value: '{{developerToken}}', type: 'string' }] },
        events: [expectStatus(403)],
        description: 'TC-SD-004 / AR-03: ADMIN-only deleted list.',
      }),
      req('SD-005 GET /tickets/deleted as ADMIN', 'GET', '/tickets/deleted', {
        query: [{ key: 'projectId', value: '{{projectId2}}' }],
        events: [expectStatus(200)],
        description: 'TC-SD-005: ADMIN lists soft-deleted tickets.',
      }),
      req('SD-006 POST /tickets/:ticketId/restore', 'POST', '/tickets/{{deletedTicketId}}/restore', {
        events: [expectStatus(200)],
        description: 'TC-SD-006: ADMIN restores ticket.',
      }),
      req('SD-007 GET /projects/deleted as DEVELOPER → 403', 'GET', '/projects/deleted', {
        authOverride: { type: 'bearer', bearer: [{ key: 'token', value: '{{developerToken}}', type: 'string' }] },
        events: [expectStatus(403)],
        description: 'TC-SD-007 / AR-03: Non-ADMIN restore access denied.',
      }),
      req('SD-008 GET /projects/deleted as ADMIN', 'GET', '/projects/deleted', {
        events: [expectStatus(200)],
        description: 'TC-SD-008: ADMIN lists deleted projects.',
      }),
      req('SD-009 POST /projects/:projectId/restore', 'POST', '/projects/{{deletedProjectId}}/restore', {
        events: [expectStatus(200)],
        description: 'TC-SD-009 / BR-11: Restore project and cascade-restored tickets.',
      }),
      req('SD-010 POST restore as DEVELOPER → 403', 'POST', '/tickets/{{deletedTicketId}}/restore', {
        authOverride: { type: 'bearer', bearer: [{ key: 'token', value: '{{developerToken}}', type: 'string' }] },
        events: [expectStatus(403)],
        description: 'TC-SD-010: Non-ADMIN cannot restore.',
      }),
    ], 'Soft delete and ADMIN restore flows.'),

    folder('09 Mentions & Workload', [
      req('MEN-001 GET /users/:userId/mentions', 'GET', '/users/{{developer2UserId}}/mentions', {
        query: [
          { key: 'page', value: '1' },
          { key: 'pageSize', value: '10' },
        ],
        events: [
          expectStatus(200),
          test([
            'const b = pm.response.json();',
            'pm.test("Paginated shape", () => {',
            '  pm.expect(b).to.have.keys("data","total","page");',
            '  pm.expect(b.data).to.be.an("array");',
            '});',
          ]),
        ],
        description: 'TC-MEN-001: Paginated mentions newest first.',
      }),
      req('MEN-002 GET mentions for deleted user → 404', 'GET', '/users/{{invalidUserId}}/mentions', {
        events: [expectStatus(404)],
        description: 'TC-MEN-002 / Edge-6: Unknown/deleted user 404.',
      }),
      req('WL-001 GET workload sorted ascending', 'GET', '/projects/{{projectId2}}/workload', {
        events: [
          expectStatus(200),
          test([
            'const w = pm.response.json();',
            'if (w.length >= 2) {',
            '  pm.test("Sorted by openTicketCount", () => pm.expect(w[0].openTicketCount).to.be.at.most(w[1].openTicketCount));',
            '}',
          ]),
        ],
        description: 'TC-WL-001 / BR-08: Workload sorted ascending.',
      }),
    ], 'Mentions API and workload verification.'),

    folder('10 Audit Log', [
      req('AUD-001 GET /audit-logs (all)', 'GET', '/audit-logs', {
        events: [
          expectStatus(200),
          test([
            'pm.test("Array of audit entries", () => {',
            '  const logs = pm.response.json();',
            '  pm.expect(logs).to.be.an("array");',
            '  if (logs.length) pm.expect(logs[0]).to.have.keys("id","action","entityType","entityId","performedBy","actor","timestamp");',
            '});',
          ]),
        ],
        description: 'TC-AUD-001: Audit log readable.',
      }),
      req('AUD-002 GET filter entityType=TICKET', 'GET', '/audit-logs', {
        query: [
          { key: 'entityType', value: 'TICKET' },
          { key: 'entityId', value: '{{ticketId}}' },
        ],
        events: [expectStatus(200)],
        description: 'TC-AUD-002: Filter by entityType and entityId.',
      }),
      req('AUD-003 GET filter actor=SYSTEM', 'GET', '/audit-logs', {
        query: [{ key: 'actor', value: 'SYSTEM' }],
        events: [
          expectStatus(200),
          test([
            'const logs = pm.response.json();',
            'pm.test("SYSTEM actor entries", () => {',
            '  logs.forEach(l => pm.expect(l.actor).to.eql("SYSTEM"));',
            '});',
          ]),
        ],
        description: 'TC-AUD-003 / FR-AUD-003: System actions distinguishable.',
      }),
      req('AUD-004 GET filter action=AUTO_ASSIGN', 'GET', '/audit-logs', {
        query: [{ key: 'action', value: 'AUTO_ASSIGN' }],
        events: [expectStatus(200)],
        description: 'TC-AUD-004 / BR-07: Auto-assign auditable.',
      }),
    ], 'Audit log queries.'),

    folder('11 User Delete & BR-14/BR-18', [
      req('BR14-001 Create project for owner block test', 'POST', '/projects', {
        body: rawJson({
          name: 'Owner Block Project {{testRunSuffix}}',
          description: 'Blocks owner delete',
          ownerId: '{{ownerUserId}}',
        }),
        events: [expectStatus(200)],
      }),
      req('BR14-002 DELETE owner user → 409', 'DELETE', '/users/{{ownerUserId}}', {
        events: [expectStatus(409)],
        description: 'TC-USER-015 / BR-14: Project owner delete blocked.',
      }),
      req('BR14-003 Create assignee-blocked developer', 'POST', '/users', {
        body: rawJson({
          username: 'assignee_{{testRunSuffix}}',
          email: 'assignee_{{testRunSuffix}}@example.com',
          fullName: 'Active Assignee',
          role: 'DEVELOPER',
        }),
        events: [expectStatus(200), test(['pm.environment.set("assigneeUserId", String(pm.response.json().id));'])],
      }),
      req('BR14-004 Create ticket with non-DONE assignee', 'POST', '/tickets', {
        body: rawJson({
          title: 'Blocks user delete',
          status: 'IN_PROGRESS',
          priority: 'LOW',
          type: 'BUG',
          projectId: '{{projectId2}}',
          assigneeId: '{{assigneeUserId}}',
        }),
        events: [expectStatus(200)],
      }),
      req('BR14-005 DELETE assignee on active ticket → 409', 'DELETE', '/users/{{assigneeUserId}}', {
        events: [expectStatus(409)],
        description: 'TC-USER-016 / BR-14: Active assignee blocks delete.',
      }),
      req('BR18-001 Create deletable developer with DONE ticket', 'POST', '/users', {
        body: rawJson({
          username: 'deletable_{{testRunSuffix}}',
          email: 'deletable_{{testRunSuffix}}@example.com',
          fullName: 'Deletable Dev',
          role: 'DEVELOPER',
        }),
        events: [expectStatus(200), test(['pm.environment.set("deletableUserId", String(pm.response.json().id));'])],
      }),
      req('BR18-002 Login deletable user', 'POST', '/auth/login', {
        noAuth: true,
        body: rawJson({ username: 'deletable_{{testRunSuffix}}', password: 'x' }),
        events: [expectStatus(200), test(['pm.environment.set("deletableToken", pm.response.json().accessToken);'])],
      }),
      req('BR18-003 Create DONE ticket for deletable user', 'POST', '/tickets', {
        body: rawJson({
          title: 'Done ticket for delete test',
          status: 'DONE',
          priority: 'LOW',
          type: 'BUG',
          projectId: '{{projectId2}}',
          assigneeId: '{{deletableUserId}}',
        }),
        events: [expectStatus(200), test(['pm.environment.set("deletableTicketId", String(pm.response.json().id));'])],
      }),
      req('BR18-004 User adds comment before delete', 'POST', '/tickets/{{deletableTicketId}}/comments', {
        authOverride: { type: 'bearer', bearer: [{ key: 'token', value: '{{deletableToken}}', type: 'string' }] },
        body: rawJson({ authorId: '{{deletableUserId}}', content: 'Will cascade delete' }),
        events: [expectStatus(200)],
      }),
      req('BR18-005 DELETE user success (cascade)', 'DELETE', '/users/{{deletableUserId}}', {
        events: [expectStatus(200)],
        description: 'TC-USER-017 / BR-18: Hard delete with cascade.',
      }),
      req('BR18-006 GET deleted user → 404', 'GET', '/users/{{deletableUserId}}', {
        events: [expectStatus(404)],
        description: 'TC-USER-018: User gone after hard delete.',
      }),
      req('BR18-007 Deleted user JWT → 401', 'GET', '/auth/me', {
        authOverride: { type: 'bearer', bearer: [{ key: 'token', value: '{{deletableToken}}', type: 'string' }] },
        events: [expectStatus(401)],
        description: 'TC-USER-019 / Edge-8: Deleted user token invalid.',
      }),
      req('BR18-008 Audit retains performedBy after user delete', 'GET', '/audit-logs', {
        query: [
          { key: 'entityType', value: 'USER' },
          { key: 'entityId', value: '{{deletableUserId}}' },
          { key: 'action', value: 'DELETE' },
        ],
        events: [
          expectStatus(200),
          test([
            'const logs = pm.response.json();',
            'pm.test("performedBy retained", () => {',
            '  pm.expect(logs.length).to.be.at.least(1);',
            '  pm.expect(logs[0].performedBy).to.be.a("number");',
            '});',
          ]),
        ],
        description: 'TC-USER-020 / PD-10: Audit performedBy preserved.',
      }),
    ], 'User delete guards and cascade (run after core flows).'),

    folder('12 Security & Validation', [
      req('SEC-001 Invalid JWT → 401', 'GET', '/users', {
        authOverride: { type: 'bearer', bearer: [{ key: 'token', value: 'invalid.jwt.token', type: 'string' }] },
        events: [expectStatus(401)],
        description: 'TC-SEC-001: Malformed JWT rejected.',
      }),
      req('SEC-002 forbidNonWhitelisted extra fields → 400', 'POST', '/users', {
        body: rawJson({
          username: 'extra_{{testRunSuffix}}',
          email: 'extra_{{testRunSuffix}}@example.com',
          fullName: 'Extra Fields',
          role: 'DEVELOPER',
          password: 'should-not-be-here',
        }),
        events: [expectStatus(400)],
        description: 'TC-SEC-002: ValidationPipe forbidNonWhitelisted.',
      }),
      req('SEC-003 DEVELOPER can access ADMIN-only list → 403', 'GET', '/projects/deleted', {
        authOverride: { type: 'bearer', bearer: [{ key: 'token', value: '{{developerToken}}', type: 'string' }] },
        events: [expectStatus(403)],
        description: 'TC-SEC-003 / AR-03: Role gate on soft-delete admin routes.',
      }),
      req('SEC-004 DEVELOPER can create tickets (AR-05)', 'POST', '/tickets', {
        authOverride: { type: 'bearer', bearer: [{ key: 'token', value: '{{developerToken}}', type: 'string' }] },
        body: rawJson({
          title: 'Dev created ticket',
          status: 'TODO',
          priority: 'LOW',
          type: 'BUG',
          projectId: '{{projectId2}}',
        }),
        events: [expectStatus(200)],
        description: 'TC-SEC-004 / AR-05: No extra role gates beyond ADMIN soft-delete.',
      }),
      req('SEC-005 Manual ADMIN assignee allowed', 'POST', '/tickets', {
        body: rawJson({
          title: 'Admin as assignee',
          status: 'TODO',
          priority: 'LOW',
          type: 'BUG',
          projectId: '{{projectId2}}',
          assigneeId: '{{adminUserId}}',
        }),
        events: [expectStatus(200)],
        description: 'TC-SEC-005 / Edge-13: Explicit assignee may be ADMIN.',
      }),
    ], 'Security, authorization, and global validation.'),

    folder('13 Concurrency (Manual Runner)', [
      req('CONC-000 Create comment for concurrency test', 'POST', '/tickets/{{ticketId}}/comments', {
        authOverride: { type: 'bearer', bearer: [{ key: 'token', value: '{{developerToken}}', type: 'string' }] },
        body: rawJson({ authorId: '{{developerUserId}}', content: 'Concurrency target @dev2_{{testRunSuffix}}' }),
        events: [expectStatus(200), saveId('id', 'commentId')],
      }),
      req('CONC-001 PATCH ticket (run twice in parallel)', 'PATCH', '/tickets/{{blockedTicketId}}', {
        body: rawJson({ description: 'concurrent-edit-{{$timestamp}}' }),
        events: [
          test([
            'pm.test("Status 200 or 409", () => pm.expect([200, 409]).to.include(pm.response.code));',
            'if (pm.response.code === 409) {',
            '  pm.test("Conflict message", () => pm.expect(pm.response.json().message).to.include("updated by another request"));',
            '}',
          ]),
        ],
        description: 'TC-CONC-001 / IC-10: Run this request twice simultaneously via Collection Runner (2 iterations, delay 0). Expect one 200 and one 409.',
      }),
      req('CONC-002 PATCH comment (run twice in parallel)', 'PATCH', '/tickets/{{ticketId}}/comments/{{commentId}}', {
        authOverride: { type: 'bearer', bearer: [{ key: 'token', value: '{{developerToken}}', type: 'string' }] },
        body: rawJson({ content: 'concurrent-{{$timestamp}} @dev2_{{testRunSuffix}}' }),
        events: [
          test([
            'pm.test("Status 200 or 409", () => pm.expect([200, 409]).to.include(pm.response.code));',
          ]),
        ],
        description: 'TC-CONC-002: Create a comment first, set commentId, run twice in parallel. Expect one 409.',
      }),
    ], 'Concurrency tests require Postman Collection Runner with 2 parallel iterations or two clients.'),
  ],
};

const outPath = path.join(__dirname, 'IssueFlow.postman_collection.json');
fs.writeFileSync(outPath, JSON.stringify(collection, null, 2));
console.log('Wrote', outPath, 'with', collection.item.length, 'folders');
