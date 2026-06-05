<!--
Sync Impact Report
==================
Version change: 1.0.0 → 1.1.1
Modified principles:
  - II. README API Contract Compatibility → II. README as Primary API Contract (strengthened)
  - Added VI. Assumption Documentation
  - Documentation Requirements § II aligned with README-as-primary-contract principle
Added sections:
  - Engineering Principles
  - Architectural Principles
  - Security Principles
  - Validation and Error Handling
  - Testing Principles
  - Documentation Requirements
  - AI-Assisted Development Workflow
  - Governance
Removed sections: Core Principles (template), generic SECTION_2/SECTION_3 placeholders
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ updated (Constitution Check gates)
  - .specify/templates/spec-template.md ⚠ no change required (generic)
  - .specify/templates/tasks-template.md ⚠ no change required (generic)
Follow-up TODOs: None
-->

# IssueFlow Constitution

## Engineering Principles

### I. Assignment Requirements as Behavioral Source of Truth

The TDP IssueFlow assignment requirements (`docs/TDP_issueflow_requirements.pdf`) define
what the system MUST do. All specifications, plans, and implementations MUST trace back to
those requirements. Functionality not described in the assignment MUST NOT be invented
without an explicit, documented assumption approved during specification or clarification.

**Rationale**: The assignment is the grading contract; undocumented features create
review risk and scope creep.

### II. README as Primary API Contract

`README.md` MUST be treated as the primary API contract for all HTTP surface area.
Documented endpoint paths, request bodies, response bodies, and status codes MUST be
preserved in implementation. Where the assignment PDF defines behavioral rules not
expressed in README tables, those rules MUST still be honored without altering the
published API shape.

When README and PDF conflict on HTTP contract details, the PDF governs behavior but
the README contract MUST NOT be redesigned to resolve the gap. Conflicts and gaps MUST
be resolved through documented assumptions in the feature specification, not through
new endpoints, renamed fields, or undocumented response changes.

**Rationale**: Graders and clients depend on the README tables; API redesign introduces
grading risk and breaks traceability from spec to implementation.

### III. Specification Before Implementation

No production feature code MAY be written before a feature specification exists under
`specs/`. Ambiguities MUST be resolved or recorded as documented assumptions in the
spec before planning or coding begins. Implementation MUST NOT proceed directly from
informal notes or ad-hoc requests when a spec-driven workflow applies.

**Rationale**: Spec-first delivery reduces rework and keeps behavior auditable.

### IV. Spec → Plan → Tasks → Implementation Workflow

Development MUST follow the Spec Kit sequence:

1. **Constitution** — project-wide principles (this document)
2. **Specify** — feature `spec.md` with user stories and acceptance criteria
3. **Clarify** — resolve underspecified areas before planning (when needed)
4. **Plan** — `plan.md`, data model, and contracts derived from the spec
5. **Tasks** — dependency-ordered `tasks.md` derived from the plan
6. **Implement** — execute tasks against the plan and spec

Skipping a phase requires an explicit, documented justification in the feature artifacts.

**Rationale**: Ordered artifacts create a reviewable chain from requirements to code.

### V. Simplicity and Minimal Scope

Implement the simplest solution that satisfies the assignment and README contract.
Avoid frameworks, abstractions, or infrastructure not required by the spec. Complexity
MUST be justified in the implementation plan when it cannot be avoided.

**Rationale**: Take-home scope is large; unnecessary abstraction slows delivery and review.

### VI. Assumption Documentation

Every assumption made to resolve ambiguity in the assignment or README contract MUST be
explicitly documented in the relevant feature specification under a dedicated
**Assumptions** (or equivalent) section. Assumptions MUST state what is unclear, what was
decided, and why that decision was chosen.

Assumptions MUST remain traceable throughout planning and implementation: the
implementation plan MUST reference spec assumptions it depends on, and tasks MUST NOT
introduce behavior that contradicts or silently extends documented assumptions. New
assumptions discovered during planning or implementation MUST be added to the spec
before dependent work proceeds.

**Rationale**: Explicit assumptions prevent silent scope drift and keep grading,
review, and implementation aligned.

---

## Architectural Principles

### I. NestJS Modular Architecture

The application MUST be organized as NestJS feature modules (e.g., users, auth,
projects, tickets) with clear boundaries. Each module owns its controllers, services,
and persistence adapters. Shared cross-cutting concerns (guards, filters, interceptors,
schedulers) MUST live in dedicated infrastructure modules, not inside feature controllers.

