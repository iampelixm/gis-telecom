import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  const port = Number(process.env.GEO_PORT) || Number(process.env.PORT) || 3300;
  await app.listen(port);
  console.log(`geo listening on :${port}`);
}
bootstrap();
