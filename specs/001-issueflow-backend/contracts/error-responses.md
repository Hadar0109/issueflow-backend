# Error Response Contract

**Feature**: `001-issueflow-backend`  
**Decision**: IC-06

All HTTP errors use a single global shape (NestJS-compatible):

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

`message` MAY be a `string` or `string[]` (validation pipe returns array of constraint messages).

---

## Status Code Mapping

| HTTP | `error` label | Typical `message` |
|------|---------------|-------------------|
| 400 | Bad Request | Field validation, invalid enum, backward status, DONE patch, unresolved blockers, authorId mismatch, attachment rejected, username contains whitespace |
| 401 | Unauthorized | Missing JWT, invalid token, revoked token, unknown username on login, JWT `sub` user hard-deleted |
| 403 | Forbidden | Non-ADMIN on deleted-list/restore endpoints |
| 404 | Not Found | Unknown id, soft-deleted entity on standard route |
| 409 | Conflict | Concurrent update (IC-10), duplicate username/email, user delete blocked |
| 500 | Internal Server Error | Unhandled exceptions (avoid in normal flows) |

---

## Concurrent Update Error (IC-10)

When `SELECT … FOR UPDATE NOWAIT` fails:

```json
{
  "statusCode": 409,
  "message": "This resource is being updated by another request. Please retry.",
  "error": "Conflict"
}
```

Applies to `PATCH /tickets/:ticketId` and `PATCH /tickets/:ticketId/comments/:commentId`.

---

## Validation Error Example

```json
{
  "statusCode": 400,
  "message": [
    "role must be one of: ADMIN, DEVELOPER",
    "email must be an email"
  ],
  "error": "Bad Request"
}
```