**Rationale**: Modularity matches domain boundaries and supports incremental delivery.

### II. PostgreSQL with TypeORM

Persistent state MUST use PostgreSQL, provisioned locally via `compose.yml`. Data access
MUST use TypeORM entities and migrations. Schema changes MUST be versioned through
migrations; relying on synchronize-only schema drift in shared or production-like
environments is prohibited.

**Rationale**: The skeleton and assignment prescribe this stack; migrations preserve
auditability of schema evolution.

### III. Separation of Concerns and Testable Business Logic

HTTP controllers MUST remain thin: validate input, invoke services, map responses.
Business rules (status transitions, escalation, assignment, mention parsing, import
validation) MUST live in injectable services or pure functions that can be unit-tested
without HTTP or database coupling where practical. Direct database access from
controllers is prohibited.

**Rationale**: Testable services keep complex assignment rules maintainable and verifiable.

### IV. Soft-Delete-First Data Lifecycle

Where the assignment requires soft delete (tickets and projects), destructive API
operations MUST hide records from standard queries rather than physically remove them.
Recovery and audit paths MUST remain available per assignment rules. Hard delete MUST
NOT be exposed through the public API for those entities.

**Rationale**: Aligns with assignment extended requirements and preserves history.

### V. Auditability and Traceability

Every state-changing action performed by users or the system MUST be capable of being
recorded in a persistent, append-only audit log as required by the assignment. Audit
concerns MUST be implemented as a cross-cutting capability, not duplicated ad hoc per
endpoint. Log entries MUST be attributable (user or system actor) and queryable.

**Rationale**: Audit logging is an explicit extended requirement and supports debugging.

---

## Security Principles

### I. JWT Authentication by Default

All API endpoints MUST require a valid JWT unless an endpoint is explicitly documented
as public in the feature specification (e.g., login). Authentication MUST be enforced
via NestJS guards applied globally or per-module, not optional per-handler defaults.
Token invalidation on logout MUST be supported per assignment requirements.

**Rationale**: Assignment Section 2.2 mandates JWT protection of the API surface.

### II. Credential and Secret Handling

Passwords MUST be stored using a strong one-way hash (e.g., bcrypt); plaintext storage
is prohibited. Secrets (JWT signing keys, database credentials) MUST come from
environment configuration, never from source control. `.env` and credential files MUST
remain gitignored.

**Rationale**: Basic security hygiene for an authentication-backed API.

### III. Secure Handling of Uploaded Files

File uploads MUST enforce assignment size and content-type constraints before
persistence. Validation MUST NOT rely on client-supplied filenames or MIME types alone
where spoofing is possible. Uploaded content MUST be stored outside web-served static
paths by default. Attachment deletion MUST remove associated stored content.

**Rationale**: Assignment Section 3.3 defines upload constraints; uploads are a common
attack surface.

### IV. Least Privilege in Authorization

Role-based restrictions defined in the assignment (e.g., ADMIN-only operations) MUST be
enforced server-side via guards or policies. Client-supplied role or identity fields
MUST NOT be trusted over the authenticated JWT identity where the two could conflict.

**Rationale**: Server-side authorization is the only enforceable control in a REST API.

---

## Validation and Error Handling

### I. Reject Invalid Input at the Boundary

All incoming request data MUST be validated before business logic runs. Enum fields,
required fields, formats, and assignment-defined constraints MUST be rejected at the
API boundary using NestJS validation pipes and explicit domain validators. Invalid values
MUST NOT reach persistence layers.

**Rationale**: Assignment Section 4.1 prohibits allowing invalid values into the API.

### II. Consistent Error Response Shape

Errors MUST return informative messages through a single, project-wide exception filter
format. HTTP status codes MUST reflect error category consistently (client error,
auth failure, not found, conflict). Validation failures and business-rule violations
MUST be distinguishable in message content. Ad-hoc error shapes per module are
prohibited.

**Rationale**: Predictable errors simplify testing, grading, and client integration.

### III. Fail Closed

When authentication, authorization, or validation cannot be determined, the system MUST
deny the operation. Partial or best-effort acceptance of ambiguous input is prohibited
unless explicitly documented in the feature spec.

**Rationale**: Ambiguous permissive behavior creates security and data-integrity risk.

---

## Testing Principles

### I. Key Behaviors Must Be Tested

