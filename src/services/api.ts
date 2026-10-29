import type {
  Passenger,
  Station,
  FareRule,
  Journey,
  WalletTransaction,
  AdminMetrics,
  SystemStatus,
  HardwareScanRequest,
  HardwareScanResult,
} from '../types/index.js';

export const api = {
  // 1. Stations & Fare Matrix
  async getStations(): Promise<{ stations: Station[]; fare_rules: FareRule[] }> {
    const res = await fetch('/api/stations');
    if (!res.ok) throw new Error('Failed to load stations');
    return res.json();
  },

  // 2. Passengers
  async getPassengers(params?: { status?: string; search?: string }): Promise<{ passengers: Passenger[] }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    const res = await fetch(`/api/passengers?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to load passengers');
    return res.json();
  },

  async getPassengerDetails(id: string): Promise<{
    passenger: Passenger;
    active_journey: Journey | null;
    journeys: Journey[];
    transactions: WalletTransaction[];
  }> {
    const res = await fetch(`/api/passengers/${id}`);
    if (!res.ok) throw new Error('Passenger not found');
    return res.json();
  },

  // 3. Edge Functions: Passenger Lookup
  async lookupPassenger(fingerprint_id: number): Promise<{
    success: boolean;
    recognized?: boolean;
    passenger: Passenger;
    has_active_journey: boolean;
    active_journey: Journey | null;
  }> {
    const res = await fetch('/api/edge/passenger-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint_id }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Passenger lookup failed');
    }
    return data;
  },

  // 4. Edge Functions: Check-In
  async checkIn(payload: {
    fingerprint_id?: number;
    passenger_id?: string;
    station_id: string | number;
    device_id?: string;
  }): Promise<{
    success: boolean;
    message: string;
    journey: Journey;
    passenger: { id: string; name: string; wallet_balance: number };
  }> {
    const res = await fetch('/api/edge/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Check-in failed');
    }
    return data;
  },

  // 5. Edge Functions: Check-Out
  async checkOut(payload: {
    fingerprint_id?: number;
    passenger_id?: string;
    station_id: string | number;
    device_id?: string;
  }): Promise<{
    success: boolean;
    message: string;
    journey: Journey;
    fare: number;
    previous_balance: number;
    updated_balance: number;
    transaction_id: string;
    passenger: { id: string; name: string; wallet_balance: number };
  }> {
    const res = await fetch('/api/edge/check-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Check-out failed');
    }
    return data;
  },

  // 6. Hardware Terminal Scan
  async scanHardware(req: HardwareScanRequest): Promise<HardwareScanResult> {
    const res = await fetch('/api/hardware/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    return res.json();
  },

  // 7. Journeys
  async getJourneys(params?: { status?: string; passenger_id?: string; limit?: number }): Promise<{ journeys: Journey[] }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.passenger_id) query.set('passenger_id', params.passenger_id);
    if (params?.limit) query.set('limit', String(params.limit));
    const res = await fetch(`/api/journeys?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to load journeys');
    return res.json();
  },

  // 8. Transactions
  async getTransactions(params?: { passenger_id?: string; limit?: number }): Promise<{ transactions: WalletTransaction[] }> {
    const query = new URLSearchParams();
    if (params?.passenger_id) query.set('passenger_id', params.passenger_id);
    if (params?.limit) query.set('limit', String(params.limit));
    const res = await fetch(`/api/transactions?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to load transactions');
    return res.json();
  },

  // 9. Admin Metrics
  async getMetrics(): Promise<{ metrics: AdminMetrics }> {
    const res = await fetch('/api/admin/metrics');
    if (!res.ok) throw new Error('Failed to load admin metrics');
    return res.json();
  },

  // 10. System Status
  async getSystemStatus(): Promise<{ status: SystemStatus }> {
    const res = await fetch('/api/system/status');
    if (!res.ok) throw new Error('Failed to load system status');
    return res.json();
  },

  // 11. Reset Demo
  async resetDemo(passcode?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/admin/reset-demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to reset demo');
    return data;
  },

  // 12. Topup Wallet
  async topupWallet(passengerId: string, amount: number): Promise<{
    success: boolean;
    message: string;
    previous_balance: number;
    updated_balance: number;
  }> {
    const res = await fetch(`/api/passengers/${passengerId}/topup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to top up wallet');
    return data;
  },

  // 13. Verify Admin Passcode
  async verifyAdminPasscode(passcode: string): Promise<{ success: boolean; token?: string; error?: string }> {
    const res = await fetch('/api/admin/verify-passcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    return res.json();
  },
};
