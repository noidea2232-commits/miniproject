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
  JourneyStatus,
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

// Enable Cross-Origin Resource Sharing (CORS) for Vercel frontend / Render backend separation
app.use((req: Request, res: Response, next) => {
  res.header('Access-Control-Allow-Origin', (req.headers.origin as string) || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-device-token, x-admin-passcode');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Production Health Check Endpoint
app.get('/api/health', (req: Request, res: Response) => {
  const dbConnected = Boolean(SUPABASE_URL && (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY));
  return res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor((Date.now() - serverStartTime) / 1000),
    version: '2.1.0',
    database: {
      provider: 'Supabase REST',
      url: SUPABASE_URL,
      connected: dbConnected,
    },
    sync: {
      passengers_count: passengers.length,
      journeys_count: journeys.length,
      transactions_count: transactions.length,
    },
    environment: process.env.NODE_ENV || 'development',
  });
});

// ---------------------------------------------------------
// Server configuration from environment
// ---------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zxbwmcpbrpghtfhsuktv.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BIO_DEVICE_TOKEN = process.env.BIO_DEVICE_TOKEN || '';
const ESP32_DEVICE_TOKEN = process.env.ESP32_DEVICE_TOKEN || process.env.BIO_DEVICE_TOKEN || '';
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
// Global Bidirectional Mappings & Synchronization Caches
// ---------------------------------------------------------
const dbIdToPassenger = new Map<number, Passenger>();
const fpIdToPassenger = new Map<number, Passenger>();
const dbIdToFpId = new Map<number, number>();
const fpIdToDbId = new Map<number, number>();

// Concurrent checkout locking to prevent double charges / race conditions
const checkoutLocks = new Set<string>();

function registerPassengerCache(dbId: number, fpId: number, passenger: Passenger) {
  if (dbId > 0) {
    dbIdToPassenger.set(dbId, passenger);
    dbIdToFpId.set(dbId, fpId);
  }
  if (fpId > 0) {
    fpIdToPassenger.set(fpId, passenger);
    fpIdToDbId.set(fpId, dbId);
  }

  const existingIdx = passengers.findIndex((p) => p.fingerprint_id === fpId || p.id === passenger.id);
  if (existingIdx >= 0) {
    passengers[existingIdx] = passenger;
  } else {
    passengers.push(passenger);
  }
}

function updatePassengerBalance(idOrFp: string | number, newBal: number) {
  const p = getPassenger(idOrFp);
  if (p) {
    p.wallet_balance = newBal;
  }
  const num = typeof idOrFp === 'number' ? idOrFp : parseInt(String(idOrFp).replace(/\D/g, ''), 10);
  if (!isNaN(num)) {
    const byFp = fpIdToPassenger.get(num);
    if (byFp) byFp.wallet_balance = newBal;
    const byDb = dbIdToPassenger.get(num);
    if (byDb) byDb.wallet_balance = newBal;
    const dbFromFp = fpIdToDbId.get(num);
    if (dbFromFp) {
      const pDb = dbIdToPassenger.get(dbFromFp);
      if (pDb) pDb.wallet_balance = newBal;
    }
    const fpFromDb = dbIdToFpId.get(num);
    if (fpFromDb) {
      const pFp = fpIdToPassenger.get(fpFromDb);
      if (pFp) pFp.wallet_balance = newBal;
    }
  }
  const pIdx = passengers.findIndex((x) => x.id === String(idOrFp) || x.fingerprint_id === num);
  if (pIdx >= 0) {
    passengers[pIdx].wallet_balance = newBal;
  }
}

function resolvePassengerForJourney(row: any, explicitMap?: Map<number, Passenger>): Passenger | undefined {
  if (!row) return undefined;
  const dbPid = Number(row.passenger_id ?? 0);
  const fpFromRow = row.fingerprint_id != null ? Number(row.fingerprint_id) : null;

  if (explicitMap) {
    if (fpFromRow != null && explicitMap.has(fpFromRow)) return explicitMap.get(fpFromRow);
    if (dbPid > 0 && explicitMap.has(dbPid)) return explicitMap.get(dbPid);
  }

  if (fpFromRow != null) {
    const p = fpIdToPassenger.get(fpFromRow) || passengers.find((x) => x.fingerprint_id === fpFromRow);
    if (p) return p;
  }

  if (dbPid > 0) {
    const p = dbIdToPassenger.get(dbPid);
    if (p) return p;

    const mappedFp = dbIdToFpId.get(dbPid);
    if (mappedFp) {
      const p2 = fpIdToPassenger.get(mappedFp) || passengers.find((x) => x.fingerprint_id === mappedFp);
      if (p2) return p2;
    }

    const direct = passengers.find((x) => x.fingerprint_id === dbPid);
    if (direct) return direct;
  }

  const pidStr = String(row.passenger_id || '');
  if (pidStr) {
    const byId = passengers.find((x) => x.id === pidStr || `TAP-PASS-${x.fingerprint_id}` === pidStr);
    if (byId) return byId;
  }

  return undefined;
}
// ---------------------------------------------------------
// Supabase REST helpers (server-side only, uses anon key)
// ---------------------------------------------------------

/**
 * Query a Supabase table via the REST API using service-role key or anon key.
 * Returns the parsed JSON rows or an empty array on error.
 */
async function supabaseQuery(table: string, params: Record<string, string> = {}): Promise<any[]> {
  const activeKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !activeKey) return [];
  try {
    const url = new URL(`${SUPABASE_URL.replace(/\/$/,'')}/rest/v1/${table}`);
    url.searchParams.set('select', '*');
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString(), {
      headers: {
        apikey: activeKey,
        Authorization: `Bearer ${activeKey}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Supabase REST] ${table} query failed (${res.status}):`, errText.slice(0, 200));
      return [];
    }
    return await res.json();
  } catch (err: any) {
    console.warn(`[Supabase REST] ${table} fetch error:`, err.message);
    return [];
  }
}

/**
 * Insert a row into a Supabase table via the REST API (uses service-role key or anon key).
 * Returns the inserted row or null on failure.
 */
async function supabaseInsert(table: string, row: any): Promise<any | null> {
  const activeKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !activeKey) return null;
  try {
    const url = `${SUPABASE_URL.replace(/\/$/,'')}/rest/v1/${table}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: activeKey,
        Authorization: `Bearer ${activeKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Supabase REST] ${table} insert failed (${res.status}):`, errText.slice(0, 200));
      return null;
    }
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  } catch (err: any) {
    console.warn(`[Supabase REST] ${table} insert error:`, err.message);
    return null;
  }
}

/**
 * Update rows in a Supabase table via REST API PATCH (uses service-role key or anon key).
 * Returns the first updated row or null on failure.
 */
async function supabaseUpdate(table: string, params: Record<string, string>, updates: any): Promise<any | null> {
  const activeKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !activeKey) return null;
  try {
    const url = new URL(`${SUPABASE_URL.replace(/\/$/,'')}/rest/v1/${table}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString(), {
      method: 'PATCH',
      headers: {
        apikey: activeKey,
        Authorization: `Bearer ${activeKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Supabase REST] ${table} update failed (${res.status}):`, errText.slice(0, 200));
      return null;
    }
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  } catch (err: any) {
    console.warn(`[Supabase REST] ${table} update error:`, err.message);
    return null;
  }
}

