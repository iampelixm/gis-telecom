import { Injectable } from '@nestjs/common';
import type {
  AddressSuggestion,
  CompanySuggestion,
  ForwardResult,
  GeoProvider,
  ReverseResult,
} from './geo-provider.interface';

const MOCK_ADDRESSES: Array<{
  address: string;
  fiasId: string;
  kladrId: string;
  lat: number;
  lon: number;
  floors?: number;
  apartments?: number;
  regionWithType?: string;
  cityWithType?: string;
  settlementWithType?: string;
  streetWithType?: string;
  houseFull?: string;
  postalCode?: string;
  qcGeo?: string;
}> = [
  {
    address: 'Краснодарский край, г. Сочи, ул. Навагинская, д. 5',
    fiasId: '0c5b2444-70a0-4932-980c-b4dc0d3f02b5',
    kladrId: '2300000700000000',
    lat: 43.59481,
    lon: 39.72679,
    floors: 5,
    apartments: 30,
    regionWithType: 'Краснодарский край',
    cityWithType: 'г. Сочи',
    streetWithType: 'ул. Навагинская',
    houseFull: 'д. 5',
    postalCode: '354000',
    qcGeo: '2',
  },
  {
    address: 'Краснодарский край, г. Сочи, ул. Навагинская, д. 9',
    fiasId: '0c5b2444-70a0-4932-980c-b4dc0d3f02b9',
    kladrId: '2300000700000000',
    lat: 43.59461,
    lon: 39.72619,
    floors: 3,
    apartments: 12,
    regionWithType: 'Краснодарский край',
    cityWithType: 'г. Сочи',
    streetWithType: 'ул. Навагинская',
    houseFull: 'д. 9',
    postalCode: '354000',
    qcGeo: '2',
  },
  {
    address: 'Краснодарский край, г. Сочи, ул. Курортный проспект, д. 105',
    fiasId: '0c5b2444-70a0-4932-980c-b4dc0d3f0415',
    kladrId: '2300000700001000',
    lat: 43.5837,
    lon: 39.74231,
    floors: 9,
    apartments: 72,
    regionWithType: 'Краснодарский край',
    cityWithType: 'г. Сочи',
    streetWithType: 'ул. Курортный проспект',
    houseFull: 'д. 105',
    postalCode: '354024',
    qcGeo: '2',
  },
  {
    address: 'Краснодарский край, г. Сочи, ул. Конституции СССР, д. 20',
    fiasId: '0c5b2444-70a0-4932-980c-b4dc0d3f0620',
    kladrId: '2300000700002000',
    lat: 43.6024,
    lon: 39.73702,
    floors: 6,
    apartments: 48,
    regionWithType: 'Краснодарский край',
    cityWithType: 'г. Сочи',
    streetWithType: 'ул. Конституции СССР',
    houseFull: 'д. 20',
    postalCode: '354000',
    qcGeo: '2',
  },
  {
    address: 'Краснодарский край, г. Сочи, ул. Горького, д. 85',
    fiasId: '0c5b2444-70a0-4932-980c-b4dc0d3f0785',
    kladrId: '2300000700003000',
    lat: 43.58852,
    lon: 39.73108,
    floors: 4,
    apartments: 24,
    regionWithType: 'Краснодарский край',
    cityWithType: 'г. Сочи',
    streetWithType: 'ул. Горького',
    houseFull: 'д. 85',
    postalCode: '354000',
    qcGeo: '2',
  },
];

const MOCK_COMPANIES: CompanySuggestion[] = [
  {
    name: 'ООО «Сочи Телеком»',
    inn: '2320123456',
    kpp: '232001001',
    ogrn: '1232300004567',
    address: '354000, Краснодарский край, г. Сочи, ул. Навагинская, д. 5',
  },
  {
    name: 'ООО «Оптик-Юг»',
    inn: '2310123456',
    kpp: '231001001',
    ogrn: '1232300004568',
    address: '354000, Краснодарский край, г. Сочи, Курортный проспект, д. 105',
  },
  {
    name: 'АО «Интернет-Сочи»',
    inn: '2300123456',
    kpp: '230001001',
    ogrn: '1232300004569',
    address: '354000, Краснодарский край, г. Сочи, ул. Конституции СССР, д. 20',
  },
];

function normalize(query: string): string {
  return query
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class MockProvider implements GeoProvider {
  async suggest(query: string): Promise<AddressSuggestion[]> {
    const q = normalize(query);
    if (!q) {
      return [];
    }
    return MOCK_ADDRESSES.filter((a) => normalize(a.address).includes(q)).map(
      (a) => ({
        value: a.address,
        fiasId: a.fiasId,
        kladrId: a.kladrId,
        lat: a.lat,
        lon: a.lon,
      }),
    );
  }

  async forward(address: string): Promise<ForwardResult | null> {
    const q = normalize(address);
    if (!q) {
      return null;
    }
    const hit =
      MOCK_ADDRESSES.find((a) => normalize(a.address).includes(q)) ||
      MOCK_ADDRESSES.find((a) => q.includes(normalize(a.address)));
    if (!hit) {
      return null;
    }
    return {
      address: hit.address,
      fiasId: hit.fiasId,
      kladrId: hit.kladrId,
      lat: hit.lat,
      lon: hit.lon,
    };
  }

  async reverse(lat: number, lon: number): Promise<ReverseResult | null> {
    let best = MOCK_ADDRESSES[0];
    let bestDist = Number.POSITIVE_INFINITY;
    for (const a of MOCK_ADDRESSES) {
      const d = (a.lat - lat) ** 2 + (a.lon - lon) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = a;
      }
    }
    return {
      address: best.address,
      fiasId: best.fiasId,
      kladrId: best.kladrId,
      lat: best.lat,
      lon: best.lon,
      floors: best.floors,
      apartments: best.apartments,
      regionWithType: best.regionWithType,
      cityWithType: best.cityWithType,
      settlementWithType: best.settlementWithType,
      streetWithType: best.streetWithType,
      houseFull: best.houseFull,
      postalCode: best.postalCode,
      qcGeo: best.qcGeo,
    };
  }

  async company(query: string): Promise<CompanySuggestion[]> {
    const q = normalize(query);
    if (!q) {
      return [];
    }
    return MOCK_COMPANIES.filter(
      (c) =>
        normalize(c.name).includes(q) ||
        c.inn?.includes(q) ||
        c.ogrn?.includes(q),
    );
  }
}
