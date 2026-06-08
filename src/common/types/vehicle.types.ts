export type VehicleStatus = 'SOURCING' | 'IN_TRANSIT' | 'CUSTOMS' | 'REFURBISHMENT' | 'SHOWROOM' | 'RESERVED' | 'SOLD';
export type FuelType = 'ELECTRIC' | 'PETROL' | 'DIESEL' | 'HYBRID';

export interface VehicleDetails {
  id: string;
  make: string;
  model: string;
  year: number;
  vin_chassis: string;
  status: VehicleStatus;
  retail_price_etb: number;
  fuel: FuelType;
  branch_id?: string;
  images?: string[];
  battery_soh_percent?: number;
  certified_km?: number;
  isEV?: boolean;
  mileage?: number;
}