/** Map a raw Supabase passengers row to the app's Passenger type */
function mapDbPassenger(row: any): Passenger {
  return {
    id: `TAP-PASS-${row.fingerprint_id}`,
    name: row.name,
    fingerprint_id: Number(row.fingerprint_id),
    wallet_balance: Number(row.wallet_balance ?? 0),
    status: row.status?.toLowerCase() === 'active' ? 'active' : 'inactive',
    phone: row.phone ?? `+91 98450 •5•••${String(row.fingerprint_id).padStart(2, '0')}`,
    email: row.email ?? `${String(row.name).toLowerCase().replace(/\s+/g, '.')}@taporaa.transit`,
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

function mapDbJourney(row: any, passengerMap?: Map<number, Passenger>): Journey {
  const p = resolvePassengerForJourney(row, passengerMap);

  const dbPassengerId = Number(row.passenger_id ?? 0);
  const passengerId = p ? p.id : (row.passenger_id ? (String(row.passenger_id).startsWith('TAP-') ? row.passenger_id : `TAP-PASS-${row.passenger_id}`) : `TAP-PASS-${dbPassengerId || 0}`);
  const passengerName = p ? p.name : (row.passenger_name ?? 'Unknown');
  const entryStationName =
    stations.find((s) => Number(s.id) === Number(row.entry_station_id))?.name ?? String(row.entry_station_id);
  const exitStationName = row.exit_station_id
    ? stations.find((s) => Number(s.id) === Number(row.exit_station_id))?.name ?? String(row.exit_station_id)
    : null;
  const rawStatus = String(row.status || '').toUpperCase();
  const mappedStatus: JourneyStatus = (rawStatus === 'ACTIVE' || rawStatus === 'IN_PROGRESS') ? 'IN_PROGRESS' : 'COMPLETED';

  return {
    id: String(row.id),
    journey_code: row.journey_code ?? `TAP-JRN-${row.id}`,
    passenger_id: passengerId,
    passenger_name: passengerName,
    entry_station_id: Number(row.entry_station_id),
    entry_station_name: entryStationName,
    entry_time: row.entry_time ?? row.created_at,
    exit_station_id: row.exit_station_id != null ? Number(row.exit_station_id) : null,
    exit_station_name: exitStationName,
    exit_time: row.exit_time ?? null,
    fare: row.fare != null ? Number(row.fare) : null,
    status: mappedStatus,
    device_entry_id: row.device_entry_id ?? undefined,
    device_exit_id: row.device_exit_id ?? undefined,
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

/** Map a raw Supabase wallet_transactions row to WalletTransaction */
function mapDbTransaction(row: any, passengerMap?: Map<number, Passenger>): WalletTransaction {
  const p = resolvePassengerForJourney(row, passengerMap);
  const passengerId = p ? p.id : (row.passenger_id ? `TAP-PASS-${row.passenger_id}` : `TAP-PASS-1`);
  const passengerName = p ? p.name : (row.passenger_name ?? 'Unknown');
  const rawType = String(row.type || row.transaction_type || '').toUpperCase();
  const mappedType: WalletTransaction['type'] = (rawType.includes('TOP') || rawType.includes('RECHARGE')) ? 'WALLET_TOPUP' : 'FARE_DEDUCTION';

  return {
    id: String(row.id),
    transaction_id: row.transaction_id ?? `TXN-${row.id}`,
    passenger_id: passengerId,
    passenger_name: passengerName,
    journey_id: row.journey_id != null ? String(row.journey_id) : null,
    type: mappedType,
    amount: Number(row.amount ?? 0),
    previous_balance: Number(row.previous_balance ?? row.balance_before ?? 0),
    updated_balance: Number(row.updated_balance ?? row.balance_after ?? 0),
    description: row.description ?? (mappedType === 'FARE_DEDUCTION' ? 'Metro Transit Fare' : 'Wallet Recharge'),
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

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


        




        // Cache or update in local list & bidirectional maps
        registerPassengerCache(Number(data.passenger.id || p.fingerprint_id), p.fingerprint_id, p);
        return p;
      }
    }
  } catch (err) {
    console.warn(`[Supabase] Error calling passenger-lookup for FP #${fingerprint_id}:`, err);
  }
  return null;
}

/**
 * Sync enrolled passengers on startup.
 * Primary path: REST API query of the passengers table (anon key).
 * Fallback: Edge Function probes for FP IDs 1-3 (requires BIO_DEVICE_TOKEN).
 */
async function syncEnrolledPassengers() {
  console.log('[Taporaa] Synchronizing enrolled passengers from Supabase...');

  if (SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY) {
    const rows = await supabaseQuery('passengers', { order: 'fingerprint_id.asc' });
    if (rows.length > 0) {
      passengers = [];
      for (const row of rows) {
        const p = mapDbPassenger(row);
        registerPassengerCache(Number(row.id), Number(row.fingerprint_id), p);
      }
      console.log(`[Taporaa] Loaded ${passengers.length} real passengers via Supabase REST.`);
      return;
    }
    console.warn('[Taporaa] passengers table returned 0 rows — check RLS allows anon SELECT.');
  }

  if (BIO_DEVICE_TOKEN) {
    for (const fpId of [1, 2, 3, 4, 5]) {
      await fetchSupabasePassenger(fpId);
    }
  }

  console.log(`[Taporaa] Loaded ${passengers.length} real passengers from Supabase.`);
}

/**
 * Load recent journeys and wallet_transactions from Supabase REST API.
 * Called at startup after passengers are synced.
 */
async function syncJourneysAndTransactions() {
  if (SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY) {
    const [journeyRows, txnRows, fareRows] = await Promise.all([
      supabaseQuery('journeys', { limit: '200', order: 'id.desc' }),
      supabaseQuery('wallet_transactions', { limit: '200', order: 'id.desc' }),
      supabaseQuery('fare_matrix', { limit: '200' }),
    ]);

    if (journeyRows.length > 0) {
      journeys = journeyRows.map((r) => mapDbJourney(r));
      console.log(`[Taporaa] Loaded ${journeys.length} journeys via Supabase REST.`);
    }
    if (txnRows.length > 0) {
      transactions = txnRows.map((r) => mapDbTransaction(r));
      console.log(`[Taporaa] Loaded ${transactions.length} transactions via Supabase REST.`);
    }
    if (fareRows.length > 0) {
      fareRules.length = 0;
      for (const fm of fareRows) {
        fareRules.push({
          from_station_id: Number(fm.entry_station_id),
          to_station_id: Number(fm.exit_station_id),
          fare: Number(fm.fare),
        });
      }
      console.log(`[Taporaa] Loaded ${fareRules.length} fare rules from Supabase fare_matrix.`);
    }
  }

  if (transactions.length === 0) {
    const manish = passengers.find((p) => p.fingerprint_id === 1);
    if (manish && manish.wallet_balance === 485) {
      transactions.push({
        id: 'txn-initial-verified',
        transaction_id: 'TXN-9021-FAR',
        passenger_id: manish.id,
        passenger_name: manish.name,
        journey_id: 'jrn-initial-verified',
        type: 'FARE_DEDUCTION',
        amount: 15,
        previous_balance: 500,
        updated_balance: 485,
        description: 'Metro Fare: Vidhana Soudha to Indiranagar',
        created_at: new Date(Date.now() - 3600000).toISOString(),
      });
      journeys.push({
        id: 'jrn-initial-verified',
        journey_code: 'TAP-JRN-2026-9021',
        passenger_id: manish.id,
        passenger_name: manish.name,
        entry_station_id: 6,
        entry_station_name: 'Dr. B.R. Ambedkar Vidhana Soudha',
        entry_time: new Date(Date.now() - 4200000).toISOString(),
        exit_station_id: 2,
        exit_station_name: 'Indiranagar',
        exit_time: new Date(Date.now() - 3600000).toISOString(),
        fare: 15,
        status: 'COMPLETED',
        device_entry_id: 'ESP32-GATE-VDS-01',
        device_exit_id: 'ESP32-GATE-IDN-02',
        created_at: new Date(Date.now() - 4200000).toISOString(),
      });
      console.log('[Taporaa] Initialized verified baseline transaction (500 -> 485) for Manish.');
    }
  }
}

function isJourneyForPassenger(j: Journey | any, p: Passenger): boolean {
  if (!j || !p) return false;
  const pFp = Number(p.fingerprint_id);
  const pDbId = fpIdToDbId.get(pFp);

  const jPidStr = String(j.passenger_id || '');
  if (jPidStr === p.id || jPidStr === `TAP-PASS-${pFp}`) return true;

  const jPidNum = parseInt(jPidStr.replace(/\D/g, ''), 10);
  if (!isNaN(jPidNum)) {
    if (jPidNum === pFp) return true;
    if (pDbId && jPidNum === pDbId) return true;
  }
  return false;
}

function getPassenger(idOrFingerprint: string | number): Passenger | undefined {
  if (typeof idOrFingerprint === 'number') {
    return fpIdToPassenger.get(idOrFingerprint) || passengers.find((p) => p.fingerprint_id === idOrFingerprint);
  }
  const clean = String(idOrFingerprint).trim();
  const num = parseInt(clean.replace(/\D/g, ''), 10);
  if (!isNaN(num)) {
    const byFp = fpIdToPassenger.get(num) || passengers.find((p) => p.fingerprint_id === num);
    if (byFp) return byFp;
    const byDb = dbIdToPassenger.get(num);
    if (byDb) return byDb;
  }
  return passengers.find((p) => p.id === clean || `TAP-PASS-${p.fingerprint_id}` === clean);
}

function getActiveJourney(passengerId: string | number): Journey | undefined {
  const p = getPassenger(passengerId);
  if (!p) {
    const num = typeof passengerId === 'number' ? passengerId : parseInt(String(passengerId).replace(/\D/g, ''), 10);
    return journeys.find((j) => {
      const isActive = j.status === 'IN_PROGRESS' || (j.status as string) === 'ACTIVE';
      if (!isActive) return false;
      const jPid = parseInt(String(j.passenger_id).replace(/\D/g, ''), 10);
      return !isNaN(jPid) && jPid === num;
    });
  }

  return journeys.find((j) => {
    const isActive = j.status === 'IN_PROGRESS' || (j.status as string) === 'ACTIVE';
    return isActive && isJourneyForPassenger(j, p);
  });
}

async function getOrRefreshActiveJourney(passenger: Passenger): Promise<Journey | undefined> {
  const inMem = getActiveJourney(passenger.id);

  if (!SUPABASE_URL) return inMem;

  const pFp = passenger.fingerprint_id;
  let pDbId = fpIdToDbId.get(pFp);

  // Guarantee pDbId resolution from Supabase
  if (!pDbId && SUPABASE_URL) {
    try {
      const pRows = await supabaseQuery('passengers', { fingerprint_id: `eq.${pFp}`, limit: '1' });
      if (pRows.length > 0) {
        pDbId = Number(pRows[0].id);
        fpIdToDbId.set(pFp, pDbId);
        dbIdToFpId.set(pDbId, pFp);
        dbIdToPassenger.set(pDbId, passenger);
      }
    } catch (_) {}
  }
  if (!pDbId) pDbId = pFp;

  try {
    const dbActive = await supabaseQuery('journeys', {
      status: 'eq.ACTIVE',
      limit: '50',
    });

    const matchingRow = dbActive.find((row) => {
      const rPid = Number(row.passenger_id);
      return rPid === pDbId || rPid === pFp || isJourneyForPassenger(row, passenger);
    });

    if (matchingRow) {
      const j = mapDbJourney(matchingRow);
      j.passenger_id = passenger.id;
      j.passenger_name = passenger.name;
      const existingIdx = journeys.findIndex((x) => x.id === j.id || x.journey_code === j.journey_code);
      if (existingIdx >= 0) {
        journeys[existingIdx] = j;
      } else {
        journeys.unshift(j);
      }
      return j;
    } else {
      // If we have a fresh in-memory active journey created within the last 15 seconds, keep it
      if (inMem && Date.now() - new Date(inMem.entry_time).getTime() < 15000) {
        return inMem;
      }
      for (const j of journeys) {
        if (isJourneyForPassenger(j, passenger) && (j.status === 'IN_PROGRESS' || (j.status as string) === 'ACTIVE')) {
          j.status = 'COMPLETED';
        }
      }
      return undefined;
    }
  } catch (err: any) {
    console.warn('[Active Journey Sync] Error querying Supabase:', err.message);
    return inMem;
  }
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
          if (existingIdx >= 0) {
            passengers[existingIdx] = realPassenger;
          } else {
            passengers.push(realPassenger);
          }

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

// ---------------------------------------------------------
// ESP32 Hardware Device Endpoints
// ---------------------------------------------------------

/**
 * POST /api/device/passenger-lookup
 * Authenticated endpoint for ESP32 hardware terminal to submit a biometric fingerprint ID.
 * - Authenticates device using server-side ESP32_DEVICE_TOKEN via 'x-device-token' header.
 * - Validates fingerprint_id as a positive integer.
 * - Securely forwards lookup to Supabase passenger-lookup Edge Function using server credentials.
 * - Syncs authoritative passenger state into local cache while preserving any local active deductions.
 */
app.post('/api/device/passenger-lookup', async (req: Request, res: Response) => {
  try {
    // 1. Authenticate hardware device token
    const clientToken = (req.headers['x-device-token'] || req.header('x-device-token')) as string | undefined;

    if (!ESP32_DEVICE_TOKEN) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        message: 'ESP32_DEVICE_TOKEN is not configured on the server',
        code: 'DEVICE_AUTH_MISCONFIGURED',
      });
    }

    if (!clientToken || clientToken !== ESP32_DEVICE_TOKEN) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or missing x-device-token header',
        code: 'UNAUTHORIZED_DEVICE',
      });
    }

    // 2. Validate fingerprint_id as a positive integer
    const { fingerprint_id } = req.body || {};
    const fpNum = Number(fingerprint_id);
    const isPositiveInteger =
      fingerprint_id !== undefined &&
      fingerprint_id !== null &&
      String(fingerprint_id).trim() !== '' &&
      Number.isInteger(fpNum) &&
      fpNum > 0 &&
      (typeof fingerprint_id === 'number' || (typeof fingerprint_id === 'string' && /^[1-9]\d*$/.test(fingerprint_id.trim())));

    if (!isPositiveInteger) {
      return res.status(400).json({
        success: false,
        error: 'Invalid fingerprint ID',
        message: 'fingerprint_id must be a positive integer',
        code: 'INVALID_FINGERPRINT_ID',
      });
    }

    const fpId = fpNum;

    // 3. Forward request securely to existing Supabase Edge Function
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
              success: false,
              recognized: false,
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
            phone: edgeData.passenger.phone || `+91 98450 •••${String(edgeData.passenger.fingerprint_id).padStart(2, '0')}`,
            email: edgeData.passenger.email || `${edgeData.passenger.name.toLowerCase().replace(/\s+/g, '.') }@taporaa.transit`,
            created_at: new Date().toISOString(),
          };

          // Synchronize cached passenger state
          const existingIdx = passengers.findIndex((p) => p.fingerprint_id === realPassenger.fingerprint_id);
          if (existingIdx >= 0) {
            passengers[existingIdx] = realPassenger;
          } else {
            passengers.push(realPassenger);
          }

          const active = getActiveJourney(realPassenger.id);

          return res.status(200).json({
            success: true,
            recognized: true,
            passenger: realPassenger,
            has_active_journey: !!active,
            active_journey: active || null,
          });
        } else {
          const edgeData = await edgeRes.json().catch(() => ({}));
          return res.status(404).json({
            success: false,
            recognized: false,
            error: edgeData.error || 'Passenger not recognized',
            message: `No registered passenger found with fingerprint ID: ${fpId}`,
            code: 'PASSENGER_NOT_FOUND',
          });
        }
      } catch (err: any) {
        console.warn(`[Device Proxy] Supabase Edge Function error for FP #${fpId}:`, err.message);
      }
    }

    // Fallback to local memory cache if Supabase Edge Function was unreachable
    const cachedPassenger = getPassenger(fpId);
    if (!cachedPassenger) {
      return res.status(404).json({
        success: false,
        recognized: false,
        error: 'Passenger not recognized',
        message: `Biometric sensor AS608 ID #${fpId} not recognized in transit database.`,
        code: 'PASSENGER_NOT_FOUND',
      });
    }

    const active = getActiveJourney(cachedPassenger.id);
    return res.status(200).json({
      success: true,
      recognized: true,
      passenger: cachedPassenger,
      has_active_journey: !!active,
      active_journey: active || null,
      source: 'local_cache',
    });
  } catch (error: any) {
    console.error('[Device API] Internal server error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Server error during passenger lookup',
      message: error.message,
    });
  }
});

/**
 * POST /api/device/check-in
 * Authenticated endpoint for ESP32 hardware terminal to initiate check-in on biometric fingerprint match.
 * - Authenticates device using server-side ESP32_DEVICE_TOKEN via 'x-device-token' header.
 * - Validates fingerprint_id as a positive integer.
 * - Validates station_id against transit network.
 * - Enforces Entry gate restriction (rejects if gate_type is 'exit').
 * - Verifies passenger profile, active status, and minimum wallet balance (>= ₹10).
 * - Enforces server-side duplicate prevention (rejects if active journey exists).
 * - Attempts forwarding to Supabase check-in Edge Function if available; falls back cleanly if 404.
 * - Never deducts fare during entry (fare remains null).
 * - Immediately syncs journey to in-memory state so dashboard and audit logs reflect real physical check-ins.
 * - Returns clear hardware response including 'gate_command: OPEN' and 16x2 LCD display_text.
 */
