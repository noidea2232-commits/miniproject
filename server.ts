import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
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
} from './src/types/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Server configuration from environment
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zxbwmcpbrpghtfhsuktv.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const BIO_DEVICE_TOKEN = process.env.BIO_DEVICE_TOKEN || '';
const ADMIN_PASSCODE = process.env.ADMIN_ACCESS_PASSCODE || 'taporaa-admin-2026';

// ---------------------------------------------------------
// Real Station Records (Integer IDs matching Supabase schema)
// ---------------------------------------------------------
const stations: Station[] = [
  { id: 1, name: 'Majestic (Nadaprabhu Kempegowda)', code: 'MAJ', line: 'Purple Line', zone: 'Central Interchange', distance_km: 0, is_active: true },
  { id: 2, name: 'Indiranagar', code: 'IDN', line: 'Purple Line', zone: 'Zone 2', distance_km: 8.2, is_active: true },
  { id: 3, name: 'Mahatma Gandhi Road (MG Road)', code: 'MGR', line: 'Purple Line', zone: 'Zone 1', distance_km: 4.8, is_active: true },
  { id: 4, name: 'Baiyappanahalli', code: 'BYP', line: 'Purple Line', zone: 'Zone 3', distance_km: 11.0, is_active: true },
  { id: 5, name: 'Cubbon Park', code: 'CBP', line: 'Purple Line', zone: 'Zone 1', distance_km: 2.4, is_active: true },
  { id: 6, name: 'Dr. B.R. Ambedkar Vidhana Soudha', code: 'VDS', line: 'Purple Line', zone: 'Zone 1', distance_km: 3.2, is_active: true },
  { id: 7, name: 'Trinity', code: 'TRN', line: 'Purple Line', zone: 'Zone 2', distance_km: 6.0, is_active: true },
  { id: 8, name: 'Swami Vivekananda Road', code: 'SVR', line: 'Purple Line', zone: 'Zone 3', distance_km: 9.5, is_active: true },
];

const fareRules: FareRule[] = [
  { from_station_id: 1, to_station_id: 2, fare: 15 },
  { from_station_id: 2, to_station_id: 1, fare: 15 },
  { from_station_id: 1, to_station_id: 3, fare: 12 },
  { from_station_id: 3, to_station_id: 1, fare: 12 },
  { from_station_id: 1, to_station_id: 4, fare: 18 },
  { from_station_id: 4, to_station_id: 1, fare: 18 },
  { from_station_id: 2, to_station_id: 3, fare: 10 },
  { from_station_id: 3, to_station_id: 2, fare: 10 },
  { from_station_id: 2, to_station_id: 4, fare: 10 },
  { from_station_id: 4, to_station_id: 2, fare: 10 },
  { from_station_id: 1, to_station_id: 5, fare: 10 },
  { from_station_id: 5, to_station_id: 1, fare: 10 },
  { from_station_id: 1, to_station_id: 6, fare: 10 },
  { from_station_id: 6, to_station_id: 1, fare: 10 },
  { from_station_id: 1, to_station_id: 7, fare: 14 },
  { from_station_id: 7, to_station_id: 1, fare: 14 },
  { from_station_id: 1, to_station_id: 8, fare: 16 },
  { from_station_id: 8, to_station_id: 1, fare: 16 },
];

function getStationNum(val: any): number {
  if (typeof val === 'number') return val;
  const parsed = parseInt(String(val), 10);
  if (!isNaN(parsed)) return parsed;
  // Match by code or name
  const upper = String(val).toUpperCase();
  const found = stations.find((s) => s.code === upper || String(s.name).toUpperCase().includes(upper));
  return found ? Number(found.id) : 1;
}

function calculateFare(fromId: number | string, toId: number | string): number {
  const n1 = getStationNum(fromId);
  const n2 = getStationNum(toId);
  if (n1 === n2) return 10;

  const direct = fareRules.find(
    (r) => (Number(r.from_station_id) === n1 && Number(r.to_station_id) === n2) ||
           (Number(r.from_station_id) === n2 && Number(r.to_station_id) === n1)
  );
  if (direct) return direct.fare;

  const s1 = stations.find((s) => Number(s.id) === n1);
  const s2 = stations.find((s) => Number(s.id) === n2);
  if (s1 && s2) {
    const dist = Math.abs(s1.distance_km - s2.distance_km);
    if (dist <= 3) return 10;
    if (dist <= 6) return 12;
    if (dist <= 9) return 15;
    if (dist <= 12) return 18;
    return 20;
  }
  return 15;
}

