import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedCatalog1700000000002 implements MigrationInterface {
  name = 'SeedCatalog1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Слои
    await queryRunner.query(`
      INSERT INTO "layers" ("code", "name", "color", "icon", "sortOrder", "isActive") VALUES
      ('poles',     'Столбы',               '#8b5a2b', 'marker',  1, true),
      ('optics',    'Оптика',               '#2e7d32', 'layers',  2, true),
      ('routes',    'Трассы',               '#b26a00', 'route',   3, true),
      ('houses',    'Дома абонентов',       '#5c6bc0', 'home',    4, true),
      ('equipment', 'Активное оборудование', '#c62828', 'server',  5, true)
    `);

    // Типы объектов
    await queryRunner.query(`
      INSERT INTO "object_types"
        ("code", "name", "layerId", "geometryType", "color", "icon", "lineWidth", "attrsSchema", "isActive", "sortOrder") VALUES
      ('pole',       'Столб',               (SELECT id FROM "layers" WHERE code='poles'),
        'point',
        '#8b5a2b', 'marker', NULL,
        '{"type":"object","required":["inventory_number"],"properties":{"inventory_number":{"type":"string"},"material":{"enum":["wood","concrete","metal"]},"height_m":{"type":"number","minimum":1}},"additionalProperties":true}'::jsonb,
        true, 1),
      ('fiber_line', 'Линия оптики',        (SELECT id FROM "layers" WHERE code='optics'),
        'linestring',
        '#2e7d32', NULL, 4,
        '{"type":"object","properties":{"fibers_count":{"type":"integer","minimum":1},"cable_type":{"type":"string"},"status":{"enum":["planned","built","active"]}},"additionalProperties":true}'::jsonb,
        true, 2),
      ('splice',     'Муфта',               (SELECT id FROM "layers" WHERE code='optics'),
        'point',
        '#4caf50', 'circle', NULL,
        '{"type":"object","properties":{"splice_type":{"type":"string"},"weld_count":{"type":"integer","minimum":0}},"additionalProperties":true}'::jsonb,
        true, 3),
      ('route',      'Трасса',              (SELECT id FROM "layers" WHERE code='routes'),
        'linestring',
        '#b26a00', NULL, 3,
        '{"type":"object","properties":{"laying_type":{"enum":["underground","aerial"]},"depth_m":{"type":"number"}},"additionalProperties":true}'::jsonb,
        true, 4),
      ('house',      'Дом абонента',        (SELECT id FROM "layers" WHERE code='houses'),
        'point',
        '#5c6bc0', 'home', NULL,
        '{"type":"object","properties":{"address":{"type":"string"},"subscribers":{"type":"integer","minimum":0}},"additionalProperties":true}'::jsonb,
        true, 5),
      ('equipment',  'Активное оборудование',(SELECT id FROM "layers" WHERE code='equipment'),
        'point',
        '#c62828', 'server', NULL,
        '{"type":"object","required":["device_type"],"properties":{"device_type":{"type":"string"},"model":{"type":"string"},"ports":{"type":"integer","minimum":0},"ip":{"type":"string"}},"additionalProperties":true}'::jsonb,
        true, 6)
    `);

    // Типы связей
    await queryRunner.query(`
      INSERT INTO "relation_types" ("code", "name", "fromTypeId", "toTypeId", "isActive") VALUES
      ('fiber_line_pole',    'Линия → столб',           (SELECT id FROM "object_types" WHERE code='fiber_line'), (SELECT id FROM "object_types" WHERE code='pole'), true),
      ('fiber_line_house',   'Линия → дом',             (SELECT id FROM "object_types" WHERE code='fiber_line'), (SELECT id FROM "object_types" WHERE code='house'), true),
      ('equipment_house',    'Оборудование → дом',      (SELECT id FROM "object_types" WHERE code='equipment'), (SELECT id FROM "object_types" WHERE code='house'), true),
      ('equipment_pole',     'Оборудование → столб',    (SELECT id FROM "object_types" WHERE code='equipment'), (SELECT id FROM "object_types" WHERE code='pole'), true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "relation_types"`);
    await queryRunner.query(`DELETE FROM "object_types"`);
    await queryRunner.query(`DELETE FROM "layers"`);
  }
}
