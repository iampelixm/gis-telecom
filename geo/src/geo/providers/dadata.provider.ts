import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AddressSuggestion,
  CompanySuggestion,
  ForwardResult,
  GeoProvider,
  ReverseResult,
} from './geo-provider.interface';

const SUGGEST_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs';

interface DadataSuggestion {
  value: string;
  unrestricted_value?: string;
  data?: {
    fias_id?: string;
    kladr_id?: string;
    geo_lat?: string;
    geo_lon?: string;
    region_with_type?: string;
    city_with_type?: string;
    settlement_with_type?: string;
    street_with_type?: string;
    postal_code?: string;
    qc_geo?: string;
    house?: {
      house?: string;
      type_full?: string;
      floors?: string;
      qty?: string;
    };
  };
}

@Injectable()
export class DadataProvider implements GeoProvider {
  private readonly logger = new Logger(DadataProvider.name);
  private readonly apiKey: string;
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('DADATA_API_KEY') || '';
    this.secret = config.get<string>('DADATA_SECRET') || '';
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Token ${this.apiKey}`,
      'X-Secret': this.secret,
    };
  }

  private async post<T>(
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch(`${SUGGEST_URL}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(
        `Dadata ${path} failed: ${res.status} ${res.statusText} ${text}`,
      );
      throw new Error(`Dadata error ${res.status}`);
    }
    return (await res.json()) as T;
  }

  private toSuggestion(s: DadataSuggestion): AddressSuggestion {
    return {
      value: s.value,
      unrestrictedValue: s.unrestricted_value,
      fiasId: s.data?.fias_id,
      kladrId: s.data?.kladr_id,
      lat: s.data?.geo_lat ? Number(s.data.geo_lat) : undefined,
      lon: s.data?.geo_lon ? Number(s.data.geo_lon) : undefined,
    };
  }

  async suggest(query: string): Promise<AddressSuggestion[]> {
    const res = await this.post<{ suggestions: DadataSuggestion[] }>(
      '/suggest/address',
      { query, count: 8 },
    );
    return (res.suggestions || []).map((s) => this.toSuggestion(s));
  }

  async forward(address: string): Promise<ForwardResult | null> {
    const res = await this.post<{ suggestions: DadataSuggestion[] }>(
      '/suggest/address',
      { query: address, count: 1 },
    );
    const s = res.suggestions?.[0];
    const lat = s?.data?.geo_lat ? Number(s.data.geo_lat) : undefined;
    const lon = s?.data?.geo_lon ? Number(s.data.geo_lon) : undefined;
    if (!s || lat === undefined || lon === undefined) {
      return null;
    }
    return {
      address: s.value,
      fiasId: s.data?.fias_id,
      kladrId: s.data?.kladr_id,
      lat,
      lon,
    };
  }

  async reverse(lat: number, lon: number): Promise<ReverseResult | null> {
    const res = await this.post<{ suggestions: DadataSuggestion[] }>(
      '/geolocate/address',
      { lat, lon, count: 1 },
    );
    const s = res.suggestions?.[0];
    const lat2 = s?.data?.geo_lat ? Number(s.data.geo_lat) : undefined;
    const lon2 = s?.data?.geo_lon ? Number(s.data.geo_lon) : undefined;
    if (!s) {
      return null;
    }
    const houseNum = s.data?.house?.house;
    const houseType = s.data?.house?.type_full;
    return {
      address: s.value,
      fiasId: s.data?.fias_id,
      kladrId: s.data?.kladr_id,
      lat: lat2 ?? lat,
      lon: lon2 ?? lon,
      floors: s.data?.house?.floors ? Number(s.data.house.floors) : undefined,
      apartments: s.data?.house?.qty ? Number(s.data.house.qty) : undefined,
      regionWithType: s.data?.region_with_type,
      cityWithType: s.data?.city_with_type,
      settlementWithType: s.data?.settlement_with_type,
      streetWithType: s.data?.street_with_type,
      houseFull:
        houseNum && houseType ? `${houseType} ${houseNum}` : houseNum,
      postalCode: s.data?.postal_code,
      qcGeo: s.data?.qc_geo,
    };
  }

  async company(query: string): Promise<CompanySuggestion[]> {
    const res = await this.post<{
      suggestions: Array<{
        value: string;
        data?: {
          inn?: string;
          kpp?: string;
          ogrn?: string;
          address?: { value?: string };
        };
      }>;
    }>('/suggest/party', { query, count: 8 });
    return (res.suggestions || []).map((s) => ({
      name: s.value,
      inn: s.data?.inn,
      kpp: s.data?.kpp,
      ogrn: s.data?.ogrn,
      address: s.data?.address?.value,
    }));
  }
}