// In-memory runtime cache for state synchronized with Supabase
let passengers: Passenger[] = [];
let journeys: Journey[] = [];
let transactions: WalletTransaction[] = [];
const serverStartTime = Date.now();

// ---------------------------------------------------------
// Real Supabase Edge Function Integration
// ---------------------------------------------------------

/**
 * Fetch passenger profile directly from Supabase passenger-lookup Edge Function
 */
async function fetchSupabasePassenger(fingerprint_id: number): Promise<Passenger | null> {
  if (!SUPABASE_URL || !BIO_DEVICE_TOKEN) return null;
  try {
    const edgeUrl = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/passenger-lookup`;
    const res = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': BIO_DEVICE_TOKEN,
        ...(SUPABASE_ANON_KEY ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}),
      },
      body: JSON.stringify({ fingerprint_id }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.recognized && data.passenger) {
        const p: Passenger = {
          id: `TAP-PASS-${data.passenger.fingerprint_id}`,
          name: data.passenger.name,
          fingerprint_id: data.passenger.fingerprint_id,
          wallet_balance: Number(data.passenger.wallet_balance),
          status: data.passenger.status?.toLowerCase() === 'active' ? 'active' : 'inactive',
          phone: `+91 98450 •••${String(data.passenger.fingerprint_id).padStart(2, '0')}`,
          email: `${data.passenger.name.toLowerCase().replace(/\s+/g, '.')}@taporaa.transit`,
          created_at: new Date().toISOString(),
        };

        // Cache or update in local list
        const existingIdx = passengers.findIndex((x) => x.fingerprint_id === p.fingerprint_id);
        if (existingIdx >= 0) {
          passengers[existingIdx] = p;
        } else {
          passengers.push(p);
        }
        return p;
      }
    }
  } catch (err) {
    console.warn(`[Supabase] Error calling passenger-lookup for FP #${fingerprint_id}:`, err);
  }
  return null;
}

/**
 * Sync all known enrolled fingerprints on startup
 */
async function syncEnrolledPassengers() {
  console.log('[Taporaa] Synchronizing enrolled passengers from Supabase...');
  for (const fpId of [1, 2, 3]) {
    await fetchSupabasePassenger(fpId);
  }
  console.log(`[Taporaa] Loaded ${passengers.length} real passengers from Supabase.`);
}

function getPassenger(idOrFingerprint: string | number): Passenger | undefined {
  if (typeof idOrFingerprint === 'number') {
    return passengers.find((p) => p.fingerprint_id === idOrFingerprint);
  }
  const num = parseInt(idOrFingerprint, 10);
  if (!isNaN(num) && String(num) === String(idOrFingerprint)) {
    const byFp = passengers.find((p) => p.fingerprint_id === num);
    if (byFp) return byFp;
  }
  return passengers.find((p) => p.id === idOrFingerprint || `TAP-PASS-${p.fingerprint_id}` === idOrFingerprint);
}

function getActiveJourney(passengerId: string): Journey | undefined {
  return journeys.find((j) => j.passenger_id === passengerId && j.status === 'IN_PROGRESS');
}

// ---------------------------------------------------------
// API Endpoints
// ---------------------------------------------------------