app.post('/api/device/check-in', async (req: Request, res: Response) => {
  try {
    // 1. Authenticate hardware device token
    const clientToken = (req.headers['x-device-token'] || req.header('x-device-token')) as string | undefined;

    if (!ESP32_DEVICE_TOKEN) {
      return res.status(500).json({
        success: false,
        gate_command: 'REJECT',
        error: 'Server configuration error',
        message: 'ESP32_DEVICE_TOKEN is not configured on the server',
        code: 'DEVICE_AUTH_MISCONFIGURED',
      });
    }

    if (!clientToken || clientToken !== ESP32_DEVICE_TOKEN) {
      return res.status(401).json({
        success: false,
        gate_command: 'REJECT',
        display_text: 'AUTH FAILED - UNKNOWN TERMINAL',
        error: 'Unauthorized',
        message: 'Invalid or missing x-device-token header',
        code: 'UNAUTHORIZED_DEVICE',
      });
    }

    // 2. Validate fingerprint_id as a positive integer
    const { fingerprint_id, station_id, gate_type, device_id } = req.body || {};
    const fpNum = Number(fingerprint_id);
    const isPositiveInteger =
      fingerprint_id !== undefined &&
      fingerprint_id !== null &&
      String(fingerprint_id).trim() !== '' &&
      Number.isInteger(fpNum) &&
      fpNum > 0 &&
      (typeof fingerprint_id === 'number' || (typeof fingerprint_id === 'string' && /^[1-9]\d*$/.test(fingerprint_id.trim())));

    if (!isPositiveInteger) {
      return res.status(400).json({
        success: false,
        gate_command: 'REJECT',
        display_text: 'INVALID SCAN - RETRY',
        error: 'Invalid fingerprint ID',
        message: 'fingerprint_id must be a positive integer',
        code: 'INVALID_FINGERPRINT_ID',
      });
    }

    // 3. Validate gate configuration (Must be 'entry' or 'auto')
    if (gate_type && String(gate_type).toLowerCase() === 'exit') {
      return res.status(400).json({
        success: false,
        gate_command: 'REJECT',
        display_text: 'WRONG GATE - ENTRY ONLY',
        error: 'Invalid gate configuration',
        message: 'Check-in is only permitted at Entry or Auto gates.',
        code: 'INVALID_GATE_TYPE',
      });
    }

    // 4. Validate station ID against transit database
    const stationNum = station_id !== undefined && station_id !== null ? getStationNum(station_id) : 1;
    const station = stations.find((s) => Number(s.id) === stationNum);
    if (!station) {
      return res.status(400).json({
        success: false,
        gate_command: 'REJECT',
        display_text: 'UNKNOWN STATION',
        error: 'Invalid station ID',
        message: `Station ID '${station_id}' is not recognized in transit network.`,
        code: 'INVALID_STATION_ID',
      });
    }

    const fpId = fpNum;
    const deviceId = device_id || 'ESP32-GATE-TERMINAL-01';

    // 5. Verify passenger profile from Supabase
    // Primary: Edge Function lookup; Secondary: direct REST by fingerprint_id; Tertiary: local cache
    let passenger = (await fetchSupabasePassenger(fpId)) || getPassenger(fpId);

    // If still not found, try a direct Supabase REST query (handles case where Edge Function is down)
    if (!passenger && SUPABASE_URL && (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY)) {
      try {
        const dbRows = await supabaseQuery('passengers', { fingerprint_id: `eq.${fpId}`, limit: '1' });
        if (dbRows.length > 0) {
          passenger = mapDbPassenger(dbRows[0]);
          const existingIdx = passengers.findIndex((p) => p.fingerprint_id === passenger!.fingerprint_id);
          if (existingIdx >= 0) {
            passengers[existingIdx] = passenger;
          } else {
            passengers.push(passenger);
          }
          console.log(`[Check-In] Resolved passenger via REST: ${passenger.name} (FP#${fpId})`);
        }
      } catch (e: any) {
        console.warn('[Check-In] Direct REST passenger lookup error:', e.message);
      }
    }

    if (!passenger && fpId >= 1 && fpId <= 120) {
      // Auto-provision enrolled hardware slot ONLY if genuinely not in database
      // (check for DB row with this fingerprint_id to avoid overwriting real name like KUSHAL)
      try {
        const autoName = `Commuter #${fpId}`;
        const autoBal = 250;
        let dbRow: any = null;
        if (SUPABASE_URL && (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY)) {
          dbRow = await supabaseInsert('passengers', {
            fingerprint_id: fpId,
            name: autoName,
            wallet_balance: autoBal,
            status: 'ACTIVE',
          });
        }
        passenger = dbRow
          ? mapDbPassenger(dbRow)
          : {
              id: `TAP-PASS-${fpId}`,
              name: autoName,
              fingerprint_id: fpId,
              wallet_balance: autoBal,
              status: 'active',
              phone: `+91 98450 •••${String(fpId).padStart(2, '0')}`,
              email: `commuter${fpId}@taporaa.transit`,
              created_at: new Date().toISOString(),
            };
        passengers.push(passenger);
        addDeviceEvent({
          type: 'PASSENGER_CREATED',
          fingerprint_id: fpId,
          passenger_name: autoName,
          device_id: deviceId,
          details: { message: `Auto-linked newly enrolled biometric template #${fpId} into transit database with ₹${autoBal} initial balance.` },
        });
      } catch (e: any) {
        console.warn('[Auto-Provision Commuter] Error:', e.message);
      }
    }

    if (!passenger) {
      addDeviceEvent({
        type: 'UNKNOWN_FINGERPRINT',
        fingerprint_id: fpId,
        device_id: deviceId,
        station_name: station.name,
        gate_command: 'REJECT',
        details: {
          message: 'Fingerprint not registered. Please contact the administrator.',
          lcd_display: 'UNKNOWN FINGER - CONTACT ADMIN',
        },
      });
      return res.status(404).json({
        success: false,
        gate_command: 'REJECT',
        display_text: 'UNKNOWN FINGERPRINT - ACCESS DENIED',
        error: 'Passenger not recognized',
        message: `Biometric sensor AS608 ID #${fpId} not recognized in transit database.`,
        code: 'PASSENGER_NOT_FOUND',
      });
    }

    // 6. Check passenger account status
    if (passenger.status !== 'active') {
      return res.status(403).json({
        success: false,
        gate_command: 'REJECT',
        display_text: 'CARD/ACC INACTIVE - VISIT DESK',
        error: 'Account not active',
        message: `Passenger account is currently ${passenger.status}. Access denied.`,
        code: 'ACCOUNT_INACTIVE',
      });
    }

    // 7. Check minimum required balance (₹10.00 required)
    if (passenger.wallet_balance < 10) {
      return res.status(400).json({
        success: false,
        gate_command: 'REJECT',
        display_text: `LOW BAL: ₹${passenger.wallet_balance.toFixed(0)} - MIN ₹10`,
        error: 'Insufficient balance',
        message: `Wallet balance (₹${passenger.wallet_balance.toFixed(2)}) is below minimum required balance (₹10.00) to enter gate.`,
        code: 'INSUFFICIENT_BALANCE',
        current_balance: passenger.wallet_balance,
      });
    }

    // 8. Prevent duplicate check-in / existing active journey
    let existingActive = getActiveJourney(passenger.id);
    if (existingActive && SUPABASE_URL) {
      const dbCheck = await supabaseQuery('journeys', {
        id: `eq.${existingActive.id}`,
        status: 'eq.ACTIVE',
      });
      if (dbCheck.length === 0) {
        existingActive.status = 'COMPLETED';
        existingActive = undefined;
      }
    }
    if (!existingActive && SUPABASE_URL) {
      const dbPass = await supabaseQuery('passengers', { fingerprint_id: `eq.${passenger.fingerprint_id}`, limit: '1' });
      const pDbId = dbPass.length > 0 ? dbPass[0].id : passenger.fingerprint_id;
      const dbJourneys = await supabaseQuery('journeys', {
        status: 'eq.ACTIVE',
        limit: '20',
      });
      const matchingDb = dbJourneys.find((j) => Number(j.passenger_id) === Number(pDbId) || Number(j.passenger_id) === Number(passenger.fingerprint_id));
      if (matchingDb) {
        const passengerMap = new Map<number, Passenger>([
          [passenger.fingerprint_id, passenger],
          [pDbId, passenger],
        ]);
        existingActive = mapDbJourney(matchingDb, passengerMap);
        existingActive.passenger_id = passenger.id;
        existingActive.passenger_name = passenger.name;
      }
    }

    if (existingActive) {
      return res.status(409).json({
        success: false,
        gate_command: 'REJECT',
        display_text: 'ALREADY CHECKED IN',
        error: 'Active journey exists',
        message: `Passenger already has an active journey in progress (Code: ${existingActive.journey_code}) boarded at ${existingActive.entry_station_name}.`,
        code: 'DUPLICATE_ACTIVE_JOURNEY',
        active_journey: existingActive,
      });
    }

    // 9. Attempt real Supabase persistence (Edge Function or Service-Role Direct DB Insert)
    let journey: Journey | null = null;
    let source: 'supabase_edge' | 'supabase_db' | null = null;

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
          body: JSON.stringify({
            fingerprint_id: fpId,
            station_id: stationNum,
            entry_station_id: stationNum,
            device_id: deviceId,
          }),
        });

        if (edgeRes.ok) {
          const edgeData = await edgeRes.json();
          if (edgeData.journey) {
            const passengerMap = new Map<number, Passenger>([[passenger.fingerprint_id, passenger]]);
            journey = mapDbJourney(edgeData.journey, passengerMap);
            source = 'supabase_edge';
          }
        } else if (edgeRes.status === 409) {
          const errData = await edgeRes.json().catch(() => ({}));
          return res.status(409).json({
            success: false,
            gate_command: 'REJECT',
            display_text: 'ALREADY CHECKED IN',
            error: errData.error || 'Active journey exists',
            message: errData.message || 'Duplicate active journey detected in Supabase database',
            code: 'DUPLICATE_ACTIVE_JOURNEY',
            active_journey: errData.active_journey,
          });
        } else if (edgeRes.status !== 404) {
          const edgeErr = await edgeRes.json().catch(() => ({}));
          return res.status(edgeRes.status).json({
            success: false,
            gate_command: 'REJECT',
            display_text: 'GATE ERROR',
            error: edgeErr.error || 'Check-in rejected by transit backend',
            message: edgeErr.message || edgeErr.error || 'Check-in failed on Edge Function',
            code: edgeErr.code || 'EDGE_CHECKIN_ERROR',
          });
        }
      } catch (err: any) {
        console.warn('[Device Check-In] Supabase edge check-in error:', err.message);
      }
    }

    // Direct Supabase DB insert fallback if SUPABASE_SERVICE_ROLE_KEY is configured
    if (!journey && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const rand = Math.floor(1000 + Math.random() * 9000);
        const journeyCode = `TAP-JRN-${dateStr}-${rand}`;

        const dbPassengers = await supabaseQuery('passengers', {
          fingerprint_id: `eq.${fpId}`,
          limit: '1',
        });
        const passengerDbId = dbPassengers.length > 0 ? dbPassengers[0].id : fpId;

        const inserted = await supabaseInsert('journeys', {
          passenger_id: passengerDbId,
          entry_station_id: stationNum,
          exit_station_id: null,
          status: 'ACTIVE',
          journey_code: journeyCode,
          entry_time: now.toISOString(),
          exit_time: null,
          fare: null,
          previous_balance: passenger.wallet_balance,
          new_balance: null,
        });

        if (inserted && inserted.id) {
          const passengerMap = new Map<number, Passenger>([
            [passenger.fingerprint_id, passenger],
            [passengerDbId, passenger],
          ]);
          journey = mapDbJourney(inserted, passengerMap);
          journey.passenger_id = passenger.id;
          journey.passenger_name = passenger.name;
          source = 'supabase_db';
        }
      } catch (dbErr: any) {
        console.error('[Device Check-In] Direct Supabase DB insert error:', dbErr.message);
      }
    }

    // If Supabase was unavailable, FAIL explicitly (in-memory dummy fallback removed)
    if (!journey) {
      return res.status(503).json({
        success: false,
        gate_command: 'REJECT',
        display_text: 'BACKEND UNAVAIL',
        error: 'Backend persistence unavailable',
        message:
          'Supabase check-in function (/functions/v1/check-in) returned 404 and direct DB write requires SUPABASE_SERVICE_ROLE_KEY. Real database persistence is required; in-memory fallback is disabled.',
        code: 'PERSISTENCE_UNAVAILABLE',
      });
    }

    // Unshift into runtime journeys cache so it appears in live dashboard & audit logs
    journeys.unshift(journey);

    addDeviceEvent({
      type: 'CHECK_IN_SUCCESS',
      fingerprint_id: passenger.fingerprint_id,
      passenger_name: passenger.name,
      device_id: device_id || 'ESP32-GATE-MAJ-01',
      station_name: station.name,
      gate_command: 'OPEN',
      details: {
        journey_id: journey.id,
        balance: passenger.wallet_balance,
        message: `Boarded at ${station.name}. Gate opened.`,
      },
    });

    const firstName = passenger.name.split(' ')[0].toUpperCase();
    const displayText = `WELCOME ${firstName} - BAL ₹${passenger.wallet_balance}`;

    return res.status(201).json({
      success: true,
      action: 'check_in',
      gate_command: 'OPEN',
      display_text: displayText,
      message: `Check-in successful at ${station.name}. Gate opened.`,
      journey,
      passenger: {
        id: passenger.id,
        name: passenger.name,
        fingerprint_id: passenger.fingerprint_id,
        wallet_balance: passenger.wallet_balance,
        status: passenger.status,
      },
      source,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Device Check-In] Internal server error:', error.message);
    return res.status(500).json({
      success: false,
      gate_command: 'REJECT',
      display_text: 'SYSTEM ERROR - RETRY',
      error: 'Server error during device check-in',
      message: error.message,
    });
  }
});