The implementation MUST include automated tests covering assignment-critical behaviors.
Tests are not optional for core domains (authentication, ticket lifecycle, soft delete,
dependencies, import/export, and extended features). Test scope MUST be proportional to
business risk and spec acceptance criteria.

**Rationale**: Assignment Section 4.3 requires relevant tests for key behaviors.

### II. Test Pyramid Discipline

Unit tests MUST cover pure business rules and validators. Integration tests MUST cover
persistence, transactions, and module wiring. End-to-end tests MUST verify HTTP
contracts against README-documented endpoints. Time-dependent behavior (schedulers) MUST
be tested with injected or controlled clocks, not arbitrary sleeps.

**Rationale**: Layered tests catch regressions without a single brittle e2e-only suite.

### III. Tests as Living Specification

Tests MUST reflect spec acceptance scenarios where feasible. When behavior changes, the
spec and tests MUST be updated together. Failing tests MUST NOT be disabled to pass CI
without a documented spec amendment.

**Rationale**: Keeps the spec → implementation chain honest through execution.

---

## Documentation Requirements

### I. Runtime Documentation (`run.md`)

The repository MUST include `run.md` with exact, reproducible steps to: install
dependencies, start the database, build the project, run the application, and run tests.
Commands MUST match the actual project setup (npm, Docker Compose, NestJS scripts).

**Rationale**: Assignment Sections 4.4 and 5 require documented setup and execution.

### II. API and Behavioral Documentation

`README.md` remains the published API contract and MUST NOT be redesigned to resolve
ambiguity. Feature-level design detail lives under `specs/` (spec, plan, tasks), and
feature specifications MUST adapt to the README contract for all HTTP surface area.
Behavioral rules from the assignment PDF that are not expressed in README tables MUST
still be honored in implementation without altering documented endpoints, request bodies,
response bodies, or status codes.

Where README and PDF diverge, the PDF governs behavior. Contract ambiguities MUST be
resolved through documented assumptions in the feature specification, not through API
redesign.

**Rationale**: Keeps the public API contract stable while behavioral detail and
assumptions live in traceable feature artifacts.

### III. AI Usage Documentation (`prompts.md`)

AI-assisted work MUST be documented in `prompts.md`, including the model used and
representative prompts that shaped specifications, plans, and implementation. Skills,
instructions, and agent context files used during development MUST be committed per
assignment Section 4.5.

**Rationale**: Assignment requires transparency and accountability for AI-assisted code.

---

## AI-Assisted Development Workflow

### I. Human Accountability

The submitter is fully accountable for all code in the repository, including
AI-generated code. AI output MUST be reviewed for correctness, security, and alignment
with the assignment before merge. Blind paste of unreviewed agent output is prohibited.

**Rationale**: Assignment Section 4.5 explicitly states submitter accountability.

### II. Agents Follow the Same Workflow

AI agents MUST respect this constitution and the Spec Kit workflow. Agents MUST NOT
skip specification, invent undocumented APIs, or implement features outside the current
`tasks.md` scope unless explicitly directed. Constitution and spec conflicts MUST be
raised to the human before proceeding.

**Rationale**: Prevents agent scope drift on a large, rule-heavy assignment.

### III. Document Agent Decisions

Material assumptions, clarifications, and design choices made during agent sessions MUST
be captured in feature specs or `prompts.md`. Session-only oral reasoning that never
reaches committed artifacts is insufficient for submission quality.

**Rationale**: Reviewers and future maintainers cannot evaluate undocumented decisions.

---

## Governance

This constitution supersedes informal conventions when they conflict. Amendments MUST:

1. Update `.specify/memory/constitution.md` with a clear version bump
2. Record rationale in the Sync Impact Report comment at the top of the file
3. Propagate changes to dependent templates (`plan-template.md` Constitution Check, etc.)
4. Set `LAST_AMENDED` to the amendment date

**Versioning policy**:

- **MAJOR**: Principle removed or redefined incompatibly
- **MINOR**: New principle or materially expanded section
- **PATCH**: Clarifications and non-semantic wording fixes

**Compliance**: Every implementation plan MUST include a Constitution Check gate
confirming adherence before Phase 0 research and again after Phase 1 design. Task
execution MUST NOT begin until the plan passes the initial gate.

**Runtime guidance**: Feature specs under `specs/` hold feature-specific behavior;
this constitution holds durable project principles only.

**Version**: 1.1.1 | **Ratified**: 2026-06-05 | **Last Amended**: 2026-06-05