// 1. Passenger Lookup (/api/edge/passenger-lookup)
app.post('/api/edge/passenger-lookup', async (req: Request, res: Response) => {
  try {
    const { fingerprint_id, passenger_id } = req.body;
    const fpId = fingerprint_id ? Number(fingerprint_id) : parseInt(String(passenger_id).replace(/\D/g, ''), 10) || 1;

    // Call real Supabase Edge Function
    if (SUPABASE_URL && BIO_DEVICE_TOKEN) {
      try {
        const edgeUrl = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/passenger-lookup`;
        const edgeRes = await fetch(edgeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-device-token': BIO_DEVICE_TOKEN,
            ...(SUPABASE_ANON_KEY ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}),
          },
          body: JSON.stringify({ fingerprint_id: fpId }),
        });

        if (edgeRes.ok) {
          const edgeData = await edgeRes.json();
          if (!edgeData.recognized || !edgeData.passenger) {
            return res.status(404).json({
              error: 'Passenger not recognized',
              message: edgeData.error || `No registered passenger found with fingerprint ID: ${fpId}`,
              code: 'PASSENGER_NOT_FOUND',
            });
          }

          const realPassenger: Passenger = {
            id: `TAP-PASS-${edgeData.passenger.fingerprint_id}`,
            name: edgeData.passenger.name,
            fingerprint_id: edgeData.passenger.fingerprint_id,
            wallet_balance: Number(edgeData.passenger.wallet_balance),
            status: edgeData.passenger.status?.toLowerCase() === 'active' ? 'active' : 'inactive',
            phone: `+91 98450 •••${String(edgeData.passenger.fingerprint_id).padStart(2, '0')}`,
            email: `${edgeData.passenger.name.toLowerCase().replace(/\s+/g, '.')}@taporaa.transit`,
            created_at: new Date().toISOString(),
          };

          // Update cached passenger state
          const existingIdx = passengers.findIndex((p) => p.fingerprint_id === realPassenger.fingerprint_id);
          if (existingIdx >= 0) passengers[existingIdx] = realPassenger;
          else passengers.push(realPassenger);

          const active = getActiveJourney(realPassenger.id);

          return res.json({
            success: true,
            recognized: true,
            passenger: realPassenger,
            has_active_journey: !!active,
            active_journey: active || null,
          });
        }
      } catch (err: any) {
        console.warn('[Proxy] Supabase edge function passenger-lookup error:', err.message);
      }
    }

    // Fallback to cached passenger if network error
    const passenger = getPassenger(fpId);
    if (!passenger) {
      return res.status(404).json({
        error: 'Passenger not recognized',
        message: `Biometric sensor AS608 ID #${fpId} not recognized in transit database.`,
        code: 'PASSENGER_NOT_FOUND',
      });
    }

    const active = getActiveJourney(passenger.id);
    return res.json({
      success: true,
      recognized: true,
      passenger,
      has_active_journey: !!active,
      active_journey: active || null,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Server error during passenger lookup', message: error.message });
  }
});

// 2. Check-In (/api/edge/check-in)
app.post('/api/edge/check-in', async (req: Request, res: Response) => {
  try {
    const { fingerprint_id, passenger_id, station_id, device_id } = req.body;
    const fpId = fingerprint_id ? Number(fingerprint_id) : parseInt(String(passenger_id).replace(/\D/g, ''), 10) || 1;
    const stationNum = getStationNum(station_id);

    // Refresh passenger profile from Supabase first
    const passenger = (await fetchSupabasePassenger(fpId)) || getPassenger(fpId);

    if (!passenger) {
      return res.status(404).json({
        error: 'Passenger not recognized',
        message: 'Biometric fingerprint ID not registered in transit database.',
        code: 'PASSENGER_NOT_FOUND',
      });
    }

    if (passenger.status !== 'active') {
      return res.status(403).json({
        error: 'Account not active',
        message: `Passenger account is currently ${passenger.status}. Access denied.`,
        code: 'ACCOUNT_INACTIVE',
      });
    }

    const station = stations.find((s) => Number(s.id) === stationNum) || stations[0];

    // Minimum balance check (₹10 minimum required)
    if (passenger.wallet_balance < 10) {
      return res.status(400).json({
        error: 'Insufficient balance',
        message: `Wallet balance (₹${passenger.wallet_balance.toFixed(2)}) is below minimum required balance (₹10.00) to enter gate.`,
        code: 'INSUFFICIENT_BALANCE',
        current_balance: passenger.wallet_balance,
      });
    }

    // Duplicate active journey check
    const existingActive = getActiveJourney(passenger.id);
    if (existingActive) {
      return res.status(409).json({
        error: 'Active journey exists',
        message: `Passenger already has an active journey in progress (Code: ${existingActive.journey_code}) boarded at ${existingActive.entry_station_name}.`,
        code: 'DUPLICATE_ACTIVE_JOURNEY',
        active_journey: existingActive,
      });
    }

    // Attempt real Supabase Edge Function check-in if deployed
    if (SUPABASE_URL && BIO_DEVICE_TOKEN) {
      try {
        const edgeUrl = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/check-in`;
        const edgeRes = await fetch(edgeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-device-token': BIO_DEVICE_TOKEN,
            ...(SUPABASE_ANON_KEY ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}),
          },
          body: JSON.stringify({ fingerprint_id: fpId, station_id: stationNum, entry_station_id: stationNum, device_id }),
        });

        if (edgeRes.ok) {
          const edgeData = await edgeRes.json();
          // Sync with local memory
          const now = new Date();
          const journey: Journey = edgeData.journey || {
            id: `jrn-${Date.now()}`,
            journey_code: `TAP-JRN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`,
            passenger_id: passenger.id,
            passenger_name: passenger.name,
            entry_station_id: stationNum,
            entry_station_name: station.name,
            entry_time: now.toISOString(),
            exit_station_id: null,
            exit_station_name: null,
            exit_time: null,
            fare: null,
            status: 'IN_PROGRESS',
            device_entry_id: device_id || 'ESP32-GATE-TERMINAL-01',
            created_at: now.toISOString(),
          };
          journeys.unshift(journey);

          return res.status(201).json({
            success: true,
            message: `Check-in successful at ${station.name}. Gate opened.`,
            journey,
            passenger: { id: passenger.id, name: passenger.name, wallet_balance: passenger.wallet_balance },
          });
        }
      } catch (err: any) {
        console.warn('[Proxy] Supabase edge check-in request error, executing atomic server session:', err.message);
      }
    }

    // Atomic server session check-in
    const now = new Date();
    const journeyCode = `TAP-JRN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newJourney: Journey = {
      id: `jrn-${Date.now()}`,
      journey_code: journeyCode,
      passenger_id: passenger.id,
      passenger_name: passenger.name,
      entry_station_id: stationNum,
      entry_station_name: station.name,
      entry_time: now.toISOString(),
      exit_station_id: null,
      exit_station_name: null,
      exit_time: null,
      fare: null,
      status: 'IN_PROGRESS',
      device_entry_id: device_id || 'ESP32-GATE-TERMINAL-01',
      created_at: now.toISOString(),
    };
    journeys.unshift(newJourney);

    return res.status(201).json({
      success: true,
      message: `Check-in successful at ${station.name}. Gate opened.`,
      journey: newJourney,
      passenger: {
        id: passenger.id,
        name: passenger.name,
        wallet_balance: passenger.wallet_balance,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Server error during check-in', message: error.message });
  }
});

// 3. Check-Out (/api/edge/check-out)
app.post('/api/edge/check-out', async (req: Request, res: Response) => {
  try {
    const { fingerprint_id, passenger_id, station_id, exit_station_id, device_id } = req.body;
    const fpId = fingerprint_id ? Number(fingerprint_id) : parseInt(String(passenger_id).replace(/\D/g, ''), 10) || 1;
    const stationNum = getStationNum(exit_station_id || station_id);

    const passenger = (await fetchSupabasePassenger(fpId)) || getPassenger(fpId);

    if (!passenger) {
      return res.status(404).json({
        error: 'Passenger not recognized',
        message: 'Biometric fingerprint ID not registered in transit database.',
        code: 'PASSENGER_NOT_FOUND',
      });
    }

    const activeJourney = getActiveJourney(passenger.id);
    if (!activeJourney) {
      return res.status(400).json({
        error: 'No active journey',
        message: 'No active journey found for passenger. Please scan at entry gate first.',
        code: 'NO_ACTIVE_JOURNEY',
      });
    }

    const exitStation = stations.find((s) => Number(s.id) === stationNum) || stations[1];

    // Attempt real Supabase Edge Function check-out
    if (SUPABASE_URL && BIO_DEVICE_TOKEN) {
      try {
        const edgeUrl = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/check-out`;
        const edgeRes = await fetch(edgeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-device-token': BIO_DEVICE_TOKEN,
            ...(SUPABASE_ANON_KEY ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}),
          },
          body: JSON.stringify({ fingerprint_id: fpId, exit_station_id: stationNum, device_id }),
        });

        if (edgeRes.ok) {
          const edgeData = await edgeRes.json();
          const fare = Number(edgeData.fare || edgeData.fare_deducted || calculateFare(activeJourney.entry_station_id, exitStation.id));
          const updatedBalance = Number(edgeData.updated_balance ?? (passenger.wallet_balance - fare));

          // Complete journey locally
          const now = new Date();
          activeJourney.exit_station_id = stationNum;
          activeJourney.exit_station_name = exitStation.name;
          activeJourney.exit_time = now.toISOString();
          activeJourney.fare = fare;
          activeJourney.status = 'COMPLETED';

          passenger.wallet_balance = updatedBalance;

          const txn: WalletTransaction = {
            id: `txn-${Date.now()}`,
            transaction_id: edgeData.transaction_id || `TXN-${Math.floor(1000 + Math.random() * 9000)}-FAR`,
            passenger_id: passenger.id,
            passenger_name: passenger.name,
            journey_id: activeJourney.id,
            type: 'FARE_DEDUCTION',
            amount: fare,
            previous_balance: passenger.wallet_balance + fare,
            updated_balance: updatedBalance,
            description: `Metro Fare: ${activeJourney.entry_station_name.split(' (')[0]} to ${exitStation.name.split(' (')[0]}`,
            created_at: now.toISOString(),
          };
          transactions.unshift(txn);

          return res.json({
            success: true,
            message: `Check-out confirmed at ${exitStation.name}. Fare ₹${fare.toFixed(2)} deducted. Gate opened.`,
            journey: activeJourney,
            fare,
            previous_balance: txn.previous_balance,
            updated_balance: updatedBalance,
            transaction_id: txn.transaction_id,
            passenger: { id: passenger.id, name: passenger.name, wallet_balance: updatedBalance },
          });
        } else {
          const errData = await edgeRes.json().catch(() => ({}));
          if (errData.error && !errData.error.includes('No active journey')) {
            return res.status(edgeRes.status).json(errData);
          }
        }
      } catch (err: any) {
        console.warn('[Proxy] Supabase check-out error, falling back to atomic server calculation:', err.message);
      }
    }

    // Atomic server fallback calculation
    const calculatedFare = calculateFare(activeJourney.entry_station_id, exitStation.id);

    if (passenger.wallet_balance < calculatedFare) {
      return res.status(400).json({
        error: 'Insufficient balance',
        message: `Fare is ₹${calculatedFare.toFixed(2)}, but available wallet balance is only ₹${passenger.wallet_balance.toFixed(2)}. Please recharge wallet.`,
        code: 'INSUFFICIENT_BALANCE',
        required_fare: calculatedFare,
        current_balance: passenger.wallet_balance,
      });
    }

    const previousBalance = passenger.wallet_balance;
    const updatedBalance = Number((previousBalance - calculatedFare).toFixed(2));
    passenger.wallet_balance = updatedBalance;

    const now = new Date();
    activeJourney.exit_station_id = stationNum;
    activeJourney.exit_station_name = exitStation.name;
    activeJourney.exit_time = now.toISOString();
    activeJourney.fare = calculatedFare;
    activeJourney.status = 'COMPLETED';
    activeJourney.device_exit_id = device_id || 'ESP32-GATE-TERMINAL-02';

    const newTxn: WalletTransaction = {
      id: `txn-${Date.now()}`,
      transaction_id: `TXN-${Math.floor(1000 + Math.random() * 9000)}-FAR`,
      passenger_id: passenger.id,
      passenger_name: passenger.name,
      journey_id: activeJourney.id,
      type: 'FARE_DEDUCTION',
      amount: calculatedFare,
      previous_balance: previousBalance,
      updated_balance: updatedBalance,
      description: `Metro Fare: ${activeJourney.entry_station_name.split(' (')[0]} to ${exitStation.name.split(' (')[0]}`,
      created_at: now.toISOString(),
    };
    transactions.unshift(newTxn);

    return res.json({
      success: true,
      message: `Check-out confirmed at ${exitStation.name}. Fare ₹${calculatedFare.toFixed(2)} deducted. Gate opened.`,
      journey: activeJourney,
      fare: calculatedFare,
      previous_balance: previousBalance,
      updated_balance: updatedBalance,
      transaction_id: newTxn.transaction_id,
      passenger: {
        id: passenger.id,
        name: passenger.name,
        wallet_balance: passenger.wallet_balance,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Server error during check-out', message: error.message });
  }
});

// 4. Hardware Terminal Scan (/api/hardware/scan)
app.post('/api/hardware/scan', async (req: Request, res: Response) => {
  const { fingerprint_id, station_id, gate_type, device_id } = req.body as HardwareScanRequest;
  const fpId = Number(fingerprint_id);
  const stationNum = getStationNum(station_id);

  // Sync passenger from Supabase
  const passenger = (await fetchSupabasePassenger(fpId)) || getPassenger(fpId);

  const now = new Date().toISOString();

  if (!passenger) {
    return res.status(404).json({
      success: false,
      action: 'error',
      gate_command: 'REJECT',
      display_text: 'UNKNOWN FINGERPRINT - ACCESS DENIED',
      message: `Biometric sensor AS608 ID #${fpId} not registered in transit database`,
      timestamp: now,
      error_code: 'FINGERPRINT_NOT_FOUND',
    } as HardwareScanResult);
  }

  if (passenger.status !== 'active') {
    return res.status(403).json({
      success: false,
      action: 'error',
      gate_command: 'REJECT',
      display_text: 'CARD/ACC INACTIVE - VISIT DESK',
      message: `Passenger account is ${passenger.status}`,
      timestamp: now,
      error_code: 'ACCOUNT_INACTIVE',
    } as HardwareScanResult);
  }

  const activeJourney = getActiveJourney(passenger.id);
  const shouldCheckOut = gate_type === 'exit' || (gate_type === 'auto' && !!activeJourney);

  if (shouldCheckOut) {
    if (!activeJourney) {
      return res.status(400).json({
        success: false,
        action: 'error',
        gate_command: 'REJECT',
        display_text: 'NO CHECK-IN FOUND',
        message: 'No active entry recorded. Please scan at entry gate.',
        timestamp: now,
        error_code: 'NO_ACTIVE_JOURNEY',
      } as HardwareScanResult);
    }

    const exitStation = stations.find((s) => Number(s.id) === stationNum) || stations[1];
    const fare = calculateFare(activeJourney.entry_station_id, exitStation.id);

    if (passenger.wallet_balance < fare) {
      return res.status(400).json({
        success: false,
        action: 'error',
        gate_command: 'REJECT',
        display_text: `LOW BAL: ₹${passenger.wallet_balance.toFixed(0)} - FARE: ₹${fare}`,
        message: `Insufficient balance (₹${passenger.wallet_balance.toFixed(2)}) for fare (₹${fare.toFixed(2)})`,
        timestamp: now,
        error_code: 'INSUFFICIENT_BALANCE',
      } as HardwareScanResult);
    }

    const prevBal = passenger.wallet_balance;
    const updBal = Number((prevBal - fare).toFixed(2));
    passenger.wallet_balance = updBal;

    activeJourney.exit_station_id = stationNum;
    activeJourney.exit_station_name = exitStation.name;
    activeJourney.exit_time = now;
    activeJourney.fare = fare;
    activeJourney.status = 'COMPLETED';
    activeJourney.device_exit_id = device_id || 'ESP32-AS608-EXIT';

    const txn: WalletTransaction = {
      id: `txn-${Date.now()}`,
      transaction_id: `TXN-${Math.floor(1000 + Math.random() * 9000)}-FAR`,
      passenger_id: passenger.id,
      passenger_name: passenger.name,
      journey_id: activeJourney.id,
      type: 'FARE_DEDUCTION',
      amount: fare,
      previous_balance: prevBal,
      updated_balance: updBal,
      description: `Terminal Exit: ${exitStation.name.split(' (')[0]}`,
      created_at: now,
    };
    transactions.unshift(txn);

    return res.json({
      success: true,
      action: 'check_out',
      gate_command: 'OPEN',
      display_text: `BYE ${passenger.name.split(' ')[0].toUpperCase()} - FARE ₹${fare} - BAL ₹${updBal}`,
      message: `Check-out successful. ₹${fare} deducted.`,
      passenger,
      journey: activeJourney,
      fare_deducted: fare,
      previous_balance: prevBal,
      updated_balance: updBal,
      timestamp: now,
    } as HardwareScanResult);
  } else {
    // Check-in
    if (activeJourney) {
      return res.status(409).json({
        success: false,
        action: 'error',
        gate_command: 'REJECT',
        display_text: 'ALREADY CHECKED IN',
        message: `Active journey already started at ${activeJourney.entry_station_name}`,
        timestamp: now,
        error_code: 'DUPLICATE_ACTIVE_JOURNEY',
      } as HardwareScanResult);
    }

    const station = stations.find((s) => Number(s.id) === stationNum) || stations[0];
    if (passenger.wallet_balance < 10) {
      return res.status(400).json({
        success: false,
        action: 'error',
        gate_command: 'REJECT',
        display_text: `LOW BAL: ₹${passenger.wallet_balance.toFixed(0)} - MIN ₹10`,
        message: 'Minimum balance ₹10 required to board',
        timestamp: now,
        error_code: 'INSUFFICIENT_BALANCE',
      } as HardwareScanResult);
    }

    const journeyCode = `TAP-JRN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newJourney: Journey = {
      id: `jrn-${Date.now()}`,
      journey_code: journeyCode,
      passenger_id: passenger.id,
      passenger_name: passenger.name,
      entry_station_id: stationNum,
      entry_station_name: station.name,
      entry_time: now,
      exit_station_id: null,
      exit_station_name: null,
      exit_time: null,
      fare: null,
      status: 'IN_PROGRESS',
      device_entry_id: device_id || 'ESP32-AS608-ENTRY',
      created_at: now,
    };
    journeys.unshift(newJourney);

    return res.json({
      success: true,
      action: 'check_in',
      gate_command: 'OPEN',
      display_text: `WELCOME ${passenger.name.split(' ')[0].toUpperCase()} - BAL ₹${passenger.wallet_balance}`,
      message: `Check-in successful at ${station.name}`,
      passenger,
      journey: newJourney,
      timestamp: now,
    } as HardwareScanResult);
  }
});

// List Stations & Fare Rules
app.get('/api/stations', (_req: Request, res: Response) => {
  return res.json({ stations, fare_rules: fareRules });
});

// List Passengers (Real Supabase accounts)
app.get('/api/passengers', (req: Request, res: Response) => {
  const { status, search } = req.query;
  let list = [...passengers];
  if (status && status !== 'all') {
    list = list.filter((p) => p.status === status);
  }
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        String(p.fingerprint_id).includes(q)
    );
  }
  return res.json({ passengers: list });
});

// Single Passenger
app.get('/api/passengers/:id', async (req: Request, res: Response) => {
  let passenger = getPassenger(req.params.id);

  // If not found in cache, attempt lookup from Supabase by FP ID
  if (!passenger) {
    const num = parseInt(req.params.id.replace(/\D/g, ''), 10);
    if (!isNaN(num)) {
      passenger = (await fetchSupabasePassenger(num)) || undefined;
    }
  }

  if (!passenger) {
    return res.status(404).json({ error: 'Passenger not found in Supabase database' });
  }

  const activeJourney = getActiveJourney(passenger.id);
  const passengerJourneys = journeys.filter((j) => j.passenger_id === passenger.id);
  const passengerTxns = transactions.filter((t) => t.passenger_id === passenger.id);

  return res.json({
    passenger,
    active_journey: activeJourney || null,
    journeys: passengerJourneys,
    transactions: passengerTxns,
  });
});

// List Journeys
app.get('/api/journeys', (req: Request, res: Response) => {
  const { status, passenger_id, limit } = req.query;
  let list = [...journeys];
  if (status && status !== 'all') {
    list = list.filter((j) => j.status === status);
  }
  if (passenger_id) {
    list = list.filter((j) => j.passenger_id === passenger_id);
  }
  if (limit) {
    list = list.slice(0, parseInt(String(limit), 10));
  }
  return res.json({ journeys: list });
});

// List Transactions
app.get('/api/transactions', (req: Request, res: Response) => {
  const { passenger_id, limit } = req.query;
  let list = [...transactions];
  if (passenger_id) {
    list = list.filter((t) => t.passenger_id === passenger_id);
  }
  if (limit) {
    list = list.slice(0, parseInt(String(limit), 10));
  }
  return res.json({ transactions: list });
});

// Admin Metrics (Calculated dynamically from real database records)
app.get('/api/admin/metrics', (_req: Request, res: Response) => {
  const totalFare = transactions
    .filter((t) => t.type === 'FARE_DEDUCTION')
    .reduce((acc, t) => acc + t.amount, 0);

  const metrics: AdminMetrics = {
    total_passengers: passengers.length,
    active_passengers: passengers.filter((p) => p.status === 'active').length,
    active_journeys: journeys.filter((j) => j.status === 'IN_PROGRESS').length,
    completed_journeys: journeys.filter((j) => j.status === 'COMPLETED').length,
    total_transactions: transactions.length,
    total_fare_collected: Number(totalFare.toFixed(2)),
    active_devices: 4,
    system_uptime_seconds: Math.floor((Date.now() - serverStartTime) / 1000),
  };

  return res.json({ metrics });
});

// System Status & Health
app.get('/api/system/status', async (_req: Request, res: Response) => {
  // Test live status of Edge Functions
  let lookupStatus: 'connected' | 'unreachable' | 'local_fallback' = 'unreachable';
  let checkoutStatus: 'connected' | 'unreachable' | 'local_fallback' = 'unreachable';
  let checkinStatus: 'connected' | 'unreachable' | 'local_fallback' = 'local_fallback';

  if (SUPABASE_URL && BIO_DEVICE_TOKEN) {
    try {
      const lRes = await fetch(`${SUPABASE_URL}/functions/v1/passenger-lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-device-token': BIO_DEVICE_TOKEN },
        body: JSON.stringify({ fingerprint_id: 1 }),
      });
      if (lRes.status === 200 || lRes.status === 400) lookupStatus = 'connected';
    } catch {}

    try {
      const coRes = await fetch(`${SUPABASE_URL}/functions/v1/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-device-token': BIO_DEVICE_TOKEN },
        body: JSON.stringify({ fingerprint_id: 1, exit_station_id: 1 }),
      });
      if (coRes.status === 200 || coRes.status === 400) checkoutStatus = 'connected';
    } catch {}

    try {
      const ciRes = await fetch(`${SUPABASE_URL}/functions/v1/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-device-token': BIO_DEVICE_TOKEN },
        body: JSON.stringify({ fingerprint_id: 1, station_id: 1 }),
      });
      if (ciRes.status === 200 || ciRes.status === 201 || ciRes.status === 400) checkinStatus = 'connected';
    } catch {}
  }

  const status: SystemStatus = {
    backend_mode: 'supabase_edge_proxy',
    supabase_configured: !!SUPABASE_URL,
    supabase_url: SUPABASE_URL,
    device_token_configured: !!BIO_DEVICE_TOKEN,
    edge_functions: {
      passenger_lookup: lookupStatus,
      check_in: checkinStatus,
      check_out: checkoutStatus,
    },
    last_heartbeat: new Date().toISOString(),
  };

  return res.json({ status });
});

// Top-up digital wallet
app.post('/api/passengers/:id/topup', (req: Request, res: Response) => {
  const { amount } = req.body;
  const topupAmount = parseFloat(amount);
  if (isNaN(topupAmount) || topupAmount <= 0) {
    return res.status(400).json({ error: 'Valid top-up amount required' });
  }

  const passenger = getPassenger(req.params.id);
  if (!passenger) {
    return res.status(404).json({ error: 'Passenger not found' });
  }

  const prev = passenger.wallet_balance;
  const upd = Number((prev + topupAmount).toFixed(2));
  passenger.wallet_balance = upd;

  const txn: WalletTransaction = {
    id: `txn-${Date.now()}`,
    transaction_id: `TXN-${Math.floor(1000 + Math.random() * 9000)}-TOP`,
    passenger_id: passenger.id,
    passenger_name: passenger.name,
    journey_id: null,
    type: 'WALLET_TOPUP',
    amount: topupAmount,
    previous_balance: prev,
    updated_balance: upd,
    description: `Digital Transit Wallet Top-Up`,
    created_at: new Date().toISOString(),
  };
  transactions.unshift(txn);

  return res.json({
    success: true,
    message: `₹${topupAmount} added to wallet. New balance: ₹${upd.toFixed(2)}`,
    previous_balance: prev,
    updated_balance: upd,
    transaction: txn,
  });
});

// Admin Passcode Authentication check
app.post('/api/admin/verify-passcode', (req: Request, res: Response) => {
  const { passcode } = req.body;
  if (passcode === ADMIN_PASSCODE) {
    return res.json({ success: true, token: 'session-admin-taporaa' });
  }
  return res.status(401).json({ success: false, error: 'Invalid administrator passcode' });
});

// ---------------------------------------------------------
// Vite Middleware / Static Serving Setup
// ---------------------------------------------------------
async function startServer() {
  await syncEnrolledPassengers();

  const distDir = path.join(__dirname, 'dist');
  const indexHtmlPath = path.join(distDir, 'index.html');
  const hasDist = fs.existsSync(indexHtmlPath);

  if (process.env.NODE_ENV === 'production' || hasDist) {
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(indexHtmlPath);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Taporaa Transit Platform] Server running at http://0.0.0.0:${PORT}`);
    console.log(`[Taporaa] Connected to Supabase Project: ${SUPABASE_URL}`);
    console.log(`[Taporaa] Real Passengers synced: ${passengers.map((p) => `${p.name} (FP #${p.fingerprint_id}: ₹${p.wallet_balance})`).join(', ')}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Taporaa server:', err);
  process.exit(1);
});
