export type AccountStatus = 'active' | 'inactive' | 'suspended';

export interface Passenger {
  id: string;
  name: string;
  fingerprint_id: number;
  wallet_balance: number;
  status: AccountStatus;
  phone?: string;
  email?: string;
  created_at: string;
}

export interface Station {
  id: string | number;
  name: string;
  code: string;
  line: string;
  zone: string;
  distance_km: number;
  is_active: boolean;
}

export interface FareRule {
  from_station_id: string | number;
  to_station_id: string | number;
  fare: number;
}

export type JourneyStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Journey {
  id: string;
  journey_code: string;
  passenger_id: string;
  passenger_name?: string;
  entry_station_id: string | number;
  entry_station_name: string;
  entry_time: string;
  exit_station_id?: string | number | null;
  exit_station_name?: string | null;
  exit_time?: string | null;
  fare?: number | null;
  status: JourneyStatus;
  device_entry_id?: string;
  device_exit_id?: string;
  created_at: string;
}

export type TransactionType = 'FARE_DEDUCTION' | 'WALLET_TOPUP' | 'REFUND';

export interface WalletTransaction {
  id: string;
  transaction_id: string;
  passenger_id: string;
  passenger_name?: string;
  journey_id?: string | null;
  type: TransactionType;
  amount: number;
  previous_balance: number;
  updated_balance: number;
  description: string;
  created_at: string;
}

export interface AdminMetrics {
  total_passengers: number;
  active_passengers: number;
  active_journeys: number;
  completed_journeys: number;
  total_transactions: number;
  total_fare_collected: number;
  active_devices: number;
  system_uptime_seconds: number;
}

export interface SystemStatus {
  backend_mode: 'supabase_edge_proxy' | 'local_verified_store';
  supabase_configured: boolean;
  supabase_url?: string;
  device_token_configured: boolean;
  edge_functions: {
    passenger_lookup: 'connected' | 'unreachable' | 'local_fallback';
    check_in: 'connected' | 'unreachable' | 'local_fallback';
    check_out: 'connected' | 'unreachable' | 'local_fallback';
  };
  last_heartbeat: string;
}

export interface HardwareScanRequest {
  fingerprint_id: number;
  station_id: string | number;
  gate_type: 'entry' | 'exit' | 'auto';
  device_id?: string;
}

export interface HardwareScanResult {
  success: boolean;
  action: 'check_in' | 'check_out' | 'lookup_only' | 'error';
  message: string;
  passenger?: Passenger;
  journey?: Journey;
  fare_deducted?: number;
  previous_balance?: number;
  updated_balance?: number;
  timestamp: string;
  gate_command: 'OPEN' | 'REJECT';
  display_text: string;
  error_code?: string;
}
