# IssueFlow Backend — Setup and Run Guide

## Prerequisites

- Node.js 20 LTS
- Docker (for PostgreSQL)
- npm

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env
```

Default values connect to the Docker Compose PostgreSQL instance.

3. Start PostgreSQL:

```bash
docker compose -f compose.yml up -d
```

4. Build the application:

```bash
npm run build
```

5. Run database migrations (includes seeded ADMIN user):

```bash
npm run migration:run
```

## Seeded ADMIN Credentials

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password (stored, bcrypt) | `admin123` |

### MVP Login Semantics (PD-09)

`POST /auth/login` requires non-empty `username` and `password` per README. In MVP:

- Login succeeds when the username exists (case-insensitive).
- **Password is not verified** — any non-empty password works for existing users.
- Unknown username returns `401`.
- Users created via `POST /users` have no stored password; they log in by username existence only.

Example:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"any-non-empty-password"}'
```

## Run the Application

```bash
# Development (watch mode)
npm run start:dev

# Production build
npm run start:prod
```

API listens on `http://localhost:3000`.

## Run Tests

```bash
# Unit tests
npm test

# E2E tests (requires PostgreSQL running and migrations applied)
npm run test:e2e
```

## Migration Commands

```bash
npm run migration:run      # Apply pending migrations
npm run migration:revert   # Revert last migration
npm run migration:generate -- src/database/migrations/MigrationName
```

## Attachment Storage

Uploaded files are stored under `storage/attachments/` (gitignored). The directory is created automatically on startup.
