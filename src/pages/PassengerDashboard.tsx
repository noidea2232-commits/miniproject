import React, { useState, useEffect } from 'react';
import {
  Fingerprint,
  Wallet,
  ArrowUpRight,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Navigation,
  Train,
  ArrowRight,
  Shield,
  Smartphone,
  ChevronRight,
  Cpu,
} from 'lucide-react';
import { api } from '../services/api';
import type { Passenger, Station, Journey, WalletTransaction } from '../types/index';

interface PassengerDashboardProps {
  stations: Station[];
  onScanRedirect?: () => void;
}

type TravelState =
  | 'ready_to_travel'
  | 'check_in_successful'
  | 'journey_active'
  | 'check_out_successful'
  | 'journey_completed'
  | 'insufficient_balance'
  | 'passenger_not_recognized'
  | 'connection_unavailable';

export const PassengerDashboard: React.FC<PassengerDashboardProps> = ({ stations, onScanRedirect }) => {
  const [passengersList, setPassengersList] = useState<Passenger[]>([]);
  const [selectedPassengerId, setSelectedPassengerId] = useState<string>('');
  const [passenger, setPassenger] = useState<Passenger | null>(null);
  const [activeJourney, setActiveJourney] = useState<Journey | null>(null);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Station selections for web testing flow
  const [selectedEntryStation, setSelectedEntryStation] = useState<string | number>(1);
  const [selectedExitStation, setSelectedExitStation] = useState<string | number>(2);

  // Top-up modal state
  const [showTopupModal, setShowTopupModal] = useState<boolean>(false);
  const [topupAmount, setTopupAmount] = useState<string>('100');

  // Load passenger data
  const loadData = async (targetId = selectedPassengerId) => {
    try {
      setLoading(true);
      setErrorMsg(null);

      // Load all real passengers from Supabase
      const plistRes = await api.getPassengers();
      setPassengersList(plistRes.passengers);

      let effectiveId = targetId;
      if ((!effectiveId || !plistRes.passengers.some((p) => p.id === effectiveId)) && plistRes.passengers.length > 0) {
        effectiveId = plistRes.passengers[0].id;
        setSelectedPassengerId(effectiveId);
      }

      if (effectiveId) {
        // Load specific passenger details
        const details = await api.getPassengerDetails(effectiveId);
        setPassenger(details.passenger);
        setActiveJourney(details.active_journey);
        setJourneys(details.journeys);
        setTransactions(details.transactions);

        // Live sync balance from Supabase Edge Function
        if (details.passenger?.fingerprint_id) {
          try {
            const liveLookup = await api.lookupPassenger(details.passenger.fingerprint_id);
            if (liveLookup.recognized && liveLookup.passenger) {
              setPassenger(liveLookup.passenger);
              if (liveLookup.active_journey) {
                setActiveJourney(liveLookup.active_journey);
              }
            }
          } catch {}
        }
      }
    } catch (err: any) {
      console.error('Failed to load passenger data:', err);
      setErrorMsg(err.message || 'Connection unavailable. Could not fetch passenger data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedPassengerId);
  }, [selectedPassengerId]);

  // Determine current journey state
  const getTravelState = (): TravelState => {
    if (errorMsg) {
      if (errorMsg.includes('not recognized')) return 'passenger_not_recognized';
      if (errorMsg.includes('balance') || errorMsg.includes('insufficient')) return 'insufficient_balance';
      return 'connection_unavailable';
    }
    if (activeJourney) {
      return 'journey_active';
    }
    if (successNotice) {
      if (successNotice.includes('Check-in successful')) return 'check_in_successful';
      if (successNotice.includes('Check-out confirmed')) return 'check_out_successful';
      return 'journey_completed';
    }
    if (passenger && passenger.wallet_balance < 10) {
      return 'insufficient_balance';
    }
    return 'ready_to_travel';
  };

  const travelState = getTravelState();

  // Check-In Handler (calls /api/edge/check-in proxy)
  const handleCheckIn = async () => {
    if (!passenger) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      setSuccessNotice(null);

      const res = await api.checkIn({
        passenger_id: passenger.id,
        fingerprint_id: passenger.fingerprint_id,
        station_id: selectedEntryStation,
        device_id: 'TAP-WEB-MOBILE-01',
      });

      setSuccessNotice(res.message);
      await loadData(passenger.id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Check-in failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Check-Out Handler (calls /api/edge/check-out proxy)
  const handleCheckOut = async () => {
    if (!passenger || !activeJourney) return;
    try {
      setActionLoading(true);
      setErrorMsg(null);
      setSuccessNotice(null);

      const res = await api.checkOut({
        passenger_id: passenger.id,
        fingerprint_id: passenger.fingerprint_id,
        station_id: selectedExitStation,
        device_id: 'TAP-WEB-MOBILE-02',
      });

      setSuccessNotice(res.message);
      await loadData(passenger.id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Check-out failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Quick Top-up Handler
  const handleTopup = async () => {
    if (!passenger) return;
    const amount = parseFloat(topupAmount);
    if (isNaN(amount) || amount <= 0) return;

    try {
      setActionLoading(true);
      await api.topupWallet(passenger.id, amount);
      setShowTopupModal(false);
      setSuccessNotice(`₹${amount} added successfully to wallet!`);
      await loadData(passenger.id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Top-up failed');
    } finally {
      setActionLoading(false);
    }
  };

  const lastFareTxn = transactions.find((t) => t.type === 'FARE_DEDUCTION');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Header & Account Switcher for Testing */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-400 tracking-wider uppercase font-mono">
              TAPORAA MOBILE PASS
            </span>
            <span className="text-slate-500 text-xs">·</span>
            <span className="text-xs text-slate-400">Bangalore Metro Transit</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Passenger Wallet &amp; Journeys</h1>
        </div>

        {/* Test Passenger Selector */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
          <span className="text-slate-400 pl-2 text-[11px] font-medium">Switch Passenger:</span>
          <select
            value={selectedPassengerId}
            onChange={(e) => setSelectedPassengerId(e.target.value)}
            className="bg-slate-950 text-white rounded px-2.5 py-1.5 border border-slate-800 focus:outline-none focus:border-emerald-500 font-medium"
          >
            {passengersList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (FP #{p.fingerprint_id} · ₹{p.wallet_balance.toFixed(0)}) {p.status !== 'active' ? `[${p.status}]` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() => loadData()}
            title="Refresh Passenger Data"
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* State Feedback Banner (PRD Section 5.2 requirement) */}
      <div
        className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
          travelState === 'journey_active'
            ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
            : travelState === 'check_in_successful' || travelState === 'check_out_successful' || travelState === 'journey_completed'
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
            : travelState === 'insufficient_balance' || travelState === 'passenger_not_recognized'
            ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
            : travelState === 'connection_unavailable'
            ? 'bg-red-950/40 border-red-500/40 text-red-200'
            : 'bg-slate-900/60 border-slate-800 text-slate-300'
        }`}
      >
        <div className="flex items-center gap-3">
          {travelState === 'journey_active' ? (
            <Train className="w-5 h-5 text-cyan-400 animate-pulse" />
          ) : travelState === 'check_in_successful' || travelState === 'check_out_successful' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : travelState === 'insufficient_balance' ? (
            <AlertCircle className="w-5 h-5 text-amber-400" />
          ) : (
            <Navigation className="w-5 h-5 text-slate-400" />
          )}

          <div>
            <div className="text-xs uppercase tracking-wider font-semibold font-mono">
              Status: {travelState.replace(/_/g, ' ')}
            </div>
            <div className="text-sm font-medium mt-0.5">
              {travelState === 'journey_active' && activeJourney
                ? `Onboard since ${new Date(activeJourney.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} from ${activeJourney.entry_station_name}`
                : successNotice
                ? successNotice
                : errorMsg
                ? errorMsg
                : passenger && passenger.wallet_balance < 10
                ? 'Balance low (below ₹10). Top up wallet to board metro.'
                : 'Ready to travel. Select entry station or touch gate fingerprint sensor.'}
            </div>
          </div>
        </div>

        {errorMsg && (
          <button
            onClick={() => loadData()}
            className="text-xs px-2.5 py-1 rounded bg-slate-900 border border-slate-700 hover:bg-slate-800 text-white cursor-pointer"
          >
            Retry
          </button>
        )}
      </div>

      {/* Main Grid: Profile & Digital Wallet */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Passenger Profile Card */}
        <div className="md:col-span-5 bg-slate-900/80 rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-white font-bold text-lg">
                {passenger ? passenger.name.slice(0, 2).toUpperCase() : 'TP'}
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  {passenger ? passenger.name : 'Loading...'}
                </h3>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  ID: {passenger ? passenger.id : '---'}
                </div>
              </div>
            </div>

            <div
              className={`text-xs px-2 py-0.5 rounded font-medium ${
                passenger?.status === 'active'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-500/15 text-red-400 border border-red-500/30'
              }`}
            >
              {passenger?.status || 'Active'}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span className="flex items-center gap-1.5">
                <Fingerprint className="w-3.5 h-3.5 text-emerald-400" /> Registered Fingerprint:
              </span>
              <span className="font-mono text-white font-semibold">
                AS608 Slot #{passenger?.fingerprint_id ?? 1}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-cyan-400" /> Biometric Identity:
              </span>
              <span className="text-emerald-400 font-medium">Verified &amp; Linked</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Mobile Contact:</span>
              <span className="font-mono text-slate-300">{passenger?.phone || '+91 98450 •••42'}</span>
            </div>
          </div>
        </div>

        {/* Digital Wallet Card */}
        <div className="md:col-span-7 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20 rounded-2xl border border-slate-800 p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>TAPORAA TRANSIT WALLET</span>
              </div>
              <button
                onClick={() => setShowTopupModal(true)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Top Up</span>
              </button>
            </div>

            <div className="mt-4">
              <div className="text-xs text-slate-400">Available Balance</div>
              <div className="text-3xl sm:text-4xl font-bold font-mono text-white tracking-tight tabular-nums mt-0.5">
                ₹{passenger ? passenger.wallet_balance.toFixed(2) : '0.00'}
              </div>
            </div>
          </div>

          {/* Last Fare Deduction Details (PRD Section 5.2 requirement) */}
          <div className="pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-xs">
            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              <div className="text-slate-400 text-[11px]">Last Deduction</div>
              <div className="font-mono font-semibold text-amber-400 mt-0.5 tabular-nums">
                {lastFareTxn ? `-₹${lastFareTxn.amount.toFixed(2)}` : '₹0.00'}
              </div>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              <div className="text-slate-400 text-[11px]">Previous Balance</div>
              <div className="font-mono font-semibold text-slate-300 mt-0.5 tabular-nums">
                {lastFareTxn ? `₹${lastFareTxn.previous_balance.toFixed(2)}` : '₹500.00'}
              </div>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              <div className="text-slate-400 text-[11px]">Current Balance</div>
              <div className="font-mono font-semibold text-emerald-400 mt-0.5 tabular-nums">
                {lastFareTxn ? `₹${lastFareTxn.updated_balance.toFixed(2)}` : `₹${passenger?.wallet_balance.toFixed(2) ?? '485.00'}`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Journey Card or Check-in Action */}
      {activeJourney ? (
        <div className="bg-cyan-950/20 rounded-2xl border border-cyan-500/30 p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-xs font-semibold text-cyan-300 uppercase tracking-wider font-mono">
                Active Journey In Progress
              </span>
            </div>
            <span className="text-xs font-mono text-cyan-400">{activeJourney.journey_code}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-slate-400">Boarding Station (Entry)</div>
              <div className="text-base font-semibold text-white flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>{activeJourney.entry_station_name}</span>
              </div>
              <div className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{new Date(activeJourney.entry_time).toLocaleTimeString()}</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-slate-400">Current Status</div>
              <div className="text-sm font-medium text-cyan-300">Transit in transit / En route</div>
              <div className="text-xs text-slate-400 mt-1">
                Gate terminal: {activeJourney.device_entry_id || 'ESP32-GATE-MAJ-01'}
              </div>
            </div>
          </div>

          {/* Interactive Check-Out at Exit Station */}
          <div className="pt-4 border-t border-cyan-500/20 bg-slate-950/50 -mx-6 -mb-6 p-6 rounded-b-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-white">Alight &amp; Complete Journey (Exit Gate)</h4>
                <p className="text-xs text-slate-400">Select exit station or scan finger at physical turnstile terminal</p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={selectedExitStation}
                  onChange={(e) => setSelectedExitStation(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleCheckOut}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  <span>Check Out &amp; Deduct Fare</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Ready to travel / Check-In Section */
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                Ready to Travel · Check-In at Station
              </h3>
            </div>
            <span className="text-xs text-slate-400">Minimum balance: ₹10.00</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-8 space-y-1.5">
              <label className="text-xs text-slate-400">Select Boarding Metro Station</label>
              <select
                value={selectedEntryStation}
                onChange={(e) => setSelectedEntryStation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code} · {s.line})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4 flex flex-col justify-end">
              <button
                onClick={handleCheckIn}
                disabled={actionLoading || (passenger ? passenger.wallet_balance < 10 : false)}
                className="w-full py-2.5 px-4 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold text-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                <span>Check In at Gate</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>Have the ESP32 hardware terminal? You can also tap your physical AS608 sensor directly.</span>
            </div>
            {onScanRedirect && (
              <button
                onClick={onScanRedirect}
                className="text-emerald-400 hover:text-emerald-300 font-medium whitespace-nowrap cursor-pointer flex items-center gap-1"
              >
                Open Terminal ➔
              </button>
            )}
          </div>
        </div>
      )}

      {/* Journey History Section */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Train className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Journey History</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">{journeys.length} Records</span>
        </div>

        {journeys.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            No completed journeys recorded yet. Check in to begin your first trip.
          </div>
        ) : (
          <div className="space-y-3">
            {journeys.map((j) => (
              <div
                key={j.id}
                className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                    <span>{j.journey_code}</span>
                    <span>·</span>
                    <span
                      className={
                        j.status === 'COMPLETED'
                          ? 'text-emerald-400'
                          : j.status === 'IN_PROGRESS'
                          ? 'text-cyan-400'
                          : 'text-slate-400'
                      }
                    >
                      {j.status}
                    </span>
                  </div>

                  <div className="text-sm font-medium text-white flex items-center gap-2">
                    <span>{j.entry_station_name.split(' (')[0]}</span>
                    <span className="text-slate-500">➔</span>
                    <span>{j.exit_station_name ? j.exit_station_name.split(' (')[0] : 'In Progress...'}</span>
                  </div>

                  <div className="text-xs text-slate-500 font-mono">
                    Boarded: {new Date(j.entry_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {j.exit_time && ` · Exited: ${new Date(j.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                </div>

                <div className="text-right sm:border-l sm:border-slate-800 sm:pl-5">
                  <div className="text-xs text-slate-400">Fare Paid</div>
                  <div className="text-base font-bold font-mono text-emerald-400 tabular-nums">
                    {j.fare !== null && j.fare !== undefined ? `₹${j.fare.toFixed(2)}` : 'Pending'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction History Section */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Wallet Ledger Transactions</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">{transactions.length} Transactions</span>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">
            No wallet transactions recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {transactions.map((tx) => (
              <div key={tx.id} className="py-3 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <div className="font-medium text-white flex items-center gap-2">
                    <span>{tx.description}</span>
                    <span className="font-mono text-[10px] text-slate-500">{tx.transaction_id}</span>
                  </div>
                  <div className="text-slate-400 text-[11px] font-mono">
                    {new Date(tx.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    <span className="text-slate-600"> · </span>
                    Balance: ₹{tx.previous_balance.toFixed(2)} ➔ ₹{tx.updated_balance.toFixed(2)}
                  </div>
                </div>

                <div
                  className={`font-mono font-semibold text-sm tabular-nums ${
                    tx.type === 'FARE_DEDUCTION' ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {tx.type === 'FARE_DEDUCTION' ? `-₹${tx.amount.toFixed(2)}` : `+₹${tx.amount.toFixed(2)}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top-Up Modal */}
      {showTopupModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>Recharge Metro Wallet</span>
              </h3>
              <button
                onClick={() => setShowTopupModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs text-slate-400">Select or Enter Amount (₹)</label>
              <div className="grid grid-cols-3 gap-2">
                {['50', '100', '200'].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setTopupAmount(amt)}
                    className={`py-2 rounded-lg font-mono text-xs font-semibold border transition-colors cursor-pointer ${
                      topupAmount === amt
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>

              <input
                type="number"
                min="10"
                max="5000"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                placeholder="Enter custom amount"
              />
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                onClick={() => setShowTopupModal(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleTopup}
                disabled={actionLoading}
                className="px-5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : `Add ₹${topupAmount}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
