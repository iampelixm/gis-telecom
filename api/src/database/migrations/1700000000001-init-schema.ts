import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1700000000001 implements MigrationInterface {
  name = 'InitSchema1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis;`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis_topology;`);

    await queryRunner.query(`
      CREATE TABLE "layers" (
        "id" SERIAL NOT NULL,
        "code" character varying NOT NULL,
        "name" character varying NOT NULL,
        "color" character varying,
        "icon" character varying,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_layers_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_layers_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "object_types" (
        "id" SERIAL NOT NULL,
        "code" character varying NOT NULL,
        "name" character varying NOT NULL,
        "layerId" integer,
        "geometryType" character varying NOT NULL,
        "color" character varying,
        "icon" character varying,
        "lineWidth" integer,
        "attrsSchema" jsonb NOT NULL DEFAULT '{}',
        "isActive" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_object_types_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_object_types_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`ALTER TABLE "object_types" ADD CONSTRAINT "FK_object_types_layer" FOREIGN KEY ("layerId") REFERENCES "layers"("id") ON DELETE SET NULL`);

    await queryRunner.query(`
      CREATE TABLE "objects" (
        "id" SERIAL NOT NULL,
        "objectTypeId" integer NOT NULL,
        "geometry" geometry(Geometry, 4326) NOT NULL,
        "attrs" jsonb NOT NULL DEFAULT '{}',
        "createdBy" character varying,
        "updatedBy" character varying,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_objects_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`ALTER TABLE "objects" ADD CONSTRAINT "FK_objects_object_type" FOREIGN KEY ("objectTypeId") REFERENCES "object_types"("id") ON DELETE RESTRICT`);
    await queryRunner.query(`CREATE INDEX "IDX_objects_object_type_id" ON "objects" ("objectTypeId")`);
    await queryRunner.query(`CREATE INDEX "IDX_objects_geometry_gist" ON "objects" USING GIST ("geometry")`);

    await queryRunner.query(`
      CREATE TABLE "relation_types" (
        "id" SERIAL NOT NULL,
        "code" character varying NOT NULL,
        "name" character varying NOT NULL,
        "fromTypeId" integer NOT NULL,
        "toTypeId" integer NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_relation_types_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_relation_types_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`ALTER TABLE "relation_types" ADD CONSTRAINT "FK_relation_types_from" FOREIGN KEY ("fromTypeId") REFERENCES "object_types"("id") ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE "relation_types" ADD CONSTRAINT "FK_relation_types_to" FOREIGN KEY ("toTypeId") REFERENCES "object_types"("id") ON DELETE RESTRICT`);

    await queryRunner.query(`
      CREATE TABLE "object_relations" (
        "id" SERIAL NOT NULL,
        "relationTypeId" integer NOT NULL,
        "fromObjectId" integer NOT NULL,
        "toObjectId" integer NOT NULL,
        "attrs" jsonb NOT NULL DEFAULT '{}',
        "createdBy" character varying,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_object_relations_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`ALTER TABLE "object_relations" ADD CONSTRAINT "FK_object_relations_type" FOREIGN KEY ("relationTypeId") REFERENCES "relation_types"("id") ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE "object_relations" ADD CONSTRAINT "FK_object_relations_from" FOREIGN KEY ("fromObjectId") REFERENCES "objects"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "object_relations" ADD CONSTRAINT "FK_object_relations_to" FOREIGN KEY ("toObjectId") REFERENCES "objects"("id") ON DELETE CASCADE`);
    await queryRunner.query(`CREATE INDEX "IDX_object_relations_relation_type" ON "object_relations" ("relationTypeId")`);
    await queryRunner.query(`CREATE INDEX "IDX_object_relations_from" ON "object_relations" ("fromObjectId")`);
    await queryRunner.query(`CREATE INDEX "IDX_object_relations_to" ON "object_relations" ("toObjectId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "object_relations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "relation_types"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "objects"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "object_types"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "layers"`);
  }
}
