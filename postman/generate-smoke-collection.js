/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Generates IssueFlow-Smoke.postman_collection.json — critical-path subset (~20 requests, <15 min).
 * Run: node postman/generate-smoke-collection.js
 */
const fs = require('fs');
const path = require('path');

const test = (lines) => ({ listen: 'test', script: { exec: lines, type: 'text/javascript' } });

const expectStatus = (code) =>
  test([`pm.test("Status is ${code}", () => pm.response.to.have.status(${code}));`]);

const saveToken = (varName = 'accessToken') =>
  test([
    'const body = pm.response.json();',
    `pm.environment.set("${varName}", body.accessToken);`,
    'pm.test("Has accessToken", () => pm.expect(body.accessToken).to.be.a("string"));',
  ]);

const saveId = (field, envVar) =>
  test([
    `const body = pm.response.json();`,
    `pm.environment.set("${envVar}", String(body.${field}));`,
    `pm.test("Saved ${envVar}", () => pm.expect(body.${field}).to.exist);`,
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

const bearer = (tokenVar = '{{accessToken}}') => ({
  type: 'bearer',
  bearer: [{ key: 'token', value: tokenVar, type: 'string' }],
});

const req = (name, method, pathStr, opts = {}) => ({
  name,
  event: opts.events || [],
  request: {
    method,
    header: opts.headers || [{ key: 'Content-Type', value: 'application/json' }],
    body: opts.body,
    url: url(pathStr, opts.query),
    auth: opts.noAuth ? { type: 'noauth' } : bearer(opts.tokenVar),
    description: opts.description || '',
  },
});

const smokeItems = [
  req('01 Login admin', 'POST', '/auth/login', {
    noAuth: true,
    body: rawJson({ username: '{{adminUsername}}', password: '{{adminPassword}}' }),
    events: [
      expectStatus(200),
      saveToken('accessToken'),
      test([
        'pm.environment.set("adminToken", pm.response.json().accessToken);',
        'pm.test("Bearer tokenType", () => pm.expect(pm.response.json().tokenType).to.eql("Bearer"));',
      ]),
    ],
    description: 'SMK-AUTH: JWT login (FR-AUTH-002).',
  }),

  req('02 GET /auth/me', 'GET', '/auth/me', {
    events: [
      expectStatus(200),
      test([
        'const u = pm.response.json();',
        'pm.environment.set("adminUserId", String(u.id));',
        'pm.test("Profile fields", () => pm.expect(u).to.include.keys("id","username","email","fullName","role"));',
      ]),
    ],
    description: 'SMK-AUTH: Authenticated identity (FR-AUTH-005).',
  }),

  req('03 Create DEVELOPER user', 'POST', '/users', {
    body: rawJson({
      username: 'smoke_dev_{{testRunSuffix}}',
      email: 'smoke_dev_{{testRunSuffix}}@example.com',
      fullName: 'Smoke Developer',
      role: 'DEVELOPER',
    }),
    events: [
      expectStatus(200),
      saveId('id', 'developerUserId'),
      test(['pm.environment.set("developerUsername", pm.response.json().username);']),
    ],
    description: 'SMK-USER: Register developer (FR-USER-003).',
  }),

  req('04 Create second DEVELOPER (mention target)', 'POST', '/users', {
    body: rawJson({
      username: 'smoke_dev2_{{testRunSuffix}}',
      email: 'smoke_dev2_{{testRunSuffix}}@example.com',
      fullName: 'Smoke Developer 2',
      role: 'DEVELOPER',
    }),
    events: [expectStatus(200), saveId('id', 'developer2UserId')],
    description: 'SMK-USER: Second user for @mention test.',
  }),

  req('05 Login as DEVELOPER', 'POST', '/auth/login', {
    noAuth: true,
    body: rawJson({ username: '{{developerUsername}}', password: 'smoke' }),
    events: [expectStatus(200), saveToken('developerToken')],
    description: 'SMK-AUTH: Developer can authenticate (PD-09).',
  }),

  req('06 Create project (DEVELOPER owner)', 'POST', '/projects', {
    body: rawJson({
      name: 'Smoke Project {{testRunSuffix}}',
      description: 'Smoke test project',
      ownerId: '{{developerUserId}}',
    }),
    events: [expectStatus(200), saveId('id', 'projectId')],
    description: 'SMK-PROJ: Project container + ProjectMember link (IC-11).',
  }),

  req('07 Create ticket (auto-assign)', 'POST', '/tickets', {
    body: rawJson({
      title: 'Smoke ticket auto-assign',
      description: 'No explicit assignee',
      status: 'TODO',
      priority: 'HIGH',
      type: 'BUG',
      projectId: '{{projectId}}',
      dueDate: '2099-12-31T00:00:00.000Z',
    }),
    events: [
      expectStatus(200),
      saveId('id', 'ticketId'),
      test([
        'const t = pm.response.json();',
        'pm.test("Auto-assigned to dev owner", () => pm.expect(String(t.assigneeId)).to.eql(pm.environment.get("developerUserId")));',
        'pm.test("isOverdue present", () => pm.expect(t).to.have.property("isOverdue");',
      ]),
    ],
    description: 'SMK-TKT: Ticket create + auto-assign (BR-07, FR-TKT-012).',
  }),

  req('08 List tickets by project', 'GET', '/tickets', {
    query: [{ key: 'projectId', value: '{{projectId}}' }],
    events: [
      expectStatus(200),
      test([
        'pm.test("Contains created ticket", () => {',
        '  const ids = pm.response.json().map(t => String(t.id));',
        '  pm.expect(ids).to.include(pm.environment.get("ticketId"));',
        '});',
      ]),
    ],
    description: 'SMK-TKT: Project-scoped ticket list (FR-TKT-002).',
  }),

  req('09 PATCH ticket status forward', 'PATCH', '/tickets/{{ticketId}}', {
    body: rawJson({ status: 'IN_PROGRESS' }),
    events: [expectStatus(200), test(['pm.test("Status updated", () => pm.expect(pm.response.json().status).to.eql("IN_PROGRESS"));'])],
    description: 'SMK-TKT: Forward-only lifecycle (BR-01).',
  }),

  req('10 Create blocker ticket', 'POST', '/tickets', {
    body: rawJson({
      title: 'Smoke blocker ticket',
      status: 'TODO',
      priority: 'MEDIUM',
      type: 'BUG',
      projectId: '{{projectId}}',
    }),
    events: [expectStatus(200), saveId('id', 'blockerTicketId')],
    description: 'SMK-DEP: Setup blocker ticket.',
  }),

  req('11 Add ticket dependency', 'POST', '/tickets/{{ticketId}}/dependencies', {
    body: rawJson({ blockedBy: '{{blockerTicketId}}' }),
    events: [expectStatus(200)],
    description: 'SMK-DEP: Blocker relationship (FR-DEP-001).',
  }),

  req('12 List dependencies', 'GET', '/tickets/{{ticketId}}/dependencies', {
    events: [
      expectStatus(200),
      test([
        'pm.test("Blocker listed", () => {',
        '  pm.expect(pm.response.json().some(d => String(d.id) === pm.environment.get("blockerTicketId"))).to.be.true;',
        '});',
      ]),
    ],
    description: 'SMK-DEP: List direct blockers.',
  }),

  req('13 POST comment with @mention', 'POST', '/tickets/{{ticketId}}/comments', {
    tokenVar: '{{developerToken}}',
    body: rawJson({
      authorId: '{{developerUserId}}',
      content: 'Smoke test ping @smoke_dev2_{{testRunSuffix}}',
    }),
    events: [
      expectStatus(200),
      saveId('id', 'commentId'),
      test(['pm.test("Mention resolved", () => pm.expect(pm.response.json().mentionedUsers).to.have.lengthOf(1));']),
    ],
    description: 'SMK-CMT: Comment + @mention (FR-CMT-003, FR-MEN-002).',
  }),

  req('14 GET user mentions', 'GET', '/users/{{developer2UserId}}/mentions', {
    query: [
      { key: 'page', value: '1' },
      { key: 'pageSize', value: '10' },
    ],
    events: [
      expectStatus(200),
      test([
        'const b = pm.response.json();',
        'pm.test("Paginated mentions", () => {',
        '  pm.expect(b).to.have.keys("data","total","page");',
        '  pm.expect(b.total).to.be.at.least(1);',
        '});',
      ]),
    ],
    description: 'SMK-MEN: Mentions API (FR-MEN-001).',
  }),

  req('15 GET project workload', 'GET', '/projects/{{projectId}}/workload', {
    events: [
      expectStatus(200),
      test([
        'pm.test("Workload has dev owner", () => {',
        '  pm.expect(pm.response.json().some(w => String(w.userId) === pm.environment.get("developerUserId"))).to.be.true;',
        '});',
      ]),
    ],
    description: 'SMK-WL: Workload listing (BR-08).',
  }),

  req('16 Export tickets CSV', 'GET', '/tickets/export', {
    query: [{ key: 'projectId', value: '{{projectId}}' }],
    headers: [],
    events: [
      expectStatus(200),
      test([
        'pm.test("CSV content", () => {',
        '  pm.expect(pm.response.headers.get("Content-Type")).to.include("text/csv");',
        '  pm.expect(pm.response.text).to.include("title");',
        '});',
      ]),
    ],
    description: 'SMK-CSV: Export active tickets (FR-CSV-001).',
  }),

  req('17 Soft-delete ticket', 'DELETE', '/tickets/{{blockerTicketId}}', {
    events: [
      expectStatus(200),
      test(['pm.environment.set("deletedTicketId", pm.environment.get("blockerTicketId"));']),
    ],
    description: 'SMK-SD: Ticket soft-delete.',
  }),

  req('18 Verify deleted ticket hidden', 'GET', '/tickets/{{deletedTicketId}}', {
    events: [expectStatus(404)],
    description: 'SMK-SD: Soft-deleted hidden from standard route (BR-09).',
  }),

  req('19 ADMIN list deleted tickets', 'GET', '/tickets/deleted', {
    query: [{ key: 'projectId', value: '{{projectId}}' }],
    events: [
      expectStatus(200),
      test([
        'pm.test("Deleted ticket in admin list", () => {',
        '  pm.expect(pm.response.json().some(t => String(t.id) === pm.environment.get("deletedTicketId"))).to.be.true;',
        '});',
      ]),
    ],
    description: 'SMK-SD: ADMIN deleted-list (AR-03, FR-SD-001).',
  }),

  req('20 Restore deleted ticket', 'POST', '/tickets/{{deletedTicketId}}/restore', {
    events: [expectStatus(200)],
    description: 'SMK-SD: ADMIN restore ticket.',
  }),

  req('21 Verify audit log', 'GET', '/audit-logs', {
    query: [
      { key: 'entityType', value: 'TICKET' },
      { key: 'entityId', value: '{{ticketId}}' },
    ],
    events: [
      expectStatus(200),
      test([
        'const logs = pm.response.json();',
        'pm.test("CREATE audit exists", () => pm.expect(logs.some(l => l.action === "CREATE")).to.be.true);',
        'pm.test("Audit entry shape", () => {',
        '  if (logs.length) pm.expect(logs[0]).to.include.keys("action","entityType","entityId","performedBy","actor","timestamp");',
        '});',
      ]),
    ],
    description: 'SMK-AUD: State changes auditable (FR-AUD-001).',
  }),

  req('22 Logout admin', 'POST', '/auth/logout', {
    events: [expectStatus(200)],
    description: 'SMK-AUTH: Logout completes auth lifecycle (FR-AUTH-004).',
  }),
];

const collection = {
  info: {
    _postman_id: 'issueflow-smoke-collection',
    name: 'IssueFlow API — Smoke (Critical Path)',
    description:
      'Minimal end-to-end smoke suite (~22 requests, target <15 minutes). Validates auth, users, projects, tickets, dependencies, comments, mentions, workload, CSV export, soft-delete/restore, and audit log.\n\n**Prerequisites**: API running on {{baseUrl}}, migrations applied, seeded admin.\n\n**Run**: Select IssueFlow Local environment, set unique `testRunSuffix`, then **Run collection** (single folder, sequential). Reuses the same environment file as the full QA collection.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: bearer('{{accessToken}}'),
  item: [
    {
      name: 'Smoke — Critical Path E2E',
      description: 'Run this folder sequentially with Collection Runner. No manual file uploads required.',
      item: smokeItems,
    },
  ],
};

const outPath = path.join(__dirname, 'IssueFlow-Smoke.postman_collection.json');
fs.writeFileSync(outPath, JSON.stringify(collection, null, 2));
console.log('Wrote', outPath, '—', smokeItems.length, 'requests');
