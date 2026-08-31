import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditLog1700000000004 implements MigrationInterface {
  name = 'AuditLog1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "change_log" (
        "id" SERIAL NOT NULL,
        "entityType" character varying NOT NULL,
        "entityId" integer NOT NULL,
        "typeCode" character varying NOT NULL,
        "action" character varying NOT NULL,
        "actor" character varying,
        "changes" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_change_log_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_change_log_entity" ON "change_log" ("entityType", "entityId")`);
    await queryRunner.query(`CREATE INDEX "IDX_change_log_created_at" ON "change_log" ("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "change_log"`);
  }
}
