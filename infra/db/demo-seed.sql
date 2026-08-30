-- Demo-seed: тестовые объекты на карте (только для разработки, НЕ миграция)
-- Запуск:  docker compose exec -T db psql -U gis -d gis < infra/db/demo-seed.sql
-- Идемпотентно: пересоздаёт объекты и связи с нуля.

BEGIN;

TRUNCATE "object_relations", "objects" RESTART IDENTITY CASCADE;

-- ===== Столбы (вдоль улицы) =====
INSERT INTO "objects" ("objectTypeId", geometry, attrs) VALUES
  ((SELECT id FROM object_types WHERE code='pole'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[37.60150,55.75000]}'),
   '{"inventory_number":"P-0001","material":"concrete","height_m":7.5}'::jsonb),
  ((SELECT id FROM object_types WHERE code='pole'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[37.60300,55.75035]}'),
   '{"inventory_number":"P-0002","material":"concrete","height_m":7.5}'::jsonb),
  ((SELECT id FROM object_types WHERE code='pole'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[37.60450,55.75070]}'),
   '{"inventory_number":"P-0003","material":"metal","height_m":9}'::jsonb),
  ((SELECT id FROM object_types WHERE code='pole'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[37.60600,55.75105]}'),
   '{"inventory_number":"P-0004","material":"metal","height_m":9}'::jsonb),
  ((SELECT id FROM object_types WHERE code='pole'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[37.60750,55.75140]}'),
   '{"inventory_number":"P-0005","material":"wood","height_m":7.5}'::jsonb),
  ((SELECT id FROM object_types WHERE code='pole'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[37.60900,55.75175]}'),
   '{"inventory_number":"P-0006","material":"wood","height_m":7.5}'::jsonb),
  ((SELECT id FROM object_types WHERE code='pole'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[37.61050,55.75210]}'),
   '{"inventory_number":"P-0007","material":"concrete","height_m":9}'::jsonb),
  ((SELECT id FROM object_types WHERE code='pole'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[37.61200,55.75245]}'),
   '{"inventory_number":"P-0008","material":"concrete","height_m":9}'::jsonb);

-- ===== Магистральная линия оптики (по столбам) =====
INSERT INTO "objects" ("objectTypeId", geometry, attrs) VALUES
  ((SELECT id FROM object_types WHERE code='fiber_line'),
   ST_GeomFromGeoJSON('{"type":"LineString","coordinates":[[37.60150,55.75000],[37.60300,55.75035],[37.60450,55.75070],[37.60600,55.75105],[37.60750,55.75140],[37.60900,55.75175],[37.61050,55.75210],[37.61200,55.75245]]}'),
   '{"status":"active","cable_type":"24D-OM3","fibers_count":24}'::jsonb);

-- ===== Отвод к домам (ветка от П-4) =====
INSERT INTO "objects" ("objectTypeId", geometry, attrs) VALUES
  ((SELECT id FROM object_types WHERE code='fiber_line'),
   ST_GeomFromGeoJSON('{"type":"LineString","coordinates":[[37.60600,55.75105],[37.60645,55.75155]]}'),
   '{"status":"built","cable_type":"8D-OM3","fibers_count":8}'::jsonb);

-- ===== Подземная трасса =====
INSERT INTO "objects" ("objectTypeId", geometry, attrs) VALUES
  ((SELECT id FROM object_types WHERE code='route'),
   ST_GeomFromGeoJSON('{"type":"LineString","coordinates":[[37.60150,55.75000],[37.60300,55.75035],[37.60450,55.75070],[37.60600,55.75105]]}'),
   '{"laying_type":"underground","depth_m":1.2}'::jsonb);

-- ===== Муфты (точки сращивания) =====
INSERT INTO "objects" ("objectTypeId", geometry, attrs) VALUES
  ((SELECT id FROM object_types WHERE code='splice'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[37.60450,55.75070]}'),
   '{"splice_type":"SM-48","weld_count":24}'::jsonb),
  ((SELECT id FROM object_types WHERE code='splice'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[37.60900,55.75175]}'),
   '{"splice_type":"SM-48","weld_count":12}'::jsonb);

-- ===== Дома абонентов =====
INSERT INTO "objects" ("objectTypeId", geometry, attrs) VALUES
  ((SELECT id FROM object_types WHERE code='house'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[37.60220,55.75050]}'),
   '{"address":"ул. Волоколамская, 1","subscribers":14}'::jsonb),
  ((SELECT id FROM object_types WHERE code='house'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[37.60370,55.75085]}'),
   '{"address":"ул. Волоколамская, 3","subscribers":9}'::jsonb),
  ((SELECT id FROM object_types WHERE code='house'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[37.60520,55.75120]}'),
   '{"address":"ул. Волоколамская, 5","subscribers":22}'::jsonb),
  ((SELECT id FROM object_types WHERE code='house'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[37.60645,55.75155]}'),
   '{"address":"ул. Волоколамская, 7","subscribers":11}'::jsonb),
  ((SELECT id FROM object_types WHERE code='house'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[37.60800,55.75190]}'),
   '{"address":"ул. Волоколамская, 9","subscribers":17}'::jsonb),
  ((SELECT id FROM object_types WHERE code='house'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[37.60950,55.75225]}'),
   '{"address":"ул. Волоколамская, 11","subscribers":8}'::jsonb);

-- ===== Активное оборудование (OLT на столбе П-1) =====
INSERT INTO "objects" ("objectTypeId", geometry, attrs) VALUES
  ((SELECT id FROM object_types WHERE code='equipment'),
   ST_GeomFromGeoJSON('{"type":"Point","coordinates":[37.60150,55.75000]}'),
   '{"device_type":"OLT","model":"BDCOM P3608","ports":8,"ip":"10.10.0.1"}'::jsonb);

-- ===== Связи =====
-- Линия → столбы (каждому столбу принадлежит линия)
INSERT INTO "object_relations" ("relationTypeId", "fromObjectId", "toObjectId") VALUES
  ((SELECT id FROM relation_types WHERE code='fiber_line_pole'),
   (SELECT id FROM objects WHERE attrs->>'inventory_number'='P-0001'), (SELECT id FROM objects WHERE attrs->>'inventory_number'='P-0002')),
  ((SELECT id FROM relation_types WHERE code='fiber_line_pole'),
   (SELECT id FROM objects WHERE attrs->>'inventory_number'='P-0002'), (SELECT id FROM objects WHERE attrs->>'inventory_number'='P-0003')),
  ((SELECT id FROM relation_types WHERE code='fiber_line_pole'),
   (SELECT id FROM objects WHERE attrs->>'inventory_number'='P-0003'), (SELECT id FROM objects WHERE attrs->>'inventory_number'='P-0004'));

-- Оборудование → дом (OLT обслуживает дом 1)
INSERT INTO "object_relations" ("relationTypeId", "fromObjectId", "toObjectId") VALUES
  ((SELECT id FROM relation_types WHERE code='equipment_house'),
   (SELECT id FROM objects WHERE attrs->>'device_type'='OLT'),
   (SELECT id FROM objects WHERE attrs->>'address'='ул. Волоколамская, 1'));

COMMIT;
