# AI Usage Documentation

## Model Used
Cursor with [write here the model name shown in Cursor]

## Main Prompts

### 1. Initial Requirements and Skeleton Analysis
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

### 2. Constitution Prompt
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

### 2. Specification Prompt
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

### 3. Planning Prompt
[paste the /speckit.plan prompt]

### 4. Tasks Prompt
[paste the /speckit.tasks prompt]

### 5. Security Review Prompt
[paste security review prompt]

### 6. Edge Case Review Prompt
[paste edge cases prompt]

### 7. Testing Strategy Prompt
[paste testing prompt]