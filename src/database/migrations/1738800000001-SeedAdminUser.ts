import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class SeedAdminUser1738800000001 implements MigrationInterface {
  name = 'SeedAdminUser1738800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const passwordHash = await bcrypt.hash('admin123', 10);
    await queryRunner.query(
      `INSERT INTO "users" ("username", "email", "fullName", "role", "passwordHash")
       VALUES ($1, $2, $3, $4, $5)`,
      ['admin', 'admin@issueflow.local', 'System Administrator', 'ADMIN', passwordHash],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "users" WHERE "username" = 'admin'`);
  }
}
