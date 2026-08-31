import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';
import { DadataProvider } from './providers/dadata.provider';
import { MockProvider } from './providers/mock.provider';
import type {
  AddressSuggestion,
  CompanySuggestion,
  ForwardResult,
  GeoProvider,
  ReverseResult,
} from './providers/geo-provider.interface';

function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

@Injectable()
export class GeoService {
  private readonly provider: GeoProvider;

  constructor(
    config: ConfigService,
    private readonly cache: CacheService,
  ) {
    const mode = config.get<string>('GEO_PROVIDER') || 'mock';
    this.provider =
      mode === 'dadata'
        ? new DadataProvider(config)
        : new MockProvider();
  }

  async suggest(query: string): Promise<{ suggestions: AddressSuggestion[] }> {
    const key = normalizeKey(query);
    if (!key) {
      return { suggestions: [] };
    }
    const cached = await this.cache.get<AddressSuggestion[]>('suggest', key);
    if (cached) {
      return { suggestions: cached };
    }
    const suggestions = await this.provider.suggest(query);
    await this.cache.set('suggest', key, suggestions);
    return { suggestions };
  }

  async forward(address: string): Promise<ForwardResult | null> {
    const key = normalizeKey(address);
    if (!key) {
      return null;
    }
    const cached = await this.cache.get<ForwardResult>('forward', key);
    if (cached) {
      return cached;
    }
    const result = await this.provider.forward(address);
    if (result) {
      await this.cache.set('forward', key, result);
    }
    return result;
  }

  async reverse(lat: number, lon: number): Promise<ReverseResult | null> {
    const key = `${Number(lat).toFixed(5)},${Number(lon).toFixed(5)}`;
    const cached = await this.cache.get<ReverseResult>('reverse', key);
    if (cached) {
      return cached;
    }
    const result = await this.provider.reverse(lat, lon);
    if (result) {
      await this.cache.set('reverse', key, result);
    }
    return result;
  }

  async company(query: string): Promise<{ suggestions: CompanySuggestion[] }> {
    const key = normalizeKey(query);
    if (!key) {
      return { suggestions: [] };
    }
    const cached = await this.cache.get<CompanySuggestion[]>('company', key);
    if (cached) {
      return { suggestions: cached };
    }
    const suggestions = await this.provider.company(query);
    await this.cache.set('company', key, suggestions);
    return { suggestions };
  }
}
