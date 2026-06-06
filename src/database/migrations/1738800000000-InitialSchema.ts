import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1738800000000 implements MigrationInterface {
  name = 'InitialSchema1738800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "users_role_enum" AS ENUM ('ADMIN', 'DEVELOPER');
      CREATE TYPE "tickets_status_enum" AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE');
      CREATE TYPE "tickets_priority_enum" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
      CREATE TYPE "tickets_type_enum" AS ENUM ('BUG', 'FEATURE', 'TECHNICAL');
      CREATE TYPE "audit_logs_actor_enum" AS ENUM ('USER', 'SYSTEM');
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" SERIAL NOT NULL,
        "username" character varying(64) NOT NULL,
        "email" character varying(255) NOT NULL,
        "fullName" character varying(255) NOT NULL,
        "role" "users_role_enum" NOT NULL,
        "passwordHash" character varying(255),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_username_lower" ON "users" (LOWER("username"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_email_lower" ON "users" (LOWER("email"))`,
    );

    await queryRunner.query(`
      CREATE TABLE "revoked_tokens" (
        "id" SERIAL NOT NULL,
        "jti" character varying(64) NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revokedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_revoked_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_revoked_tokens_jti" UNIQUE ("jti")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_revoked_tokens_jti" ON "revoked_tokens" ("jti")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_revoked_tokens_expiresAt" ON "revoked_tokens" ("expiresAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" SERIAL NOT NULL,
        "name" character varying(255) NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "ownerId" integer NOT NULL,
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_projects" PRIMARY KEY ("id"),
        CONSTRAINT "FK_projects_owner" FOREIGN KEY ("ownerId") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "project_members" (
        "id" SERIAL NOT NULL,
        "projectId" integer NOT NULL,
        "userId" integer NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_members" PRIMARY KEY ("id"),
        CONSTRAINT "FK_project_members_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_project_members_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_project_members_project_user" UNIQUE ("projectId", "userId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_project_members_projectId" ON "project_members" ("projectId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "tickets" (
        "id" SERIAL NOT NULL,
        "title" character varying(500) NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "status" "tickets_status_enum" NOT NULL,
        "priority" "tickets_priority_enum" NOT NULL,
        "type" "tickets_type_enum" NOT NULL,
        "projectId" integer NOT NULL,
        "assigneeId" integer,
        "dueDate" TIMESTAMP WITH TIME ZONE,
        "isOverdue" boolean NOT NULL DEFAULT false,
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "deletedWithProjectId" integer,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tickets" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tickets_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id"),
        CONSTRAINT "FK_tickets_assignee" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_tickets_deletedWithProject" FOREIGN KEY ("deletedWithProjectId") REFERENCES "projects"("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_tickets_project_deleted" ON "tickets" ("projectId", "deletedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tickets_assignee_project_status" ON "tickets" ("assigneeId", "projectId", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tickets_due_status_priority" ON "tickets" ("dueDate", "status", "priority")`,
    );

    await queryRunner.query(`
      CREATE TABLE "comments" (
        "id" SERIAL NOT NULL,
        "ticketId" integer NOT NULL,
        "authorId" integer NOT NULL,
        "content" text NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_comments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_comments_ticket" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_comments_author" FOREIGN KEY ("authorId") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "mentions" (
        "id" SERIAL NOT NULL,
        "commentId" integer NOT NULL,
        "userId" integer NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mentions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_mentions_comment" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_mentions_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_mentions_comment_user" UNIQUE ("commentId", "userId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_mentions_user_created" ON "mentions" ("userId", "createdAt" DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE "ticket_dependencies" (
        "id" SERIAL NOT NULL,
        "ticketId" integer NOT NULL,
        "blockedByTicketId" integer NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ticket_dependencies" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ticket_dependencies_ticket" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ticket_dependencies_blocker" FOREIGN KEY ("blockedByTicketId") REFERENCES "tickets"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_ticket_dependencies_pair" UNIQUE ("ticketId", "blockedByTicketId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "attachments" (
        "id" SERIAL NOT NULL,
        "ticketId" integer NOT NULL,
        "filename" character varying(255) NOT NULL,
        "contentType" character varying(100) NOT NULL,
        "storagePath" character varying(500) NOT NULL,
        "sizeBytes" integer NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_attachments_ticket" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" SERIAL NOT NULL,
        "action" character varying(32) NOT NULL,
        "entityType" character varying(32) NOT NULL,
        "entityId" integer NOT NULL,
        "performedBy" integer,
        "actor" "audit_logs_actor_enum" NOT NULL,
        "metadata" jsonb,
        "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_entity" ON "audit_logs" ("entityType", "entityId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_actor" ON "audit_logs" ("actor")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_timestamp" ON "audit_logs" ("timestamp" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "attachments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ticket_dependencies"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mentions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "comments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tickets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "projects"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "revoked_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "audit_logs_actor_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tickets_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tickets_priority_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "tickets_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_role_enum"`);
  }
}
