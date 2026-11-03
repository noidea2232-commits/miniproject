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

// Base URL support for separate frontend (Vercel) / backend (Render) deployments
const BASE_URL = ((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || '').replace(/\/$/, '');

function apiUrl(path: string): string {
  return `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export const api = {
  // 1. Stations & Fare Matrix
  async getStations(): Promise<{ stations: Station[]; fare_rules: FareRule[] }> {
    const res = await fetch(apiUrl('/api/stations'));
    if (!res.ok) throw new Error('Failed to load stations');
    return res.json();
  },

  // 2. Passengers
  async getPassengers(params?: { status?: string; search?: string }): Promise<{ passengers: Passenger[] }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    const res = await fetch(apiUrl(`/api/passengers?${query.toString()}`));
    if (!res.ok) throw new Error('Failed to load passengers');
    return res.json();
  },

  async getPassengerDetails(id: string): Promise<{
    passenger: Passenger;
    active_journey: Journey | null;
    journeys: Journey[];
    transactions: WalletTransaction[];
  }> {
    const res = await fetch(apiUrl(`/api/passengers/${id}`));
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
    const res = await fetch(apiUrl('/api/edge/passenger-lookup'), {
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
    const res = await fetch(apiUrl('/api/edge/check-in'), {
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
    const res = await fetch(apiUrl('/api/edge/check-out'), {
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
    const res = await fetch(apiUrl('/api/hardware/scan'), {
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
    const res = await fetch(apiUrl(`/api/journeys?${query.toString()}`));
    if (!res.ok) throw new Error('Failed to load journeys');
    return res.json();
  },

  // 8. Transactions
  async getTransactions(params?: { passenger_id?: string; limit?: number }): Promise<{ transactions: WalletTransaction[] }> {
    const query = new URLSearchParams();
    if (params?.passenger_id) query.set('passenger_id', params.passenger_id);
    if (params?.limit) query.set('limit', String(params.limit));
    const res = await fetch(apiUrl(`/api/transactions?${query.toString()}`));
    if (!res.ok) throw new Error('Failed to load transactions');
    return res.json();
  },

  // 9. Admin Metrics
  async getMetrics(): Promise<{ metrics: AdminMetrics }> {
    const res = await fetch(apiUrl('/api/admin/metrics'));
    if (!res.ok) throw new Error('Failed to load admin metrics');
    return res.json();
  },

  // 10. System Status
  async getSystemStatus(): Promise<{ status: SystemStatus }> {
    const res = await fetch(apiUrl('/api/system/status'));
    if (!res.ok) throw new Error('Failed to load system status');
    return res.json();
  },

  // 11. Reset Demo
  async resetDemo(passcode?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(apiUrl('/api/admin/reset-demo'), {
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
    const res = await fetch(apiUrl(`/api/passengers/${passengerId}/topup`), {
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
    const res = await fetch(apiUrl('/api/admin/verify-passcode'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    return res.json();
  },

  // 14. Admin Passenger Registration
  async registerPassenger(payload: {
    name: string;
    fingerprint_id: number;
    wallet_balance?: number;
    phone?: string;
    email?: string;
  }): Promise<{ success: boolean; message: string; passenger: Passenger }> {
    const token = (typeof window !== 'undefined' && sessionStorage.getItem('taporaa_admin_token')) || 'taporaa-admin-2026';
    const res = await fetch(apiUrl('/api/admin/passenger'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-passcode': token,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to register passenger');
    return data;
  },

  // 15. Admin Passenger Deactivation / Status Toggle
  async updatePassengerStatus(
    id: string,
    status: 'active' | 'inactive'
  ): Promise<{ success: boolean; message: string; passenger: Passenger }> {
    const token = (typeof window !== 'undefined' && sessionStorage.getItem('taporaa_admin_token')) || 'taporaa-admin-2026';
    const res = await fetch(apiUrl(`/api/admin/passenger/${id}`), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-passcode': token,
      },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update passenger status');
    return data;
  },

  // 16. Admin Passenger Deletion
  async deletePassenger(
    id: string,
    force = false
  ): Promise<{ success: boolean; message: string; mode?: string }> {
    const token = (typeof window !== 'undefined' && sessionStorage.getItem('taporaa_admin_token')) || 'taporaa-admin-2026';
    const res = await fetch(apiUrl(`/api/admin/passenger/${id}?force=${force}`), {
      method: 'DELETE',
      headers: {
        'x-admin-passcode': token,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete passenger');
    return data;
  },

  // 17. AS608 Capacity & Allocated Slots
  async getSensorCapacity(): Promise<{
    success: boolean;
    sensor_model: string;
    total_capacity: number;
    used_slots: number;
    available_slots: number;
    next_recommended_slot: number | null;
    allocated_fingerprints: number[];
  }> {
    const token = (typeof window !== 'undefined' && sessionStorage.getItem('taporaa_admin_token')) || 'taporaa-admin-2026';
    const res = await fetch(apiUrl('/api/admin/sensor-capacity'), {
      headers: {
        'x-admin-passcode': token,
      },
    });
    if (!res.ok) throw new Error('Failed to load sensor capacity');
    return res.json();
  },

  // 18. AS608 Fingerprint Enrollment
  async enrollFingerprint(payload: {
    fingerprint_id: number;
    passenger_name?: string;
    mode?: string;
  }): Promise<{
    success: boolean;
    status: string;
    message: string;
    sensor: string;
    instructions: string;
  }> {
    const token = (typeof window !== 'undefined' && sessionStorage.getItem('taporaa_admin_token')) || 'taporaa-admin-2026';
    const res = await fetch(apiUrl('/api/admin/enroll-fingerprint'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-passcode': token,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Enrollment failed');
    return data;
  },

  // 19. Device Monitor — Connected Gates
  async getDevices(): Promise<{
    success: boolean;
    total_devices: number;
    online_count: number;
    devices: Array<{
      device_id: string;
      name: string;
      station_id: number;
      station_name: string;
      role: string;
      ip_address: string;
      last_seen: number;
      status: string;
      seconds_since_last_seen: number;
    }>;
  }> {
    const token = (typeof window !== 'undefined' && sessionStorage.getItem('taporaa_admin_token')) || 'taporaa-admin-2026';
    const res = await fetch(apiUrl('/api/admin/devices'), {
      headers: { 'x-admin-passcode': token },
    });
    if (!res.ok) throw new Error('Failed to fetch devices');
    return res.json();
  },

  // 20. Device Monitor — Live Events Stream
  async getDeviceEvents(params?: {
    since?: number;
    type?: string;
    limit?: number;
  }): Promise<{
    success: boolean;
    events: Array<{
      id: string;
      timestamp: number;
      type: string;
      fingerprint_id?: number;
      passenger_name?: string;
      device_id?: string;
      station_name?: string;
      gate_command?: string;
      details?: any;
    }>;
    total_events: number;
    timestamp: number;
  }> {
    const token = (typeof window !== 'undefined' && sessionStorage.getItem('taporaa_admin_token')) || 'taporaa-admin-2026';
    const query = new URLSearchParams();
    if (params?.since) query.set('since', String(params.since));
    if (params?.type) query.set('type', params.type);
    if (params?.limit) query.set('limit', String(params.limit));

    const res = await fetch(apiUrl(`/api/admin/device-events?${query.toString()}`), {
      headers: { 'x-admin-passcode': token },
    });
    if (!res.ok) throw new Error('Failed to load device events');
    return res.json();
  },

  // 21. Device Monitor — Test Event Trigger
  async triggerTestEvent(payload: {
    type: string;
    fingerprint_id?: number;
    device_id?: string;
  }): Promise<{ success: boolean; message: string; event: any }> {
    const token = (typeof window !== 'undefined' && sessionStorage.getItem('taporaa_admin_token')) || 'taporaa-admin-2026';
    const res = await fetch(apiUrl('/api/admin/device-events/test'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-passcode': token,
      },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  // 22. Passenger App — Unknown Fingerprint Polling
  async getUnknownFingerprintAlerts(): Promise<{
    has_alert: boolean;
    latest_alert: {
      id: string;
      timestamp: number;
      device_id?: string;
      station_name?: string;
      message: string;
    } | null;
    alerts: Array<{
      id: string;
      timestamp: number;
      device_id?: string;
      station_name?: string;
      message: string;
    }>;
  }> {
    const res = await fetch(apiUrl('/api/hardware/unknown-fingerprints'));
    if (!res.ok) throw new Error('Failed to poll unknown fingerprint alerts');
    return res.json();
  },

  // 23. Passenger App — Dismiss Alert
  async dismissUnknownAlert(): Promise<{ success: boolean }> {
    const res = await fetch(apiUrl('/api/hardware/unknown-fingerprints/dismiss'), {
      method: 'POST',
    });
    return res.json();
  },
};
