# AI Usage Documentation

## Model Used
Cursor with [write here the model name shown in Cursor]

## Main Prompts

### Initial Requirements and Skeleton Analysis
You are helping me start a Spec-Driven Development workflow for the IssueFlow backend assignment.

Do not implement anything.
Do not modify files yet.

First, read the assignment requirements file:
docs/TDP_issueflow_requirements.pdf

Then analyze the provided project skeleton.

Create a complete initial analysis report that includes:

1. Assignment feature inventory
2. Business rules and constraints
3. Existing project structure and technology stack
4. Gap analysis between the assignment and the current skeleton
5. Risks, edge cases, and unclear requirements
6. Recommended next steps before creating the specification

The assignment requirements are the source of truth.
Do not assume functionality that is not written there.

### Constitution Prompt
/speckit.constitution

Create the project constitution for IssueFlow.

Use the assignment requirements, README API contract, and previous analysis as context.

Do not implement anything.

The constitution should define only long-term project principles and constraints, not feature-specific behavior.

Include sections for:

* Engineering Principles
* Architectural Principles
* Security Principles
* Validation and Error Handling
* Testing Principles
* Documentation Requirements
* AI-Assisted Development Workflow

The constitution should establish principles such as:

* Assignment requirements are the behavioral source of truth.
* README API contract compatibility must be preserved.
* Specification before implementation.
* Spec → Plan → Tasks → Implementation workflow.
* NestJS modular architecture.
* PostgreSQL with TypeORM.
* JWT authentication by default.
* Consistent validation and error handling.
* Auditability and traceability.
* Soft-delete-first data lifecycle strategy.
* Secure handling of uploaded files.
* Separation of concerns and testable business logic.
* Documentation requirements (run.md and prompts.md).
* AI-generated work must be documented.

### Specification Prompt
/speckit.specify

Create the complete IssueFlow specification.

Use:

* the assignment requirements
* the README API contract
* the approved Constitution
* all previous analysis and decision reviews

Do not implement anything.

The specification should fully define:

* Functional requirements
* User stories
* Acceptance criteria
* Business rules
* Validation rules
* Authorization rules
* Data requirements
* Non-functional requirements
* Error scenarios
* Edge cases
* Assumptions

Resolve all remaining ambiguities through explicitly documented assumptions.

The specification should be complete enough that a plan and task list can later be generated without introducing new behavior or making additional product decisions.

### Planning Prompt
/speckit-plan

Create the implementation plan for IssueFlow based on the approved specification.

Use the existing specification, constitution, decision log, checklist, README, and assignment requirements as the source of truth.

Requirements:
1. Do not implement code.
2. Produce a complete implementation plan in standard Spec Kit format.
3. Preserve the README API contract exactly.
4. Reflect all approved product decisions from the decision log.
5. Resolve IC-10 (concurrent updates) and document the rationale.
6. Resolve IC-11 (DEVELOPER “in the project” interpretation) and document the rationale.
7. Define the proposed architecture, modules, entities, services, repositories, authentication flow, validation strategy, background jobs, audit logging, file storage, and testing approach.
8. Identify risks, assumptions, and tradeoffs where relevant.
9. Do not modify the specification unless a genuine contradiction is found.

The goal is to produce a planning document that is ready for task generation and implementation.

### Design Review Before
Perform a final pre-task review of the planning artifacts.

Verify alignment between the assignment PDF, README API contract, spec.md, decision-log.md, plan.md, data model, contracts, and testing strategy.

Focus on:

* Missing requirements, business rules, validations, authorization checks, edge cases, or test coverage
* Contradictions between the plan, spec, assignment requirements, and README contract
* IC-10 and IC-11 correctness and coverage
* Verify NestJS 10 vs NestJS 11 compatibility with the assignment requirements.
* PD-09 authentication design and whether a first-login password bootstrap flow would be more appropriate than username-only authentication
* E2E coverage for all README endpoints and critical edge cases
* Audit logging completeness for all state-changing actions

Report only concrete findings, severity, and recommended fixes.

Do not generate tasks or implement code.
Only perform the review.

### Plan Updates After Design Review
Please update the planning artifacts based on the review findings.

Apply the following changes:

1. Update the planned stack to NestJS 11.
2. Re-evaluate IC-11 ("DEVELOPER in the project").
Consider an alternative design based on an internal `ProjectMember` entity/table (without adding new API endpoints) and compare it to the current Option A approach.
If the alternative is superior, update the planning artifacts accordingly.
Otherwise, keep the current approach and document the rationale clearly.
3. Extend the audit design to explicitly cover project cascade soft-delete and restore operations, including affected tickets.
4. Complete the validation strategy with the missing validation rules identified in the review.
5. Add the missing edge cases to the quickstart and testing coverage.
6. Add an explicit README endpoint → E2E coverage matrix.
7. Keep PD-09 as currently approved and document the rationale and expected behavior clearly.
8. Define the user deletion strategy and resolve the referential integrity / foreign-key behavior.

Do not generate tasks.
Do not implement code.

Update the planning artifacts only and provide a summary of the changes made.

### Tasks Prompt
/speckit-tasks

### Task Structure Review
Before implementation, please do a quick architectural review of the generated task structure.

In particular, explain the reasoning behind:

* Comments + Mentions being grouped together
* Soft Delete / Restore being a separate story
* Audit Query placement
* Auto-Assignment + Workload grouping

For each, briefly compare alternative structures and confirm whether you would keep the current design unchanged.

### Security Review Prompt
[paste security review prompt]

### Edge Case Review Prompt
[paste edge cases prompt]

### Testing Strategy Prompt
[paste testing prompt]

### Implementation Prompt
/speckit-implement

Execute the full implementation plan from `specs/001-issueflow-backend/tasks.md`:

- Upgrade skeleton to NestJS 11 (IC-08)
- Implement all 12 user stories with README-aligned API contract
- TypeORM migrations (InitialSchema + SeedAdminUser)
- JWT auth with deny-list, audit logging, soft delete/restore
- ProjectMember (IC-11), pessimistic locks (IC-10), escalation scheduler (IC-07)
- E2E and unit tests per plan.md Testing Approach
- `run.md` with PD-09 MVP login semantics