export enum UserRole {
  ADMIN = 'ADMIN',
  DEVELOPER = 'DEVELOPER',
}

export enum TicketStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum TicketType {
  BUG = 'BUG',
  FEATURE = 'FEATURE',
  TECHNICAL = 'TECHNICAL',
}

export enum AuditActor {
  USER = 'USER',
  SYSTEM = 'SYSTEM',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGOUT = 'LOGOUT',
  SOFT_DELETE = 'SOFT_DELETE',
  RESTORE = 'RESTORE',
  AUTO_ASSIGN = 'AUTO_ASSIGN',
  ESCALATE = 'ESCALATE',
  ADD = 'ADD',
  REMOVE = 'REMOVE',
  UPLOAD = 'UPLOAD',
}

export enum AuditEntityType {
  USER = 'USER',
  AUTH = 'AUTH',
  PROJECT = 'PROJECT',
  TICKET = 'TICKET',
  COMMENT = 'COMMENT',
  DEPENDENCY = 'DEPENDENCY',
  ATTACHMENT = 'ATTACHMENT',
}
