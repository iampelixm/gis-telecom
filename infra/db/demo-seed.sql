-- Demo-seed: тестовые объекты на карте (только для разработки, НЕ миграция)
-- Район: ул. Макаренко, Центральный район Сочи (~43.6146, 39.7453)
-- Запуск:  docker compose exec -T db psql -U gis -d gis < infra/db/demo-seed.sql
-- Идемпотентно: пересоздаёт объекты и связи с нуля.

BEGIN;

TRUNCATE "object_relations", "objects" RESTART IDENTITY CASCADE;

-- ===== Столбы (вдоль улицы, с юго-запада на северо-восток) =====
INSERT INTO "objects" ("objectTypeId", geometry, attrs) VALUES
  ((SELECT id FROM object_types WHERE code='pole'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[39.74200,43.61150]}'),
   '{"inventory_number":"P-0001","material":"concrete","height_m":7.5}'::jsonb),
  ((SELECT id FROM object_types WHERE code='pole'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[39.74320,43.61230]}'),
   '{"inventory_number":"P-0002","material":"concrete","height_m":7.5}'::jsonb),
  ((SELECT id FROM object_types WHERE code='pole'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[39.74440,43.61310]}'),
   '{"inventory_number":"P-0003","material":"metal","height_m":9}'::jsonb),
  ((SELECT id FROM object_types WHERE code='pole'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[39.74560,43.61390]}'),
   '{"inventory_number":"P-0004","material":"metal","height_m":9}'::jsonb),
  ((SELECT id FROM object_types WHERE code='pole'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[39.74680,43.61470]}'),
   '{"inventory_number":"P-0005","material":"wood","height_m":7.5}'::jsonb),
  ((SELECT id FROM object_types WHERE code='pole'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[39.74800,43.61550]}'),
   '{"inventory_number":"P-0006","material":"wood","height_m":7.5}'::jsonb),
  ((SELECT id FROM object_types WHERE code='pole'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[39.74890,43.61610]}'),
   '{"inventory_number":"P-0007","material":"concrete","height_m":9}'::jsonb);

-- ===== Магистральная линия оптики (по столбам) =====
INSERT INTO "objects" ("objectTypeId", geometry, attrs) VALUES
  ((SELECT id FROM object_types WHERE code='fiber_line'),
   ST_GeomFromGeoJSON('{"type":"LineString","coordinates":[[39.74200,43.61150],[39.74320,43.61230],[39.74440,43.61310],[39.74560,43.61390],[39.74680,43.61470],[39.74800,43.61550],[39.74890,43.61610]]}'),
   '{"status":"active","cable_type":"24D-OM3","fibers_count":24}'::jsonb);

-- ===== Отвод к домам (ветка от П-4) =====
INSERT INTO "objects" ("objectTypeId", geometry, attrs) VALUES
  ((SELECT id FROM object_types WHERE code='fiber_line'),
   ST_GeomFromGeoJSON('{"type":"LineString","coordinates":[[39.74560,43.61390],[39.74600,43.61320]]}'),
   '{"status":"built","cable_type":"8D-OM3","fibers_count":8}'::jsonb);

-- ===== Подземная трасса =====
INSERT INTO "objects" ("objectTypeId", geometry, attrs) VALUES
  ((SELECT id FROM object_types WHERE code='route'),
   ST_GeomFromGeoJSON('{"type":"LineString","coordinates":[[39.74200,43.61150],[39.74320,43.61230],[39.74440,43.61310],[39.74560,43.61390]]}'),
   '{"laying_type":"underground","depth_m":1.2}'::jsonb);

-- ===== Муфты (точки сращивания) =====
INSERT INTO "objects" ("objectTypeId", geometry, attrs) VALUES
  ((SELECT id FROM object_types WHERE code='splice'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[39.74440,43.61310]}'),
   '{"splice_type":"SM-48","weld_count":24}'::jsonb),
  ((SELECT id FROM object_types WHERE code='splice'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[39.74800,43.61550]}'),
   '{"splice_type":"SM-48","weld_count":12}'::jsonb);

-- ===== Дома абонентов =====
INSERT INTO "objects" ("objectTypeId", geometry, attrs) VALUES
  ((SELECT id FROM object_types WHERE code='house'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[39.74270,43.61200]}'),
   '{"address":"ул. Макаренко, 2","subscribers":14}'::jsonb),
  ((SELECT id FROM object_types WHERE code='house'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[39.74390,43.61280]}'),
   '{"address":"ул. Макаренко, 4","subscribers":9}'::jsonb),
  ((SELECT id FROM object_types WHERE code='house'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[39.74510,43.61360]}'),
   '{"address":"ул. Макаренко, 6","subscribers":22}'::jsonb),
  ((SELECT id FROM object_types WHERE code='house'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[39.74630,43.61440]}'),
   '{"address":"ул. Макаренко, 8","subscribers":11}'::jsonb),
  ((SELECT id FROM object_types WHERE code='house'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[39.74750,43.61520]}'),
   '{"address":"ул. Макаренко, 10","subscribers":17}'::jsonb),
  ((SELECT id FROM object_types WHERE code='house'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[39.74870,43.61600]}'),
   '{"address":"ул. Макаренко, 12","subscribers":8}'::jsonb);

-- ===== Активное оборудование (OLT на столбе П-1) =====
INSERT INTO "objects" ("objectTypeId", geometry, attrs) VALUES
  ((SELECT id FROM object_types WHERE code='equipment'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[39.74200,43.61150]}'),
   '{"device_type":"OLT","model":"BDCOM P3608","ports":8,"ip":"10.10.0.1"}'::jsonb);

-- ===== Связи =====
-- Линия → столбы (сегменты между столбами)
INSERT INTO "object_relations" ("relationTypeId", "fromObjectId", "toObjectId") VALUES
  ((SELECT id FROM relation_types WHERE code='fiber_line_pole'),
   (SELECT id FROM objects WHERE attrs->>'inventory_number'='P-0001'), (SELECT id FROM objects WHERE attrs->>'inventory_number'='P-0002')),
  ((SELECT id FROM relation_types WHERE code='fiber_line_pole'),
   (SELECT id FROM objects WHERE attrs->>'inventory_number'='P-0002'), (SELECT id FROM objects WHERE attrs->>'inventory_number'='P-0003')),
  ((SELECT id FROM relation_types WHERE code='fiber_line_pole'),
   (SELECT id FROM objects WHERE attrs->>'inventory_number'='P-0003'), (SELECT id FROM objects WHERE attrs->>'inventory_number'='P-0004'));

-- Оборудование → дом (OLT обслуживает дом 2)
INSERT INTO "object_relations" ("relationTypeId", "fromObjectId", "toObjectId") VALUES
  ((SELECT id FROM relation_types WHERE code='equipment_house'),
   (SELECT id FROM objects WHERE attrs->>'device_type'='OLT'),
   (SELECT id FROM objects WHERE attrs->>'address'='ул. Макаренко, 2'));

COMMIT;