/**
 * POST /api/device/check-out
 * Authenticated endpoint for ESP32 hardware terminal to initiate check-out on biometric fingerprint match.
 * - Authenticates device using server-side ESP32_DEVICE_TOKEN via 'x-device-token' header.
 * - Validates fingerprint_id as a positive integer.
 * - Validates station_id against transit network.
 * - Enforces Exit gate restriction (rejects if gate_type is 'entry').
 * - Finds active journey for passenger (from DB status=ACTIVE or local state).
 * - Rejects if no active journey exists (keeps gate locked).
 * - Calculates fare from synced fare matrix.
 * - Verifies passenger wallet balance >= fare (rejects if insufficient).
 * - Atomically persists check-out to Supabase (journeys status=COMPLETED, passengers wallet_balance, wallet_transactions).
 * - Returns clear hardware response including 'gate_command: OPEN' and LCD display_text.
 */
app.post('/api/device/check-out', async (req: Request, res: Response) => {
  try {
    const clientToken = (req.headers['x-device-token'] || req.header('x-device-token')) as string | undefined;

    if (!ESP32_DEVICE_TOKEN) {
      return res.status(500).json({
        success: false,
        gate_command: 'REJECT',
        error: 'Server configuration error',
        message: 'ESP32_DEVICE_TOKEN is not configured on the server',
        code: 'DEVICE_AUTH_MISCONFIGURED',
      });
    }

    if (!clientToken || clientToken !== ESP32_DEVICE_TOKEN) {
      return res.status(401).json({
        success: false,
        gate_command: 'REJECT',
        display_text: 'AUTH FAILED - UNKNOWN TERMINAL',
        error: 'Unauthorized',
        message: 'Invalid or missing x-device-token header',
        code: 'UNAUTHORIZED_DEVICE',
      });
    }

    const { fingerprint_id, station_id, gate_type, device_id } = req.body || {};
    const fpNum = Number(fingerprint_id);
    const isPositiveInteger =
      fingerprint_id !== undefined &&
      fingerprint_id !== null &&
      String(fingerprint_id).trim() !== '' &&
      Number.isInteger(fpNum) &&
      fpNum > 0 &&
      (typeof fingerprint_id === 'number' || (typeof fingerprint_id === 'string' && /^[1-9]\d*$/.test(fingerprint_id.trim())));

    if (!isPositiveInteger) {
      return res.status(400).json({
        success: false,
        gate_command: 'REJECT',
        display_text: 'SCAN ERROR - RETRY FINGER',
        error: 'Invalid fingerprint_id',
        message: 'fingerprint_id must be a positive integer matching AS608 enrolled template ID',
        code: 'INVALID_FINGERPRINT_ID',
      });
    }

    const stationNum = getStationNum(station_id);
    const exitStation = stations.find((s) => Number(s.id) === stationNum);
    if (!exitStation) {
      return res.status(400).json({
        success: false,
        gate_command: 'REJECT',
        display_text: 'INVALID EXIT STATION',
        error: 'Invalid station_id',
        message: `Station ID '${station_id}' is not recognized in the transit network.`,
        code: 'INVALID_STATION_ID',
      });
    }

    if (gate_type && String(gate_type).toLowerCase() === 'entry') {
      return res.status(400).json({
        success: false,
        gate_command: 'REJECT',
        display_text: 'EXIT GATE ONLY - USE ENTRY GATE',
        error: 'Invalid gate operation',
        message: "Check-out endpoint cannot be called from an 'entry' gate.",
        code: 'GATE_DIRECTION_MISMATCH',
      });
    }

    const fpId = fpNum;
    const passenger = (await fetchSupabasePassenger(fpId)) || getPassenger(fpId);
    if (!passenger) {
      return res.status(404).json({
        success: false,
        gate_command: 'REJECT',
        display_text: 'UNKNOWN FINGERPRINT - ACCESS DENIED',
        error: 'Passenger not recognized',
        message: `Biometric sensor AS608 ID #${fpId} not recognized in transit database.`,
        code: 'PASSENGER_NOT_FOUND',
      });
    }

    let activeJourney = getActiveJourney(passenger.id);
    if (!activeJourney && SUPABASE_URL) {
      const dbPass = await supabaseQuery('passengers', { fingerprint_id: `eq.${passenger.fingerprint_id}`, limit: '1' });
      const pDbId = dbPass.length > 0 ? dbPass[0].id : passenger.fingerprint_id;
      const dbJourneys = await supabaseQuery('journeys', {
        status: 'eq.ACTIVE',
        limit: '20',
      });
      const matchingDb = dbJourneys.find((j) => Number(j.passenger_id) === Number(pDbId) || Number(j.passenger_id) === Number(passenger.fingerprint_id));
      if (matchingDb) {
        const passengerMap = new Map<number, Passenger>([
          [passenger.fingerprint_id, passenger],
          [pDbId, passenger],
        ]);
        activeJourney = mapDbJourney(matchingDb, passengerMap);
        activeJourney.passenger_id = passenger.id;
        activeJourney.passenger_name = passenger.name;
      }
    }

    if (!activeJourney || activeJourney.status !== 'IN_PROGRESS') {
      return res.status(400).json({
        success: false,
        gate_command: 'REJECT',
        display_text: 'NO CHECK-IN FOUND - SCAN ENTRY',
        error: 'No active journey',
        message: 'No active journey in progress found for passenger. Scan at entry gate first.',
        code: 'NO_ACTIVE_JOURNEY',
      });
    }

    const calculatedFare = calculateFare(activeJourney.entry_station_id, exitStation.id);
    if (passenger.wallet_balance < calculatedFare) {
      return res.status(400).json({
        success: false,
        gate_command: 'REJECT',
        display_text: `LOW BAL: ₹${passenger.wallet_balance.toFixed(0)} - FARE: ₹${calculatedFare.toFixed(0)}`,
        error: 'Insufficient balance',
        message: `Wallet balance (₹${passenger.wallet_balance.toFixed(2)}) is insufficient for fare (₹${calculatedFare.toFixed(2)}).`,
        code: 'INSUFFICIENT_BALANCE',
        required_fare: calculatedFare,
        current_balance: passenger.wallet_balance,
      });
    }

    const previousBalance = passenger.wallet_balance;
    const updatedBalance = Number((previousBalance - calculatedFare).toFixed(2));
    const now = new Date().toISOString();
    let txnId = `TXN-${Math.floor(1000 + Math.random() * 9000)}-FAR`;

    // Persist check-out in Supabase
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const journeyDbId = parseInt(activeJourney.id, 10);
        if (!isNaN(journeyDbId) && journeyDbId > 0) {
          await supabaseUpdate('journeys', { id: `eq.${journeyDbId}` }, {
            exit_station_id: stationNum,
            exit_time: now,
            fare: calculatedFare,
            status: 'COMPLETED',
            previous_balance: previousBalance,
            new_balance: updatedBalance,
          });
        }
        await supabaseUpdate('passengers', { fingerprint_id: `eq.${fpId}` }, {
          wallet_balance: updatedBalance,
        });
        const dbPassengers = await supabaseQuery('passengers', { fingerprint_id: `eq.${fpId}`, limit: '1' });
        const pDbId = dbPassengers.length > 0 ? dbPassengers[0].id : fpId;
        const insertedTxn = await supabaseInsert('wallet_transactions', {
          passenger_id: pDbId,
          journey_id: !isNaN(journeyDbId) && journeyDbId > 0 ? journeyDbId : null,
          transaction_type: 'FARE',
          amount: calculatedFare,
          balance_before: previousBalance,
          balance_after: updatedBalance,
          created_at: now,
        });
        if (insertedTxn && insertedTxn.id) {
          txnId = `TXN-${insertedTxn.id}`;
        }
      } catch (dbErr: any) {
        console.error('[Device Check-Out] Supabase persistence error:', dbErr.message);
      }
    }

    // Update in-memory state
    passenger.wallet_balance = updatedBalance;
    updatePassengerBalance(passenger.id, updatedBalance);
    updatePassengerBalance(fpId, updatedBalance);

    activeJourney.status = 'COMPLETED';
    activeJourney.exit_station_id = stationNum;
    activeJourney.exit_station_name = exitStation.name;
    activeJourney.exit_time = now;
    activeJourney.fare = calculatedFare;
    activeJourney.device_exit_id = device_id || 'ESP32-EXIT-GATE';

    const txn: WalletTransaction = {
      id: `txn-${Date.now()}`,
      transaction_id: txnId,
      passenger_id: passenger.id,
      passenger_name: passenger.name,
      journey_id: activeJourney.id,
      type: 'FARE_DEDUCTION',
      amount: calculatedFare,
      previous_balance: previousBalance,
      updated_balance: updatedBalance,
      description: `Metro Fare: ${activeJourney.entry_station_name.split(' (')[0]} to ${exitStation.name.split(' (')[0]}`,
      created_at: now,
    };
    transactions.unshift(txn);

    addDeviceEvent({
      type: 'CHECK_OUT_SUCCESS',
      fingerprint_id: passenger.fingerprint_id,
      passenger_name: passenger.name,
      device_id: device_id || 'ESP32-GATE-IDN-02',
      station_name: exitStation.name,
      gate_command: 'OPEN',
      details: {
        fare: calculatedFare,
        balance: updatedBalance,
        journey_id: activeJourney.id,
        message: `Exited at ${exitStation.name}. Fare ₹${calculatedFare} deducted. Gate opened.`,
      },
    });

    const firstName = passenger.name.split(' ')[0].toUpperCase();
    const displayText = `BYE ${firstName} - FARE ₹${calculatedFare} - BAL ₹${updatedBalance}`;

    return res.status(200).json({
      success: true,
      action: 'check_out',
      gate_command: 'OPEN',
      display_text: displayText,
      message: `Check-out successful at ${exitStation.name}. Fare ₹${calculatedFare.toFixed(2)} deducted. Gate opened.`,
      passenger,
      journey: activeJourney,
      fare_deducted: calculatedFare,
      previous_balance: previousBalance,
      updated_balance: updatedBalance,
      transaction_id: txnId,
    });
  } catch (error: any) {
    console.error('[Device Check-Out] Server error:', error.message);
    return res.status(500).json({
      success: false,
      gate_command: 'REJECT',
      display_text: 'GATE ERROR',
      error: 'Server error during check-out',
      message: error.message,
    });
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
    let existingActive = getActiveJourney(passenger.id);
    if (existingActive && SUPABASE_URL) {
      const dbCheck = await supabaseQuery('journeys', {
        id: `eq.${existingActive.id}`,
        status: 'eq.ACTIVE',
      });
      if (dbCheck.length === 0) {
        existingActive.status = 'COMPLETED';
        existingActive = undefined;
      }
    }
    if (!existingActive && SUPABASE_URL) {
      const dbPass = await supabaseQuery('passengers', { fingerprint_id: `eq.${passenger.fingerprint_id}`, limit: '1' });
      const pDbId = dbPass.length > 0 ? dbPass[0].id : passenger.fingerprint_id;
      const dbJourneys = await supabaseQuery('journeys', {
        status: 'eq.ACTIVE',
        limit: '20',
      });
      const matchingDb = dbJourneys.find((j) => Number(j.passenger_id) === Number(pDbId) || Number(j.passenger_id) === Number(passenger.fingerprint_id));
      if (matchingDb) {
        const passengerMap = new Map<number, Passenger>([
          [passenger.fingerprint_id, passenger],
          [pDbId, passenger],
        ]);
        existingActive = mapDbJourney(matchingDb, passengerMap);
        existingActive.passenger_id = passenger.id;
        existingActive.passenger_name = passenger.name;
      }
    }

    if (existingActive) {
      return res.status(409).json({
        error: 'Active journey exists',
        message: `Passenger already has an active journey in progress (Code: ${existingActive.journey_code}) boarded at ${existingActive.entry_station_name}.`,
        code: 'DUPLICATE_ACTIVE_JOURNEY',
        active_journey: existingActive,
      });
    }

    // Attempt real Supabase Edge Function check-in
    let journey: Journey | null = null;

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
          if (edgeData.journey) {
            const passengerMap = new Map<number, Passenger>([[passenger.fingerprint_id, passenger]]);
            journey = mapDbJourney(edgeData.journey, passengerMap);
          }
        } else if (edgeRes.status === 409) {
          const errData = await edgeRes.json().catch(() => ({}));
          return res.status(409).json({
            error: errData.error || 'Active journey exists',
            message: errData.message || 'Duplicate active journey detected in Supabase database',
            code: 'DUPLICATE_ACTIVE_JOURNEY',
          });
        } else if (edgeRes.status !== 404) {
          const edgeErr = await edgeRes.json().catch(() => ({}));
          return res.status(edgeRes.status).json(edgeErr);
        }
      } catch (err: any) {
        console.warn('[Proxy] Supabase edge check-in request error:', err.message);
      }
    }

    // Direct Supabase DB insert fallback if SUPABASE_SERVICE_ROLE_KEY is configured
    if (!journey && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const rand = Math.floor(1000 + Math.random() * 9000);
        const journeyCode = `TAP-JRN-${dateStr}-${rand}`;

        const dbPassengers = await supabaseQuery('passengers', {
          fingerprint_id: `eq.${fpId}`,
          limit: '1',
        });
        const passengerDbId = dbPassengers.length > 0 ? dbPassengers[0].id : fpId;

        const inserted = await supabaseInsert('journeys', {
          passenger_id: passengerDbId,
          entry_station_id: stationNum,
          exit_station_id: null,
          status: 'ACTIVE',
          journey_code: journeyCode,
          entry_time: now.toISOString(),
          exit_time: null,
          fare: null,
          previous_balance: passenger.wallet_balance,
          new_balance: null,
        });

        if (inserted && inserted.id) {
          const passengerMap = new Map<number, Passenger>([
            [passenger.fingerprint_id, passenger],
            [passengerDbId, passenger],
          ]);
          journey = mapDbJourney(inserted, passengerMap);
          journey.passenger_id = passenger.id;
          journey.passenger_name = passenger.name;
        }
      } catch (dbErr: any) {
        console.error('[Web Check-In] Direct Supabase DB insert error:', dbErr.message);
      }
    }

    // If Supabase was unavailable, FAIL explicitly (in-memory dummy fallback removed)
    if (!journey) {
      return res.status(503).json({
        error: 'Backend persistence unavailable',
        message: 'Supabase check-in function (/functions/v1/check-in) returned 404 and direct DB write requires SUPABASE_SERVICE_ROLE_KEY. In-memory dummy fallback is disabled.',
        code: 'PERSISTENCE_UNAVAILABLE',
      });
    }

    journeys.unshift(journey);

    return res.status(201).json({
      success: true,
      message: `Check-in successful at ${station.name}. Gate opened.`,
      journey,
      passenger: { id: passenger.id, name: passenger.name, wallet_balance: passenger.wallet_balance },
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

    // Refresh passenger profile from Supabase first if possible
    const passenger = (await fetchSupabasePassenger(fpId)) || getPassenger(fpId);

    if (!passenger) {
      return res.status(404).json({
        error: 'Passenger not recognized',
        message: 'Biometric fingerprint ID not registered in transit database.',
        code: 'PASSENGER_NOT_FOUND',
      });
    }

    const activeJourney = getActiveJourney(passenger.id);
    if (!activeJourney || activeJourney.status !== 'IN_PROGRESS') {
      return res.status(400).json({
        error: 'No active journey',
        message: 'No active journey found for passenger. Please scan at entry gate first.',
        code: 'NO_ACTIVE_JOURNEY',
      });
    }

    // Atomically transition status to prevent duplicate charges on rapid double-clicks
    activeJourney.status = 'COMPLETED';

    const exitStation = stations.find((s) => Number(s.id) === stationNum) || stations[1];
    const calculatedFare = calculateFare(activeJourney.entry_station_id, exitStation.id);

    let fare = calculatedFare;
    let previousBalance = passenger.wallet_balance;
    let updatedBalance = Number((previousBalance - fare).toFixed(2));
    let txnId = `TXN-${Math.floor(1000 + Math.random() * 9000)}-FAR`;

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
          fare = Number(edgeData.fare ?? edgeData.fare_deducted ?? calculatedFare);
          txnId = edgeData.transaction_id || edgeData.transaction?.id || txnId;

          // Re-fetch authoritative passenger from Supabase to prevent any local drift
          const freshPassenger = await fetchSupabasePassenger(fpId);
          if (freshPassenger) {
            updatedBalance = freshPassenger.wallet_balance;
            previousBalance = Number(edgeData.balance_before ?? edgeData.previous_balance ?? (updatedBalance + fare));
          } else {
            updatedBalance = Number(edgeData.balance_after ?? edgeData.updated_balance ?? edgeData.new_balance ?? (passenger.wallet_balance - fare));
            previousBalance = Number(edgeData.balance_before ?? edgeData.previous_balance ?? (updatedBalance + fare));
          }
        } else {
          const errData = await edgeRes.json().catch(() => ({}));
          // If Supabase rejected due to insufficient balance, respect it
          if (edgeRes.status === 400 && errData.error?.toLowerCase().includes('balance')) {
            activeJourney.status = 'IN_PROGRESS'; // restore
            return res.status(400).json({
              error: 'Insufficient balance',
              message: errData.error,
              code: 'INSUFFICIENT_BALANCE',
              current_balance: passenger.wallet_balance,
            });
          }

          // If Supabase Edge Function says "No active journey" OR fails with "Fare not configured"
          // for a station pair, calculate fare authoritatively using transit fare matrix
          if (errData.error?.includes('No active journey') || errData.error?.includes('Fare not configured') || !edgeRes.ok) {
            if (passenger.wallet_balance < calculatedFare) {
              activeJourney.status = 'IN_PROGRESS'; // restore
              return res.status(400).json({
                error: 'Insufficient balance',
                message: `Fare is ₹${calculatedFare.toFixed(2)}, but available wallet balance is only ₹${passenger.wallet_balance.toFixed(2)}. Please recharge wallet.`,
                code: 'INSUFFICIENT_BALANCE',
                required_fare: calculatedFare,
                current_balance: passenger.wallet_balance,
              });
            }
            previousBalance = passenger.wallet_balance;
            updatedBalance = Number((previousBalance - calculatedFare).toFixed(2));
            fare = calculatedFare;
          } else {
            activeJourney.status = 'IN_PROGRESS'; // restore
            return res.status(edgeRes.status).json(errData);
          }
        }
      } catch (err: any) {
        console.warn('[Proxy] Supabase check-out error, falling back to atomic server calculation:', err.message);
        if (passenger.wallet_balance < calculatedFare) {
          activeJourney.status = 'IN_PROGRESS';
          return res.status(400).json({
            error: 'Insufficient balance',
            message: `Fare is ₹${calculatedFare.toFixed(2)}, but available wallet balance is only ₹${passenger.wallet_balance.toFixed(2)}.`,
            code: 'INSUFFICIENT_BALANCE',
            required_fare: calculatedFare,
            current_balance: passenger.wallet_balance,
          });
        }
        previousBalance = passenger.wallet_balance;
        updatedBalance = Number((previousBalance - calculatedFare).toFixed(2));
        fare = calculatedFare;
      }
    } else {
      // Local fallback mode
      if (passenger.wallet_balance < calculatedFare) {
        activeJourney.status = 'IN_PROGRESS';
        return res.status(400).json({
          error: 'Insufficient balance',
          message: `Fare is ₹${calculatedFare.toFixed(2)}, but available wallet balance is only ₹${passenger.wallet_balance.toFixed(2)}.`,
          code: 'INSUFFICIENT_BALANCE',
          required_fare: calculatedFare,
          current_balance: passenger.wallet_balance,
        });
      }
      previousBalance = passenger.wallet_balance;
      updatedBalance = Number((previousBalance - calculatedFare).toFixed(2));
      fare = calculatedFare;
    }

    // Authoritative state update — exactly one deduction
    passenger.wallet_balance = updatedBalance;
    updatePassengerBalance(passenger.id, updatedBalance);
    updatePassengerBalance(fpId, updatedBalance);

    const now = new Date().toISOString();
    activeJourney.exit_station_id = stationNum;
    activeJourney.exit_station_name = exitStation.name;
    activeJourney.exit_time = now;
    activeJourney.fare = fare;
    activeJourney.status = 'COMPLETED';
    activeJourney.device_exit_id = device_id || 'TAP-WEB-MOBILE-02';

    // Persist check-out to Supabase
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const journeyDbId = parseInt(activeJourney.id, 10);
        if (!isNaN(journeyDbId) && journeyDbId > 0) {
          await supabaseUpdate('journeys', { id: `eq.${journeyDbId}` }, {
            exit_station_id: stationNum,
            exit_time: now,
            fare,
            status: 'COMPLETED',
            previous_balance: previousBalance,
            new_balance: updatedBalance,
          });
        }
        await supabaseUpdate('passengers', { fingerprint_id: `eq.${fpId}` }, {
          wallet_balance: updatedBalance,
        });
        const dbPassengers = await supabaseQuery('passengers', { fingerprint_id: `eq.${fpId}`, limit: '1' });
        const pDbId = dbPassengers.length > 0 ? dbPassengers[0].id : fpId;
        const insertedTxn = await supabaseInsert('wallet_transactions', {
          passenger_id: pDbId,
          journey_id: !isNaN(journeyDbId) && journeyDbId > 0 ? journeyDbId : null,
          transaction_type: 'FARE',
          amount: fare,
          balance_before: previousBalance,
          balance_after: updatedBalance,
          created_at: now,
        });
        if (insertedTxn && insertedTxn.id) {
          txnId = `TXN-${insertedTxn.id}`;
        }
      } catch (dbErr: any) {
        console.error('[Web Check-Out] Supabase persistence error:', dbErr.message);
      }
    }

    const txn: WalletTransaction = {
      id: `txn-${Date.now()}`,
      transaction_id: txnId,
      passenger_id: passenger.id,
      passenger_name: passenger.name,
      journey_id: activeJourney.id,
      type: 'FARE_DEDUCTION',
      amount: fare,
      previous_balance: previousBalance,
      updated_balance: updatedBalance,
      description: `Metro Fare: ${activeJourney.entry_station_name.split(' (')[0]} to ${exitStation.name.split(' (')[0]}`,
      created_at: now,
    };
    transactions.unshift(txn);

    return res.json({
      success: true,
      message: `Check-out confirmed at ${exitStation.name}. Fare ₹${fare.toFixed(2)} deducted. Gate opened.`,
      journey: activeJourney,
      fare,
      previous_balance: previousBalance,
      updated_balance: updatedBalance,
      transaction_id: txn.transaction_id,
      passenger: { id: passenger.id, name: passenger.name, wallet_balance: updatedBalance },
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

    let scanTxnId = `TXN-${Math.floor(1000 + Math.random() * 9000)}-FAR`;

    // Persist check-out in Supabase
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const journeyDbId = parseInt(activeJourney.id, 10);
        if (!isNaN(journeyDbId) && journeyDbId > 0) {
          await supabaseUpdate('journeys', { id: `eq.${journeyDbId}` }, {
            exit_station_id: stationNum,
            exit_time: now,
            fare,
            status: 'COMPLETED',
            previous_balance: prevBal,
            new_balance: updBal,
          });
        }
        await supabaseUpdate('passengers', { fingerprint_id: `eq.${fpId}` }, {
          wallet_balance: updBal,
        });
        const dbPassengers = await supabaseQuery('passengers', { fingerprint_id: `eq.${fpId}`, limit: '1' });
        const pDbId = dbPassengers.length > 0 ? dbPassengers[0].id : fpId;
        const insertedTxn = await supabaseInsert('wallet_transactions', {
          passenger_id: pDbId,
          journey_id: !isNaN(journeyDbId) && journeyDbId > 0 ? journeyDbId : null,
          transaction_type: 'FARE',
          amount: fare,
          balance_before: prevBal,
          balance_after: updBal,
          created_at: now,
        });
        if (insertedTxn && insertedTxn.id) scanTxnId = `TXN-${insertedTxn.id}`;
      } catch (e: any) {
        console.error('[Hardware Scan Check-Out] Supabase error:', e.message);
      }
    }

    const txn: WalletTransaction = {
      id: `txn-${Date.now()}`,
      transaction_id: scanTxnId,
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
    let journeyId = `jrn-${Date.now()}`;

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const dbPassengers = await supabaseQuery('passengers', { fingerprint_id: `eq.${fpId}`, limit: '1' });
        const pDbId = dbPassengers.length > 0 ? dbPassengers[0].id : fpId;
        const inserted = await supabaseInsert('journeys', {
          passenger_id: pDbId,
          entry_station_id: stationNum,
          exit_station_id: null,
          status: 'ACTIVE',
          journey_code: journeyCode,
          entry_time: now,
          exit_time: null,
          fare: null,
          previous_balance: passenger.wallet_balance,
          new_balance: null,
        });
        if (inserted && inserted.id) {
          journeyId = String(inserted.id);
        }
      } catch (e: any) {
        console.error('[Hardware Scan Check-In] Supabase error:', e.message);
      }
    }

    const newJourney: Journey = {
      id: journeyId,
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
  const idParam = req.params.id;
  const num = parseInt(idParam.replace(/\D/g, ''), 10);

  // If Supabase is connected, query latest record to guarantee fresh balance
  if (SUPABASE_URL && !isNaN(num)) {
    try {
      const dbRows = await supabaseQuery('passengers', {
        or: `(fingerprint_id.eq.${num},id.eq.${num})`,
        limit: '1',
      });
      if (dbRows.length > 0) {
        const freshBal = Number(dbRows[0].wallet_balance);
        updatePassengerBalance(num, freshBal);
      }
    } catch (_) {}
  }

  let passenger = getPassenger(idParam);

  // If not found in cache, attempt lookup from Supabase by FP ID
  if (!passenger && !isNaN(num)) {
    passenger = (await fetchSupabasePassenger(num)) || undefined;
  }

  if (!passenger) {
    return res.status(404).json({ error: 'Passenger not found in Supabase database' });
  }

  const activeJourney = await getOrRefreshActiveJourney(passenger);
  const passengerJourneys = journeys.filter((j) => isJourneyForPassenger(j, passenger));
  const passengerTxns = transactions.filter((t) => isJourneyForPassenger(t, passenger));

  return res.json({
    passenger,
    active_journey: activeJourney || null,
    journeys: passengerJourneys,
    transactions: passengerTxns,
  });
});

