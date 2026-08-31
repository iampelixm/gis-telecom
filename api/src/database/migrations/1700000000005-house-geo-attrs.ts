import { MigrationInterface, QueryRunner } from 'typeorm';

export class HouseGeoAttrs1700000000005 implements MigrationInterface {
  name = 'HouseGeoAttrs1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "object_types"
      SET "attrsSchema" = '{"type":"object","properties":{"address":{"type":"string"},"fias_id":{"type":"string"},"kladr_id":{"type":"string"},"address_normalized":{"type":"string"},"floors":{"type":"integer","minimum":0},"apartments":{"type":"integer","minimum":0},"subscribers":{"type":"integer","minimum":0}},"additionalProperties":true}'::jsonb
      WHERE "code" = 'house'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "object_types"
      SET "attrsSchema" = '{"type":"object","properties":{"address":{"type":"string"},"subscribers":{"type":"integer","minimum":0}},"additionalProperties":true}'::jsonb
      WHERE "code" = 'house'
    `);
  }
}
