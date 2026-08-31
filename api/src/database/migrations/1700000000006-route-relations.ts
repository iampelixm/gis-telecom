import { MigrationInterface, QueryRunner } from 'typeorm';

export class RouteRelations1700000000006 implements MigrationInterface {
  name = 'RouteRelations1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "relation_types" ("code", "name", "fromTypeId", "toTypeId", "isActive")
      SELECT 'route_route', 'Трасса → следующий сегмент', r.id, r.id, true
      FROM "object_types" r
      WHERE r."code" = 'route'
        AND NOT EXISTS (SELECT 1 FROM "relation_types" WHERE "code" = 'route_route')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "relation_types" WHERE "code" = 'route_route'`);
  }
}