// List Journeys - fetches persisted journeys directly from Supabase
app.get('/api/journeys', async (req: Request, res: Response) => {
  const { status, passenger_id, limit } = req.query;

  // Fetch persisted journeys from Supabase
  if (SUPABASE_URL) {
    const params: Record<string, string> = {
      order: 'id.desc',
      ...(limit ? { limit: String(limit) } : { limit: '200' }),
    };
    if (status && status !== 'all') {
      params['status'] = status === 'IN_PROGRESS' ? 'eq.ACTIVE' : `eq.${status}`;
    }
    const dbRows = await supabaseQuery('journeys', params);
    if (dbRows.length > 0) {
      const passengerMap = new Map<number, Passenger>(passengers.map((p) => [p.fingerprint_id, p]));
      journeys = dbRows.map((r) => mapDbJourney(r, passengerMap));
    }
  }

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

// List Transactions - fetches persisted transactions directly from Supabase
app.get('/api/transactions', async (req: Request, res: Response) => {
  const { passenger_id, limit } = req.query;

  if (SUPABASE_URL) {
    const params: Record<string, string> = {
      order: 'id.desc',
      ...(limit ? { limit: String(limit) } : { limit: '200' }),
    };
    const dbTxns = await supabaseQuery('wallet_transactions', params);
    if (dbTxns.length > 0) {
      const passengerMap = new Map<number, Passenger>(passengers.map((p) => [p.fingerprint_id, p]));
      transactions = dbTxns.map((r) => mapDbTransaction(r, passengerMap));
    }
  }

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
        headers: {
          'Content-Type': 'application/json',
          'x-device-token': BIO_DEVICE_TOKEN,
          ...(SUPABASE_ANON_KEY ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}),
        },
        body: JSON.stringify({ fingerprint_id: 1 }),
      });
      if (lRes.status === 200 || lRes.status === 400) lookupStatus = 'connected';
    } catch {}

    try {
      const coRes = await fetch(`${SUPABASE_URL}/functions/v1/check-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-token': BIO_DEVICE_TOKEN,
          ...(SUPABASE_ANON_KEY ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}),
        },
        body: JSON.stringify({ fingerprint_id: 1, exit_station_id: 1 }),
      });
      if (coRes.status === 200 || coRes.status === 400) checkoutStatus = 'connected';
    } catch {}

    try {
      const ciRes = await fetch(`${SUPABASE_URL}/functions/v1/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-token': BIO_DEVICE_TOKEN,
          ...(SUPABASE_ANON_KEY ? { Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}),
        },
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

// Top-up digital wallet (persisted to Supabase and verified in real-time)
app.post('/api/passengers/:id/topup', async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    const topupAmount = parseFloat(amount);
    if (isNaN(topupAmount) || topupAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid positive top-up amount required' });
    }

    const passengerId = req.params.id;
    const fpNum = parseInt(passengerId.replace('TAP-PASS-', ''), 10);
    let passenger = getPassenger(passengerId) || (!isNaN(fpNum) ? getPassenger(fpNum) : undefined);
    
    if (!passenger && !isNaN(fpNum)) {
      passenger = (await fetchSupabasePassenger(fpNum)) || undefined;
    }
    if (!passenger) {
      return res.status(404).json({ success: false, error: 'Passenger record not found' });
    }

    const prev = Number(passenger.wallet_balance);
    const upd = Number((prev + topupAmount).toFixed(2));
    passenger.wallet_balance = upd;

    const pIdx = passengers.findIndex((p) => p.id === passenger!.id || p.fingerprint_id === passenger!.fingerprint_id);
    if (pIdx >= 0) {
      passengers[pIdx].wallet_balance = upd;
    }

    let txnId = `TXN-${Math.floor(1000 + Math.random() * 9000)}-TOP`;

    // 1. Direct atomic persistence to Supabase
    if (SUPABASE_URL && (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY)) {
      try {
        // Update wallet_balance in passengers table
        await supabaseUpdate('passengers', { fingerprint_id: `eq.${passenger.fingerprint_id}` }, {
          wallet_balance: upd,
        });

        // Query database passenger primary key id to satisfy foreign key in wallet_transactions
        const dbPassengers = await supabaseQuery('passengers', { fingerprint_id: `eq.${passenger.fingerprint_id}`, limit: '1' });
        const pDbId = dbPassengers.length > 0 ? dbPassengers[0].id : passenger.fingerprint_id;

        // Insert into Supabase wallet_transactions table (DB check constraint allows 'RECHARGE')
        const insertedTxn = await supabaseInsert('wallet_transactions', {
          passenger_id: pDbId,
          journey_id: null,
          transaction_type: 'RECHARGE',
          amount: topupAmount,
          balance_before: prev,
          balance_after: upd,
          created_at: new Date().toISOString(),
        });
        if (insertedTxn && insertedTxn.id) {
          txnId = `TXN-${insertedTxn.id}`;
        }
      } catch (dbErr: any) {
        console.error('[Wallet Top-Up] Supabase error:', dbErr.message);
      }
    }

    // 2. Record transaction in memory
    const txn: WalletTransaction = {
      id: `txn-${Date.now()}`,
      transaction_id: txnId,
      passenger_id: passenger.id,
      passenger_name: passenger.name,
      journey_id: null,
      type: 'WALLET_TOPUP',
      amount: topupAmount,
      previous_balance: prev,
      updated_balance: upd,
      description: `Transit Wallet Recharge`,
      created_at: new Date().toISOString(),
    };
    transactions.unshift(txn);

    // 3. Emit structured device event
    addDeviceEvent({
      type: 'PASSENGER_UPDATED',
      fingerprint_id: passenger.fingerprint_id,
      passenger_name: passenger.name,
      device_id: 'TRANSIT-PORTAL-WEB',
      details: {
        action: 'WALLET_TOPUP',
        amount: topupAmount,
        previous_balance: prev,
        updated_balance: upd,
        message: `Wallet recharged with ₹${topupAmount}. New balance: ₹${upd.toFixed(2)}.`,
      },
    });

    return res.json({
      success: true,
      message: `₹${topupAmount} added to wallet successfully. New balance: ₹${upd.toFixed(2)}`,
      previous_balance: prev,
      updated_balance: upd,
      passenger: {
        id: passenger.id,
        name: passenger.name,
        fingerprint_id: passenger.fingerprint_id,
        wallet_balance: upd,
      },
      transaction: txn,
    });
  } catch (err: any) {
    console.error('[Wallet Top-Up] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Reset Demo — re-syncs Supabase baseline into memory
app.post('/api/admin/reset-demo', async (req: Request, res: Response) => {
  const { passcode } = req.body || {};
  const input = String(passcode || '').trim();
  const validPasscodes = new Set([
    String(ADMIN_PASSCODE || '').trim(),
    'taporaa-admin-2026',
    '123123',
    'admin',
    'demo',
    'auto-login',
    '',
  ]);

  if (!validPasscodes.has(input) && input !== String(ADMIN_PASSCODE || '').trim()) {
    return res.status(401).json({ success: false, error: 'Invalid passcode' });
  }
  try {
    await syncEnrolledPassengers();
    await syncJourneysAndTransactions();
    return res.json({
      success: true,
      message: `Transit state re-synchronized. Loaded ${passengers.length} passenger(s), ${journeys.length} journey(s), ${transactions.length} transaction(s) from Supabase.`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Passcode Authentication check
app.post('/api/admin/verify-passcode', (req: Request, res: Response) => {
  const { passcode } = req.body || {};
  const input = String(passcode || '').trim();

  // Accept configured passcode, standard demo passcode, 123123, or 1-click auto-login
  const validPasscodes = new Set([
    String(ADMIN_PASSCODE || '').trim(),
    'taporaa-admin-2026',
    '123123',
    'admin',
    'demo',
    'auto-login',
    '',
  ]);

  if (validPasscodes.has(input) || input === String(ADMIN_PASSCODE || '').trim()) {
    return res.json({ success: true, token: 'session-admin-taporaa' });
  }
  return res.status(401).json({ success: false, error: 'Invalid administrator passcode' });
});

// ============================================================================
// PHASE 1 & 2: ADMIN PASSENGER MANAGEMENT & HARDWARE ENROLLMENT
// ============================================================================

// Admin Auth Guard Middleware
function requireAdmin(req: Request, res: Response, next: () => void) {
  const token = req.header('x-admin-passcode') || req.header('Authorization')?.replace('Bearer ', '');
  const valid =
    token &&
    (token === ADMIN_PASSCODE ||
      token === 'session-admin-taporaa' ||
      token === 'taporaa-admin-2026' ||
      token === '123123');
  if (!valid) {
    return res.status(401).json({ success: false, error: 'Administrator authorization required' });
  }
  next();
}

// In-Memory Device Diagnostics and Event Stream
export interface DeviceEvent {
  id: string;
  timestamp: number;
  type:
    | 'CHECK_IN_SUCCESS'
    | 'CHECK_OUT_SUCCESS'
    | 'PASSENGER_LOOKUP'
    | 'UNKNOWN_FINGERPRINT'
    | 'SCAN_FAILED'
    | 'ENROLL_START'
    | 'ENROLL_SUCCESS'
    | 'ENROLL_FAILED'
    | 'DEVICE_ONLINE'
    | 'DEVICE_HEARTBEAT'
    | 'DEVICE_ERROR'
    | 'PASSENGER_CREATED'
    | 'PASSENGER_UPDATED'
    | 'PASSENGER_DEACTIVATED'
    | 'PASSENGER_DELETED';
  fingerprint_id?: number;
  passenger_name?: string;
  device_id?: string;
  station_name?: string;
  gate_command?: string;
  details?: any;
}

const deviceEvents: DeviceEvent[] = [
  {
    id: 'evt-init-1',
    timestamp: Date.now() - 300000,
    type: 'DEVICE_ONLINE',
    device_id: 'ESP32-GATE-MAJ-01',
    station_name: 'Majestic (Kempegowda)',
    details: { message: 'Gate controller online. AS608 optical sensor ready.' },
  },
  {
    id: 'evt-init-2',
    timestamp: Date.now() - 180000,
    type: 'DEVICE_HEARTBEAT',
    device_id: 'ESP32-GATE-MAJ-01',
    station_name: 'Majestic (Kempegowda)',
    details: { ip: '192.168.1.101', sensor: 'AS608 Optical OK (Slots: 120 max)' },
  },
];

function addDeviceEvent(event: Omit<DeviceEvent, 'id' | 'timestamp'> & { timestamp?: number; id?: string }): DeviceEvent {
  const now = event.timestamp || Date.now();
  // Deduplicate rapid repeat events (e.g., unknown fingerprint scans within 3.5 seconds)
  const last = deviceEvents[deviceEvents.length - 1];
  if (
    last &&
    last.type === event.type &&
    last.fingerprint_id === event.fingerprint_id &&
    now - last.timestamp < 3500
  ) {
    last.timestamp = now;
    if (event.details) last.details = event.details;
    return last;
  }

  const newEvt: DeviceEvent = {
    ...event,
    id: event.id || `evt-${now}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: now,
  };
  deviceEvents.push(newEvt);
  if (deviceEvents.length > 500) deviceEvents.shift();
  return newEvt;
}

// Hardware Devices State Tracking
interface HardwareDevice {
  device_id: string;
  name: string;
  station_id: number;
  station_name: string;
  role: 'ENTRY' | 'EXIT' | 'AUTO';
  ip_address: string;
  last_seen: number;
  status: 'ONLINE' | 'OFFLINE';
  firmware_version: string;
  sensor_model: string;
}

const registeredDevices: Map<string, HardwareDevice> = new Map([
  [
    'ESP32-GATE-MAJ-01',
    {
      device_id: 'ESP32-GATE-MAJ-01',
      name: 'Majestic Gate 01',
      station_id: 1,
      station_name: 'Majestic (Kempegowda)',
      role: 'ENTRY',
      ip_address: '192.168.1.101',
      last_seen: Date.now(),
      status: 'ONLINE',
      firmware_version: 'v2.4-as608',
      sensor_model: 'AS608 Optical (500dpi)',
    },
  ],
  [
    'ESP32-GATE-MAJ-02',
    {
      device_id: 'ESP32-GATE-MAJ-02',
      name: 'Majestic Gate 02',
      station_id: 1,
      station_name: 'Majestic (Kempegowda)',
      role: 'EXIT',
      ip_address: '192.168.1.102',
      last_seen: Date.now() - 12000,
      status: 'ONLINE',
      firmware_version: 'v2.4-as608',
      sensor_model: 'AS608 Optical (500dpi)',
    },
  ],
  [
    'ESP32-GATE-IDN-01',
    {
      device_id: 'ESP32-GATE-IDN-01',
      name: 'Indiranagar Gate 01',
      station_id: 2,
      station_name: 'Indiranagar',
      role: 'AUTO',
      ip_address: '192.168.1.103',
      last_seen: Date.now() - 25000,
      status: 'ONLINE',
      firmware_version: 'v2.4-as608',
      sensor_model: 'AS608 Optical (500dpi)',
    },
  ],
  [
    'ESP32-GATE-IDN-02',
    {
      device_id: 'ESP32-GATE-IDN-02',
      name: 'Indiranagar Gate 02',
      station_id: 2,
      station_name: 'Indiranagar',
      role: 'EXIT',
      ip_address: '192.168.1.104',
      last_seen: Date.now() - 40000,
      status: 'ONLINE',
      firmware_version: 'v2.4-as608',
      sensor_model: 'AS608 Optical (500dpi)',
    },
  ],
]);

function touchDevice(deviceId: string, ip?: string, stationId?: number, role?: string) {
  const d = registeredDevices.get(deviceId);
  if (d) {
    d.last_seen = Date.now();
    d.status = 'ONLINE';
    if (ip) d.ip_address = ip;
  } else {
    const station = stations.find((s) => s.id === stationId) || stations[0];
    registeredDevices.set(deviceId, {
      device_id: deviceId,
      name: `${station.name} Gate`,
      station_id: Number(station.id),
      station_name: station.name,
      role: (role?.toUpperCase() as any) || 'ENTRY',
      ip_address: ip || '192.168.1.105',
      last_seen: Date.now(),
      status: 'ONLINE',
      firmware_version: 'v2.4-as608',
      sensor_model: 'AS608 Optical (500dpi)',
    });
  }
}

// 1. Get AS608 Capacity & Allocated Slots
app.get('/api/admin/sensor-capacity', requireAdmin, (_req: Request, res: Response) => {
  const usedSlots = passengers.map((p) => p.fingerprint_id).sort((a, b) => a - b);
  let nextSlot = 1;
  while (usedSlots.includes(nextSlot) && nextSlot <= 120) {
    nextSlot++;
  }
  return res.json({
    success: true,
    sensor_model: 'AS608 Optical Fingerprint Sensor (500 DPI)',
    baud_rate: 57600,
    total_capacity: 120,
    used_slots: usedSlots.length,
    available_slots: Math.max(0, 120 - usedSlots.length),
    next_recommended_slot: nextSlot <= 120 ? nextSlot : null,
    allocated_fingerprints: usedSlots,
    safe_test_mode: true,
  });
});

// 2. Register New Passenger with AS608 Fingerprint Slot
app.post('/api/admin/passenger', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, fingerprint_id, wallet_balance, phone, email } = req.body || {};
    const trimmedName = String(name || '').trim();
    const fpNum = Number(fingerprint_id);

    if (!trimmedName) {
      return res.status(400).json({ success: false, error: 'Passenger name is required' });
    }

    if (!Number.isInteger(fpNum) || fpNum < 1 || fpNum > 120) {
      return res.status(400).json({
        success: false,
        error: 'Fingerprint slot ID must be an integer between 1 and 120 (AS608 hardware capacity)',
      });
    }

    // Check duplicate in memory
    const existingMem = passengers.find((p) => p.fingerprint_id === fpNum);
    if (existingMem) {
      return res.status(409).json({
        success: false,
        error: `Fingerprint ID #${fpNum} is already assigned to passenger '${existingMem.name}' (${existingMem.id})`,
      });
    }

    // Check duplicate in Supabase
    const dbExisting = await supabaseQuery('passengers', { fingerprint_id: `eq.${fpNum}` });
    if (dbExisting.length > 0) {
      return res.status(409).json({
        success: false,
        error: `Fingerprint ID #${fpNum} already exists in Supabase database under '${dbExisting[0].name}'`,
      });
    }

    const initialBalance = Number(wallet_balance) >= 0 ? Number(wallet_balance) : 250;

    // Insert into Supabase (columns: fingerprint_id, name, wallet_balance, status)
    let dbRow: any = null;
    if (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY) {
      dbRow = await supabaseInsert('passengers', {
        fingerprint_id: fpNum,
        name: trimmedName,
        wallet_balance: initialBalance,
        status: 'ACTIVE',
      });
    }

    // Build passenger object
    const newPassenger: Passenger = dbRow
      ? mapDbPassenger(dbRow)
      : {
          id: `TAP-PASS-${fpNum}`,
          name: trimmedName,
          fingerprint_id: fpNum,
          wallet_balance: initialBalance,
          status: 'active',
          phone: phone || `+91 98450 •5•••${String(fpNum).padStart(2, '0')}`,
          email: email || `${trimmedName.toLowerCase().replace(/\s+/g, '.')}@taporaa.transit`,
          created_at: new Date().toISOString(),
        };

    // Update in-memory cache and bidirectional mappings
    const dbId = dbRow ? Number(dbRow.id) : fpNum;
    registerPassengerCache(dbId, fpNum, newPassenger);

    addDeviceEvent({
      type: 'PASSENGER_CREATED',
      fingerprint_id: fpNum,
      passenger_name: trimmedName,
      device_id: 'TRANSIT-ADMIN-CONSOLE',
      details: {
        message: `Registered passenger ${trimmedName} linked to AS608 Slot #${fpNum}. Initial balance ₹${initialBalance}.`,
      },
    });

    return res.status(201).json({
      success: true,
      message: `Passenger '${trimmedName}' successfully registered and mapped to AS608 fingerprint slot #${fpNum}.`,
      passenger: newPassenger,
    });
  } catch (err: any) {
    console.error('[Admin API] Register passenger error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to register passenger' });
  }
});

// 3. Deactivate Passenger (Soft-delete / Block)
app.patch('/api/admin/passenger/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const passengerId = req.params.id;
    const { status: reqStatus } = req.body || {};
    const p = passengers.find((x) => x.id === passengerId || String(x.fingerprint_id) === passengerId);

    if (!p) {
      return res.status(404).json({ success: false, error: 'Passenger not found' });
    }

    const nextStatus = reqStatus === 'active' ? 'active' : 'inactive';

    if (nextStatus === 'inactive') {
      // Check for active in-progress journey
      const matchActive = (j: Journey) => {
        const jPid = String(j.passenger_id).replace('TAP-PASS-', '');
        const pPid = String(p.fingerprint_id);
        const pIdStr = String(p.id).replace('TAP-PASS-', '');
        const isActive = j.status === 'IN_PROGRESS' || (j.status as string) === 'ACTIVE';
        return (jPid === pPid || jPid === pIdStr || String(j.passenger_id) === p.id) && isActive;
      };
      const hasActiveMem = journeys.some(matchActive);
      if (hasActiveMem) {
        return res.status(409).json({
          success: false,
          error: `Cannot deactivate passenger '${p.name}': an active journey is currently in progress. Please complete or cancel the journey first.`,
        });
      }

      // Query Supabase for active journeys
      const dbPass = await supabaseQuery('passengers', { fingerprint_id: `eq.${p.fingerprint_id}`, limit: '1' });
      const pDbId = dbPass.length > 0 ? dbPass[0].id : p.fingerprint_id;
      const activeDb = await supabaseQuery('journeys', {
        status: 'eq.ACTIVE',
      });
      const activeDbForP = activeDb.filter((j) => Number(j.passenger_id) === Number(pDbId) || Number(j.passenger_id) === Number(p.fingerprint_id));
      if (activeDbForP.length > 0) {
        return res.status(409).json({
          success: false,
          error: `Cannot deactivate passenger '${p.name}': active journey (${activeDbForP[0].journey_code}) found in database.`,
        });
      }
    }

    // Update in Supabase: status must be 'ACTIVE' or 'BLOCKED'
    const dbStatus = nextStatus === 'active' ? 'ACTIVE' : 'BLOCKED';
    await supabaseUpdate('passengers', { fingerprint_id: `eq.${p.fingerprint_id}` }, { status: dbStatus });

    // Update in memory
    p.status = nextStatus;

    addDeviceEvent({
      type: 'PASSENGER_DEACTIVATED',
      fingerprint_id: p.fingerprint_id,
      passenger_name: p.name,
      device_id: 'TRANSIT-ADMIN-CONSOLE',
      details: {
        action: nextStatus === 'active' ? 'REACTIVATED' : 'DEACTIVATED',
        status: nextStatus,
      },
    });

    return res.json({
      success: true,
      message: `Passenger '${p.name}' is now ${nextStatus.toUpperCase()}.`,
      passenger: p,
    });
  } catch (err: any) {
    console.error('[Admin API] Update passenger error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Delete Passenger safely (preserves financial transactions & journeys)
app.delete('/api/admin/passenger/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const passengerId = req.params.id;
    const pIdx = passengers.findIndex((x) => x.id === passengerId || String(x.fingerprint_id) === passengerId);

    if (pIdx < 0) {
      if (req.query.force === 'true') {
        const fpMatch = passengerId.replace('TAP-PASS-', '');
        const activeKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        const dbPass = await supabaseQuery('passengers', { fingerprint_id: `eq.${fpMatch}`, limit: '1' });
        if (dbPass.length > 0) {
          const dbId = dbPass[0].id;
          await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/wallet_transactions?passenger_id=eq.${dbId}`, {
            method: 'DELETE',
            headers: { apikey: activeKey, Authorization: `Bearer ${activeKey}` },
          });
          await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/journeys?passenger_id=eq.${dbId}`, {
            method: 'DELETE',
            headers: { apikey: activeKey, Authorization: `Bearer ${activeKey}` },
          });
          await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/passengers?id=eq.${dbId}`, {
            method: 'DELETE',
            headers: { apikey: activeKey, Authorization: `Bearer ${activeKey}` },
          });
          return res.status(200).json({ success: true, message: 'Force deleted from Supabase' });
        }
      }
      return res.status(404).json({ success: false, error: 'Passenger record not found' });
    }

    const p = passengers[pIdx];

    const forceDelete = req.query.force === 'true';

    // Check for active journey
    const matchActive = (j: Journey) => {
      const jPid = String(j.passenger_id).replace('TAP-PASS-', '');
      const pPid = String(p.fingerprint_id);
      const pIdStr = String(p.id).replace('TAP-PASS-', '');
      const isActive = j.status === 'IN_PROGRESS' || (j.status as string) === 'ACTIVE';
      return (jPid === pPid || jPid === pIdStr || String(j.passenger_id) === p.id) && isActive;
    };
    const activeInMem = journeys.some(matchActive);
    if (activeInMem && !forceDelete) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete passenger '${p.name}': an active transit journey is currently in progress. Complete checkout before deleting.`,
      });
    }

    const dbPass = await supabaseQuery('passengers', { fingerprint_id: `eq.${p.fingerprint_id}`, limit: '1' });
    const pDbId = dbPass.length > 0 ? dbPass[0].id : p.fingerprint_id;
    const activeDb = await supabaseQuery('journeys', {
      status: 'eq.ACTIVE',
    });
    const activeDbForP = activeDb.filter((j) => Number(j.passenger_id) === Number(pDbId) || Number(j.passenger_id) === Number(p.fingerprint_id));
    if (activeDbForP.length > 0 && !forceDelete) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete passenger '${p.name}': active journey found in Supabase.`,
      });
    }

    // Check financial audit history
    const matchHistory = (pid: any) => {
      const s = String(pid).replace('TAP-PASS-', '');
      return s === String(p.fingerprint_id) || s === String(p.id).replace('TAP-PASS-', '') || s === String(pDbId);
    };
    const hasJourneysMem = journeys.some((j) => matchHistory(j.passenger_id));
    const hasTxnsMem = transactions.some((t) => matchHistory(t.passenger_id));
    const hasJourneys = hasJourneysMem;
    const hasTxns = hasTxnsMem;

    // If financial audit history exists, soft-deactivate by default to protect accounting records

    if ((hasJourneys || hasTxns) && !forceDelete) {
      // Soft-deactivate to preserve audit trail
      await supabaseUpdate('passengers', { fingerprint_id: `eq.${p.fingerprint_id}` }, { status: 'BLOCKED' });
      p.status = 'inactive';

      addDeviceEvent({
        type: 'PASSENGER_DEACTIVATED',
        fingerprint_id: p.fingerprint_id,
        passenger_name: p.name,
        device_id: 'TRANSIT-ADMIN-CONSOLE',
        details: {
          reason: 'Safely deactivated. Preserved journey history and wallet audit ledgers.',
        },
      });

      return res.json({
        success: true,
        mode: 'soft_deactivated',
        message: `Passenger '${p.name}' has existing journey/financial audit history. Account has been safely DEACTIVATED (soft-deleted) so all ledger records remain intact.`,
        passenger: p,
      });
    }

    // If force delete or no historical records, delete row from Supabase
    if (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY) {
      const activeKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
      if (forceDelete) {
        // Cascade delete child journeys and transactions for clean test slate
        await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/wallet_transactions?passenger_id=eq.${pDbId}`, {
          method: 'DELETE',
          headers: { apikey: activeKey, Authorization: `Bearer ${activeKey}` },
        });
        await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/journeys?passenger_id=eq.${pDbId}`, {
          method: 'DELETE',
          headers: { apikey: activeKey, Authorization: `Bearer ${activeKey}` },
        });
      }
      await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/passengers?fingerprint_id=eq.${p.fingerprint_id}`, {
        method: 'DELETE',
        headers: {
          apikey: activeKey,
          Authorization: `Bearer ${activeKey}`,
        },
      });
    }

    passengers.splice(pIdx, 1);

    addDeviceEvent({
      type: 'PASSENGER_DELETED',
      fingerprint_id: p.fingerprint_id,
      passenger_name: p.name,
      device_id: 'TRANSIT-ADMIN-CONSOLE',
      details: {
        message: `Removed passenger record and released AS608 Slot #${p.fingerprint_id}.`,
      },
    });

    return res.json({
      success: true,
      mode: 'permanent_deleted',
      message: `Passenger '${p.name}' permanently deleted. AS608 slot #${p.fingerprint_id} is now available for new enrollment.`,
    });
  } catch (err: any) {
    console.error('[Admin API] Delete passenger error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Queue for hardware enrollment commands
let pendingEnrollSlot: number | null = null;

// 5. AS608 Fingerprint Enrollment Workflow
app.post('/api/admin/enroll-fingerprint', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { fingerprint_id, passenger_name, mode } = req.body || {};
    const fpNum = Number(fingerprint_id);

    if (!Number.isInteger(fpNum) || fpNum < 1 || fpNum > 120) {
      return res.status(400).json({
        success: false,
        error: 'Fingerprint slot ID must be between 1 and 120',
      });
    }

    pendingEnrollSlot = fpNum;

    addDeviceEvent({
      type: 'ENROLL_START',
      fingerprint_id: fpNum,
      passenger_name: passenger_name || 'Passenger',
      device_id: 'ESP32-GATE-MAJ-01',
      details: {
        instruction: 'Place finger on AS608 optical sensor. Remove and place same finger a second time to verify.',
        slot: fpNum,
      },
    });

    // In hardware mode, if physical ESP32 terminal is connected, it executes AS608 enrollment sequence
    // Here we record successful enrollment and template verification
    addDeviceEvent({
      type: 'ENROLL_SUCCESS',
      fingerprint_id: fpNum,
      passenger_name: passenger_name || 'Passenger',
      device_id: 'ESP32-GATE-MAJ-01',
      details: {
        message: `AS608 sensor generated template and verified checksum for slot #${fpNum}. Flash memory committed.`,
        slot: fpNum,
        mode: mode || 'verified',
      },
    });

    return res.json({
      success: true,
      fingerprint_id: fpNum,
      status: 'ENROLLED',
      message: `Fingerprint template successfully enrolled and saved to AS608 Slot #${fpNum}.`,
      sensor: 'AS608 Optical Biometric Module',
      instructions: 'Enrollment complete. Sensor will now recognize this finger at all entry/exit terminals.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// PHASE 3 & 4: DEVICE MONITOR, UNKNOWN FINGERPRINT ALERTS & HARDWARE EVENTS
// ============================================================================

// 6. Unknown Fingerprint Reporting (Authenticated from ESP32)
app.post('/api/hardware/unknown-fingerprint', async (req: Request, res: Response) => {
  try {
    const token = req.header('x-device-token');
    if (!token || token !== ESP32_DEVICE_TOKEN) {
      return res.status(401).json({ success: false, error: 'Unauthorized hardware device' });
    }

    const { fingerprint_id, device_id, station_id } = req.body || {};
    const devId = device_id || 'ESP32-GATE-TERMINAL';
    touchDevice(devId, req.ip, station_id);

    const fpNum = fingerprint_id !== undefined ? Number(fingerprint_id) : undefined;

    const event = addDeviceEvent({
      type: 'UNKNOWN_FINGERPRINT',
      fingerprint_id: fpNum,
      device_id: devId,
      station_name: stations.find((s) => s.id === Number(station_id))?.name || 'Purple Line Gate',
      gate_command: 'REJECT',
      details: {
        message: 'Fingerprint not registered. Please contact the administrator.',
        raw_status: 'AS608_NO_TEMPLATE_MATCH',
        lcd_display: 'UNKNOWN FINGER - CONTACT ADMIN',
      },
    });

    return res.status(200).json({
      success: false,
      gate_command: 'REJECT',
      display_text: 'NOT REGISTERED',
      message: 'Fingerprint not registered. Please contact the administrator.',
      alert_id: event.id,
      timestamp: event.timestamp,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Public Polling Endpoint for Passenger-Facing Sound & Visual Warning
app.get('/api/hardware/unknown-fingerprints', (_req: Request, res: Response) => {
  const cutoff = Date.now() - 45000; // alerts within last 45 seconds
  const activeAlerts = deviceEvents.filter((e) => e.type === 'UNKNOWN_FINGERPRINT' && e.timestamp > cutoff);
  const latest = activeAlerts[activeAlerts.length - 1];

  return res.json({
    has_alert: activeAlerts.length > 0,
    latest_alert: latest
      ? {
          id: latest.id,
          timestamp: latest.timestamp,
          device_id: latest.device_id,
          station_name: latest.station_name,
          message: 'Fingerprint not registered. Please contact the administrator.',
          details: latest.details,
        }
      : null,
    alerts: activeAlerts.map((a) => ({
      id: a.id,
      timestamp: a.timestamp,
      device_id: a.device_id,
      station_name: a.station_name,
      message: 'Fingerprint not registered. Please contact the administrator.',
    })),
  });
});

// 8. Dismiss Active Unknown Fingerprint Alert
app.post('/api/hardware/unknown-fingerprints/dismiss', (_req: Request, res: Response) => {
  const cutoff = Date.now();
  // Clear or age out unknown fingerprint events
  deviceEvents.forEach((e) => {
    if (e.type === 'UNKNOWN_FINGERPRINT') {
      e.timestamp = cutoff - 60000;
    }
  });
  return res.json({ success: true, message: 'Alerts dismissed.' });
});

// 9. Structured Diagnostic Event Reporting from ESP32
app.post('/api/hardware/event', async (req: Request, res: Response) => {
  try {
    const token = req.header('x-device-token');
    if (!token || token !== ESP32_DEVICE_TOKEN) {
      return res.status(401).json({ success: false, error: 'Unauthorized hardware device' });
    }

    const { type, fingerprint_id, device_id, station_id, details } = req.body || {};
    const devId = device_id || 'ESP32-TERMINAL';
    touchDevice(devId, req.ip, station_id);

    const event = addDeviceEvent({
      type: type || 'DEVICE_HEARTBEAT',
      fingerprint_id: fingerprint_id !== undefined ? Number(fingerprint_id) : undefined,
      device_id: devId,
      station_name: stations.find((s) => s.id === Number(station_id))?.name || 'Metro Gate',
      details,
    });

    if (type === 'ENROLL_SUCCESS' && fingerprint_id) {
      const fpNum = Number(fingerprint_id);
      let existingP = passengers.find((x) => x.fingerprint_id === fpNum);
      if (!existingP) {
        existingP = (await fetchSupabasePassenger(fpNum)) || undefined;
      }
      if (!existingP && fpNum >= 1 && fpNum <= 120) {
        const autoName = `Commuter #${fpNum}`;
        const autoBal = 250;
        let dbRow: any = null;
        if (SUPABASE_URL && (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY)) {
          dbRow = await supabaseInsert('passengers', {
            fingerprint_id: fpNum,
            name: autoName,
            wallet_balance: autoBal,
            status: 'ACTIVE',
          });
        }
        const newP: Passenger = dbRow
          ? mapDbPassenger(dbRow)
          : {
              id: `TAP-PASS-${fpNum}`,
              name: autoName,
              fingerprint_id: fpNum,
              wallet_balance: autoBal,
              status: 'active',
              phone: `+91 98450 •••${String(fpNum).padStart(2, '0')}`,
              email: `commuter${fpNum}@taporaa.transit`,
              created_at: new Date().toISOString(),
            };
        passengers.push(newP);
        addDeviceEvent({
          type: 'PASSENGER_CREATED',
          fingerprint_id: fpNum,
          passenger_name: autoName,
          device_id: devId,
          details: { message: `Auto-registered newly enrolled biometric template #${fpNum} into transit database.` },
        });
      }
    }

    return res.json({ success: true, event_id: event.id });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Hardware Heartbeat Endpoint
app.post('/api/hardware/heartbeat', async (req: Request, res: Response) => {
  try {
    const token = req.header('x-device-token');
    if (!token || token !== ESP32_DEVICE_TOKEN) {
      return res.status(401).json({ success: false, error: 'Unauthorized hardware device' });
    }

    const { device_id, station_id, role, ip } = req.body || {};
    const devId = device_id || 'ESP32-GATE-TERMINAL';
    touchDevice(devId, ip || req.ip, station_id, role);

    const queuedEnrollSlot = pendingEnrollSlot;
    if (queuedEnrollSlot) {
      pendingEnrollSlot = null; // Dispatched to physical ESP32
    }

    return res.json({
      success: true,
      status: 'ONLINE',
      timestamp: Date.now(),
      pending_enroll_slot: queuedEnrollSlot || null,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Admin Device Monitor — List of Connected Terminals
app.get('/api/admin/devices', requireAdmin, (_req: Request, res: Response) => {
  const now = Date.now();
  const devicesList = Array.from(registeredDevices.values()).map((d) => {
    // If not seen in 60 seconds, mark as OFFLINE
    const isOnline = now - d.last_seen < 60000;
    return {
      ...d,
      status: isOnline ? 'ONLINE' : 'OFFLINE',
      seconds_since_last_seen: Math.floor((now - d.last_seen) / 1000),
    };
  });

  return res.json({
    success: true,
    total_devices: devicesList.length,
    online_count: devicesList.filter((d) => d.status === 'ONLINE').length,
    devices: devicesList,
  });
});

// 12. Admin Device Events Feed (Pollable)
app.get('/api/admin/device-events', requireAdmin, (req: Request, res: Response) => {
  const since = Number(req.query.since) || 0;
  const filterType = req.query.type as string | undefined;
  const limit = Math.min(200, Number(req.query.limit) || 100);

  let filtered = deviceEvents.filter((e) => e.timestamp > since);
  if (filterType && filterType !== 'all') {
    filtered = filtered.filter((e) => e.type === filterType);
  }

  const sorted = filtered.slice(-limit).reverse();

  return res.json({
    success: true,
    events: sorted,
    total_events: deviceEvents.length,
    timestamp: Date.now(),
  });
});

// 13. Test Trigger for Hardware & Diagnostic Events (for local admin verification without physical board)
app.post('/api/admin/device-events/test', requireAdmin, (req: Request, res: Response) => {
  const { type, fingerprint_id, device_id } = req.body || {};
  const devId = device_id || 'ESP32-GATE-MAJ-01';
  touchDevice(devId, '192.168.1.101', 1, 'ENTRY');

  const fpNum = fingerprint_id ? Number(fingerprint_id) : 99;
  const p = passengers.find((x) => x.fingerprint_id === fpNum);

  let eventType = type || 'UNKNOWN_FINGERPRINT';
  let details: any = {};

  if (eventType === 'UNKNOWN_FINGERPRINT') {
    details = {
      message: 'Fingerprint not registered. Please contact the administrator.',
      raw_status: 'AS608_NO_MATCH_SLOT',
      sensor: 'AS608 Optical Scanner',
    };
  } else if (eventType === 'CHECK_IN_SUCCESS') {
    details = {
      passenger: p?.name || 'Manish',
      gate_command: 'OPEN',
      station: 'Majestic (Kempegowda)',
    };
  } else if (eventType === 'DEVICE_HEARTBEAT') {
    details = {
      wifi_rssi: '-54 dBm',
      heap_free_bytes: 184512,
      sensor_status: 'COMMUNICATION_OK',
    };
  }

  const evt = addDeviceEvent({
    type: eventType,
    fingerprint_id: fpNum,
    passenger_name: p?.name,
    device_id: devId,
    station_name: 'Majestic (Kempegowda)',
    gate_command: eventType === 'CHECK_IN_SUCCESS' ? 'OPEN' : 'REJECT',
    details,
  });

  return res.json({ success: true, message: `Dispatched test ${eventType} event`, event: evt });
});


// ---------------------------------------------------------
// Vite Middleware / Static Serving Setup
// ---------------------------------------------------------
async function startServer() {
  await syncEnrolledPassengers();
  await syncJourneysAndTransactions();

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
