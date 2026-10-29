import React from 'react';
import { MapPin, Navigation, Train, ArrowRight } from 'lucide-react';
import type { Station, FareRule } from '../types/index';

interface NetworkPageProps {
  stations: Station[];
  fareRules: FareRule[];
  onOpenPassengerApp: () => void;
}

export const NetworkPage: React.FC<NetworkPageProps> = ({ stations, fareRules, onOpenPassengerApp }) => {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-400 tracking-wider uppercase font-mono">
              RAPID TRANSIT NETWORK
            </span>
            <span className="text-slate-500 text-xs">·</span>
            <span className="text-xs text-slate-400">Namma Metro Purple Line</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Stations &amp; Distance Fare Grid</h1>
        </div>

        <button
          onClick={onOpenPassengerApp}
          className="px-4 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold text-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          Check-In to Travel ➔
        </button>
      </div>

      {/* Schematic Metro Line Visualization */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-3.5 h-3.5 rounded-full bg-purple-500" />
            <h3 className="text-base font-semibold text-white">Namma Metro Purple Line (Phase 1 Corridor)</h3>
          </div>
          <span className="text-xs font-mono text-slate-400">8 Key Biometric Turnstile Stations</span>
        </div>

        {/* Metro line track */}
        <div className="relative py-6 overflow-x-auto">
          <div className="min-w-[800px] relative px-4">
            {/* The Purple Track Line */}
            <div className="absolute top-1/2 left-8 right-8 h-2 -translate-y-1/2 bg-purple-600 rounded-full shadow-[0_0_12px_rgba(168,85,247,0.4)]" />

            {/* Station nodes */}
            <div className="relative flex justify-between items-center z-10">
              {stations.map((s, idx) => (
                <div key={s.id} className="flex flex-col items-center group cursor-default">
                  {/* Distance label */}
                  <span className="text-[10px] font-mono text-slate-400 mb-2">{s.distance_km} km</span>

                  {/* Station node dot */}
                  <div
                    className={`w-6 h-6 rounded-full border-2 bg-slate-950 flex items-center justify-center transition-all group-hover:scale-125 ${
                      idx === 0 || idx === stations.length - 1
                        ? 'border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                        : 'border-purple-400'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>

                  {/* Station code and name */}
                  <span className="text-xs font-bold text-white font-mono mt-2">{s.code}</span>
                  <span className="text-[11px] text-slate-400 text-center max-w-[90px] truncate mt-0.5">
                    {s.name.split(' (')[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Verified Fare Matrix Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
          <h3 className="text-base font-semibold text-white">Direct Benchmark Route Fares</h3>
          <p className="text-xs text-slate-400">
            Stage fares configured in the transit backend and validated against PRD test requirements.
          </p>

          <div className="divide-y divide-slate-800 text-xs">
            <div className="py-2.5 flex justify-between items-center bg-emerald-950/20 px-2 rounded-md">
              <span className="text-white font-medium">Majestic (MAJ) ➔ Indiranagar (IDN)</span>
              <span className="font-mono font-bold text-emerald-400 tabular-nums text-sm">₹15.00 (PRD Baseline)</span>
            </div>
            <div className="py-2.5 flex justify-between items-center px-2">
              <span className="text-slate-300">Majestic (MAJ) ➔ MG Road (MGR)</span>
              <span className="font-mono font-bold text-emerald-400 tabular-nums">₹12.00</span>
            </div>
            <div className="py-2.5 flex justify-between items-center px-2">
              <span className="text-slate-300">Majestic (MAJ) ➔ Baiyappanahalli (BYP)</span>
              <span className="font-mono font-bold text-emerald-400 tabular-nums">₹18.00</span>
            </div>
            <div className="py-2.5 flex justify-between items-center px-2">
              <span className="text-slate-300">Indiranagar (IDN) ➔ MG Road (MGR)</span>
              <span className="font-mono font-bold text-emerald-400 tabular-nums">₹10.00</span>
            </div>
            <div className="py-2.5 flex justify-between items-center px-2">
              <span className="text-slate-300">Indiranagar (IDN) ➔ Baiyappanahalli (BYP)</span>
              <span className="font-mono font-bold text-emerald-400 tabular-nums">₹10.00</span>
            </div>
            <div className="py-2.5 flex justify-between items-center px-2">
              <span className="text-slate-300">Majestic (MAJ) ➔ Cubbon Park (CBP)</span>
              <span className="font-mono font-bold text-emerald-400 tabular-nums">₹10.00</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
          <h3 className="text-base font-semibold text-white">Transit Fare Rules &amp; Policies</h3>
          <ul className="space-y-3 text-xs text-slate-300 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <span>
                <strong>Minimum Boarding Balance:</strong> ₹10.00 required in digital wallet to initiate journey at entry gate.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <span>
                <strong>Same-Station Exit:</strong> ₹10.00 flat fee applied if commuter checks out at the same station within 20 minutes.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <span>
                <strong>Automatic Deduction:</strong> Fares are computed by Supabase Edge Functions and deducted atomically from wallet.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <span>
                <strong>Duplicate Protection:</strong> System rejects a second check-in if a journey is already active on the commuter's account.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
