import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const CACHE_TTL_SECONDS = 7 * 24 * 3600;

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis | null;
  private readonly memory = new Map<string, { value: string; expires: number }>();
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    const host = config.get<string>('REDIS_HOST');
    const port = Number(config.get<string>('REDIS_PORT') || '6379');
    this.enabled = Boolean(host);
    if (!host) {
      this.logger.warn('REDIS_HOST not set, using in-memory cache');
      this.client = null;
      return;
    }
    this.client = new Redis({ host, port, lazyConnect: true });
    this.client
      .connect()
      .then(() => this.logger.log('redis connected'))
      .catch((err) => {
        this.logger.warn(`redis connection failed: ${err.message}`);
      });
  }

  private cacheKey(namespace: string, key: string): string {
    return `geo:${namespace}:${key}`;
  }

  async get<T>(namespace: string, key: string): Promise<T | null> {
    const ck = this.cacheKey(namespace, key);
    if (this.client && this.enabled) {
      try {
        const raw = await this.client.get(ck);
        return raw ? (JSON.parse(raw) as T) : null;
      } catch (err) {
        this.logger.warn(`redis get failed: ${(err as Error).message}`);
      }
    }
    const m = this.memory.get(ck);
    if (m && m.expires > Date.now()) {
      return JSON.parse(m.value) as T;
    }
    if (m) {
      this.memory.delete(ck);
    }
    return null;
  }

  async set(namespace: string, key: string, value: unknown): Promise<void> {
    const ck = this.cacheKey(namespace, key);
    const raw = JSON.stringify(value);
    if (this.client && this.enabled) {
      try {
        await this.client.set(ck, raw, 'EX', CACHE_TTL_SECONDS);
        return;
      } catch (err) {
        this.logger.warn(`redis set failed: ${(err as Error).message}`);
      }
    }
    this.memory.set(ck, { value: raw, expires: Date.now() + CACHE_TTL_SECONDS * 1000 });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
    }
  }
}
