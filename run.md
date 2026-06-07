# IssueFlow Backend — Setup and Run Guide

## Prerequisites

- Node.js 20 LTS
- Docker (for PostgreSQL)
- npm

---

## 1. Install and configure

From the project root:

```bash
npm install
cp .env.example .env
```

---

## 2. Start PostgreSQL

```bash
docker compose -f compose.yml up -d db
```

---

## 3. Prepare the database

```bash
npm run build
npm run migration:run
```

Migrations create the database schema and seed an initial ADMIN user.

---

## 4. Start the API

```bash
npm run start:dev
```

The server runs at **http://localhost:3000**. Leave this terminal open.

---

## 5. First Login (Required)

Use the seeded ADMIN account:

| Field    | Value      |
|----------|------------|
| Username | `admin`    |
| Password | `admin123` |

Example:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
```

The response contains a JWT access token required for protected endpoints.

---

##  Authentication Notes

- The seeded ADMIN user authenticates with bcrypt.
- Users created via POST /users are created without a password.
- On first login, the supplied password is hashed and stored.
- Subsequent logins verify the stored hash.
- Invalid credentials return 401 Unauthorized.

---

## Attachment Storage

Uploaded files are stored under `storage/attachments/`. 

The directory is created automatically on startup.

---

## Run Tests

```bash
# Unit tests
npm test

# E2E tests (requires PostgreSQL running and migrations applied)
npm run test:e2e
```

---


