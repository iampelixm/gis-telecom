import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MeModule } from './me/me.module';
import { ObjectsModule } from './objects/objects.module';
import { RelationsModule } from './relations/relations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    DatabaseModule,
    AuditModule,
    HealthModule,
    MeModule,
    ObjectsModule,
    RelationsModule,
    CatalogModule,
  ],
})
export class AppModule {}
