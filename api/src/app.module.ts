import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MeModule } from './me/me.module';
import { ObjectsModule } from './objects/objects.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    DatabaseModule,
    HealthModule,
    MeModule,
    ObjectsModule,
    CatalogModule,
  ],
})
export class AppModule {}
