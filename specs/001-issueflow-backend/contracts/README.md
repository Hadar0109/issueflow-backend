# IssueFlow API Contracts

**Feature**: `001-issueflow-backend`  
**Date**: 2026-06-06  
**Authority**: `README.md` is the primary HTTP contract. This directory mirrors and
annotates that contract for implementation and testing. **No endpoint paths, request
bodies, response bodies, or documented status codes may diverge from README.**

Behavioral rules from the assignment PDF and `spec.md` that do not appear in README tables
are implemented server-side without altering documented shapes.

---

## Contract Files

| File | Purpose |
|------|---------|
| [openapi.yaml](./openapi.yaml) | Machine-readable contract derived from README tables |
| [error-responses.md](./error-responses.md) | Standard error shape and status code mapping |

---

## Authentication

All endpoints except `POST /auth/login` require header:

```http
Authorization: Bearer <accessToken>
```

---

## Endpoint Index (README-aligned)

### Users

| Method | Path | Auth | Success |
|--------|------|------|---------|
| GET | `/users` | JWT | 200 |
| GET | `/users/:userId` | JWT | 200 / 404 |
| POST | `/users` | JWT | 200 |
| POST | `/users/update/:userId` | JWT | 200 |
| DELETE | `/users/:userId` | JWT | 200 / 409 |

### Authentication

| Method | Path | Auth | Success |
|--------|------|------|---------|
| POST | `/auth/login` | Public | 200 / 401 |
| POST | `/auth/logout` | JWT | 200 |
| GET | `/auth/me` | JWT | 200 |

### Projects

| Method | Path | Auth | Success |
|--------|------|------|---------|
| GET | `/projects` | JWT | 200 |
| GET | `/projects/:projectId` | JWT | 200 / 404 |
| POST | `/projects` | JWT | 200 |
| PATCH | `/projects/:projectId` | JWT | 200 |
| DELETE | `/projects/:projectId` | JWT | 200 |
| GET | `/projects/deleted` | JWT (ADMIN) | 200 / 403 |
| POST | `/projects/:projectId/restore` | JWT (ADMIN) | 200 / 403 |
| GET | `/projects/:projectId/workload` | JWT | 200 |

### Tickets

| Method | Path | Auth | Success |
|--------|------|------|---------|
| GET | `/tickets?projectId=` | JWT | 200 |
| GET | `/tickets/:ticketId` | JWT | 200 / 404 |
| POST | `/tickets` | JWT | 200 |
| PATCH | `/tickets/:ticketId` | JWT | 200 / 400 / 409 |
| DELETE | `/tickets/:ticketId` | JWT | 200 |
| GET | `/tickets/export?projectId=` | JWT | 200 (CSV) |
| POST | `/tickets/import` | JWT | 200 |
| GET | `/tickets/deleted?projectId=` | JWT (ADMIN) | 200 / 403 |
| POST | `/tickets/:ticketId/restore` | JWT (ADMIN) | 200 / 403 |

### Comments

| Method | Path | Auth | Success |
|--------|------|------|---------|
| GET | `/tickets/:ticketId/comments` | JWT | 200 / 404 |
| POST | `/tickets/:ticketId/comments` | JWT | 200 / 404 |
| PATCH | `/tickets/:ticketId/comments/:commentId` | JWT | 200 / 409 |
| DELETE | `/tickets/:ticketId/comments/:commentId` | JWT | 200 |

### Audit Log

| Method | Path | Auth | Success |
|--------|------|------|---------|
| GET | `/audit-logs` | JWT | 200 |

Query params: `entityType`, `entityId`, `action`, `actor` (all optional).

`performedBy` in responses is a nullable integer user id with **no** live-user guarantee
(PD-10): ids are retained after user hard-delete and may not resolve via `GET /users/:id`.

### Dependencies

| Method | Path | Auth | Success |
|--------|------|------|---------|
| POST | `/tickets/:ticketId/dependencies` | JWT | 200 / 400 |
| GET | `/tickets/:ticketId/dependencies` | JWT | 200 |
| DELETE | `/tickets/:ticketId/dependencies/:blockerId` | JWT | 200 |

### Attachments

| Method | Path | Auth | Success |
|--------|------|------|---------|
| POST | `/tickets/:ticketId/attachments` | JWT | 200 / 400 / 404 |
| DELETE | `/tickets/:ticketId/attachments/:attachmentId` | JWT | 200 |

Multipart field name: `file`.

### Mentions

| Method | Path | Auth | Success |
|--------|------|------|---------|
| GET | `/users/:userId/mentions` | JWT | 200 / 404 |

Query params: `page`, `pageSize` (optional).

---

## Response Shapes (from README)

See `openapi.yaml` for full schemas. Field naming is **camelCase** per README examples.

**Not added to responses** (internal only): `deletedWithProjectId`, `passwordHash`, `storagePath`,
`ProjectMember`, `version`, `updatedAt` on PATCH bodies.

**Login response** (unchanged):

```json
{ "accessToken": "<jwt>", "tokenType": "Bearer", "expiresIn": 3600 }
```

**Import response** (unchanged):

```json
{ "created": 42, "failed": 3, "errors": ["Row 2: invalid status"] }
```

**Mentions paginated response** (unchanged):

```json
{ "data": [...], "total": 10, "page": 1 }
```

---

## Undocumented Status Codes (behavioral, not contract changes)

These status codes are used for spec-mandated behavior without altering README success codes:

| Code | When |
|------|------|
| 401 | Missing/invalid/revoked JWT; invalid login |
| 403 | Non-ADMIN on soft-delete admin routes |
| 404 | Resource not found or soft-deleted on standard route |
| 409 | Concurrent PATCH conflict (IC-10); duplicate username/email; user delete blocked (BR-14: project owner or non-DONE assignee) |
| 400 | Validation, business rule violations (incl. username with whitespace on `POST /users`) |

### User delete side effects (PD-10 / BR-18)

Successful `DELETE /users/:userId` (`200`) hard-deletes the user and cascade-removes authored
comments, related mentions, and `ProjectMember` rows. `GET /users/:id` → `404` thereafter.
Historical `GET /audit-logs` entries retain original `performedBy` user ids.
