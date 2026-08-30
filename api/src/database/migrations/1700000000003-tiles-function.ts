import { MigrationInterface, QueryRunner } from 'typeorm';

export class TilesFunction1700000000003 implements MigrationInterface {
  name = 'TilesFunction1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION tiles_objects(
        z integer,
        x integer,
        y integer,
        query_params json DEFAULT NULL
      ) RETURNS bytea AS $$
      DECLARE
        allowed text[];
        mvt bytea;
      BEGIN
        IF query_params IS NULL OR query_params->>'types' IS NULL THEN
          RETURN NULL;
        END IF;

        allowed := string_to_array(query_params->>'types', ',');

        IF allowed IS NULL OR array_length(allowed, 1) IS NULL THEN
          RETURN NULL;
        END IF;

        SELECT INTO mvt ST_AsMVT(mvtgeom, 'objects', 4096, 'geom')
        FROM (
          SELECT
            o.id,
            ot.code AS type,
            o.attrs,
            ST_AsMVTGeom(
              ST_Transform(o.geometry, 3857),
              ST_TileEnvelope(z, x, y),
              4096, 256, true
            ) AS geom
          FROM objects o
          JOIN object_types ot ON ot.id = o."objectTypeId"
          WHERE ot.code = ANY(allowed)
            AND ST_Transform(o.geometry, 3857) && ST_TileEnvelope(z, x, y)
        ) AS mvtgeom
        WHERE geom IS NOT NULL;

        RETURN mvt;
      END;
      $$ LANGUAGE plpgsql STABLE STRICT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS tiles_objects(integer, integer, integer, json)`);
  }
}
