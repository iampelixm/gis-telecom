export interface AddressSuggestion {
  value: string;
  unrestrictedValue?: string;
  fiasId?: string;
  kladrId?: string;
  lat?: number;
  lon?: number;
}

export interface ForwardResult {
  address: string;
  fiasId?: string;
  kladrId?: string;
  lat: number;
  lon: number;
}

export interface ReverseResult {
  address: string;
  fiasId?: string;
  kladrId?: string;
  lat: number;
  lon: number;
  floors?: number;
  apartments?: number;
}

export interface CompanySuggestion {
  name: string;
  inn?: string;
  kpp?: string;
  ogrn?: string;
  address?: string;
}

export interface GeoProvider {
  suggest(query: string): Promise<AddressSuggestion[]>;
  forward(address: string): Promise<ForwardResult | null>;
  reverse(lat: number, lon: number): Promise<ReverseResult | null>;
  company(query: string): Promise<CompanySuggestion[]>;
}
