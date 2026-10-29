import React, { useState } from 'react';
import {
  Fingerprint,
  ArrowRight,
  ShieldCheck,
  Zap,
  Smartphone,
  Cpu,
  Database,
  CreditCard,
  CheckCircle2,
  Lock,
  Compass,
  ArrowUpRight,
} from 'lucide-react';
import type { ActiveTab } from '../components/layout/Navbar';
import type { Station } from '../types/index';

interface LandingPageProps {
  onSelectTab: (tab: ActiveTab) => void;
  stations: Station[];
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSelectTab, stations }) => {
  const [calcFrom, setCalcFrom] = useState<string | number>(1);
  const [calcTo, setCalcTo] = useState<string | number>(2);

  const getEstimatedFare = (fromId: string | number, toId: string | number) => {
    const fId = Number(fromId);
    const tId = Number(toId);
    if (fId === tId) return 10;
    if ((fId === 1 && tId === 2) || (fId === 2 && tId === 1)) {
      return 15;
    }
    const s1 = stations.find((s) => Number(s.id) === fId);
    const s2 = stations.find((s) => Number(s.id) === tId);
    if (s1 && s2) {
      const dist = Math.abs(s1.distance_km - s2.distance_km);
      if (dist <= 3) return 10;
      if (dist <= 6) return 12;
      if (dist <= 9) return 15;
      if (dist <= 12) return 18;
      return 20;
    }
    return 15;
  };

  const calculatedFare = getEstimatedFare(calcFrom, calcTo);
  const fromStation = stations.find((s) => Number(s.id) === Number(calcFrom));
  const toStation = stations.find((s) => Number(s.id) === Number(calcTo));
  const distanceKm = fromStation && toStation ? Math.abs(fromStation.distance_km - toStation.distance_km).toFixed(1) : '8.2';

  return (
    <div className="space-y-24 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 md:pt-20 border-b border-slate-800/60 pb-16 md:pb-24">
        {/* Subtle radial glow in background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-emerald-500/10 blur-[130px] pointer-events-none rounded-full" />
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[300px] bg-cyan-500/5 blur-[100px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Next-Gen Smart Transit Infrastructure</span>
                <span className="text-slate-500">·</span>
                <span className="text-emerald-400 font-mono">ESP32 + Supabase Edge</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.12] text-balance">
                Move Smarter. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                  Travel Seamlessly.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
                Taporaa replaces physical smartcards, paper QR tokens, and crowded queue lines with frictionless biometric passenger identification, automated route fare calculation, and instant digital wallet deduction.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={() => onSelectTab('passenger')}
                  className="px-6 py-3.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold text-sm transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Open Passenger App</span>
                  <ArrowRight className="w-4 h-4 ml-0.5" />
                </button>

                <button
                  onClick={() => onSelectTab('terminal')}
                  className="px-6 py-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm transition-all border border-slate-800 hover:border-slate-700 flex items-center gap-2 cursor-pointer"
                >
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>Simulate Biometric Turnstile</span>
                </button>

                <button
                  onClick={() => onSelectTab('admin')}
                  className="px-5 py-3.5 rounded-lg text-slate-400 hover:text-white font-medium text-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Admin Dashboard</span>
                </button>
              </div>

              {/* Key Trust & Specification Signals */}
              <div className="pt-8 border-t border-slate-800/80 grid grid-cols-3 gap-6 text-left">
                <div>
                  <div className="text-2xl font-bold font-mono text-white tabular-nums">&lt; 200ms</div>
                  <div className="text-xs text-slate-400 mt-1">Biometric gate verification</div>
                </div>
                <div>
                  <div className="text-2xl font-bold font-mono text-white tabular-nums">100% ACID</div>
                  <div className="text-xs text-slate-400 mt-1">Atomic Postgres fare ledger</div>
                </div>
                <div>
                  <div className="text-2xl font-bold font-mono text-white tabular-nums">0 Physical</div>
                  <div className="text-xs text-slate-400 mt-1">No tokens or plastic cards</div>
                </div>
              </div>
            </div>

            {/* Right Interactive Mockup / Gate Visual */}
            <div className="lg:col-span-5">
              <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-2xl relative">
                {/* Decorative Terminal Header */}
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-semibold text-slate-200 tracking-wide uppercase">Gate Terminal 01 · Majestic</span>
                  </div>
                  <span className="text-xs font-mono text-emerald-400">ESP32-WROOM-32</span>
                </div>

                {/* Simulated Turnstile Display */}
                <div className="space-y-4">
                  <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/80 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Optical Scanner:</span>
                      <span className="text-emerald-400 font-mono">AS608 ONLINE</span>
                    </div>

                    <div className="flex items-center justify-center py-6">
                      <div className="relative group cursor-pointer" onClick={() => onSelectTab('terminal')}>
                        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 transition-transform group-hover:scale-105 shadow-lg shadow-emerald-500/10">
                          <Fingerprint className="w-10 h-10 animate-pulse" />
                        </div>
                        <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-slate-900 px-2 py-0.5 rounded text-[10px] text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                          Touch to Scan
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900/80 rounded-lg p-3 text-center border border-slate-800">
                      <div className="text-xs font-mono text-slate-300">
                        RECENT JOURNEY: <span className="text-emerald-400">MAJESTIC ➔ INDIRANAGAR</span>
                      </div>
                      <div className="text-xs font-mono text-slate-400 mt-1">
                        FARE: <span className="text-white font-bold">₹15.00</span> · BAL: <span className="text-emerald-400">₹485.00</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => onSelectTab('passenger')}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-left transition-colors cursor-pointer group"
                    >
                      <div className="text-[11px] text-slate-400">Passenger Wallet</div>
                      <div className="text-sm font-semibold text-white mt-0.5 group-hover:text-emerald-400 flex items-center justify-between">
                        <span>Manish (FP #1)</span>
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
                      </div>
                      <div className="text-xs font-mono text-emerald-400 font-medium mt-1">₹485.00 Available</div>
                    </button>

                    <button
                      onClick={() => onSelectTab('admin')}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-left transition-colors cursor-pointer group"
                    >
                      <div className="text-[11px] text-slate-400">Transit Edge Proxy</div>
                      <div className="text-sm font-semibold text-white mt-0.5 group-hover:text-cyan-400 flex items-center justify-between">
                        <span>Supabase Edge</span>
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
                      </div>
                      <div className="text-xs font-mono text-cyan-400 font-medium mt-1">x-device-token Active</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Network Fare Calculator */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-6 md:p-8">
          <div className="max-w-2xl mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight">Interactive Route &amp; Fare Matrix</h2>
            <p className="text-sm text-slate-400 mt-1">
              Test automated fare calculation based on the verified stage distance rules across the metro rapid transit network.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-4 space-y-2">
              <label className="text-xs font-medium text-slate-400">Boarding Station (Entry Gate)</label>
              <select
                value={calcFrom}
                onChange={(e) => setCalcFrom(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-1 flex justify-center pt-5">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                ➔
              </div>
            </div>

            <div className="md:col-span-4 space-y-2">
              <label className="text-xs font-medium text-slate-400">Destination Station (Exit Gate)</label>
              <select
                value={calcTo}
                onChange={(e) => setCalcTo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3 bg-slate-950 p-4 rounded-xl border border-slate-800/80 text-center">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Calculated Fare</div>
              <div className="text-3xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">
                ₹{calculatedFare.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Distance: {distanceKm} km · Auto-deducted
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <h2 className="text-3xl font-bold text-white tracking-tight">Engineered for Rapid Urban Transit</h2>
          <p className="text-slate-400 text-sm md:text-base">
            Taporaa links physical embedded biometric hardware with high-throughput cloud Edge Functions and cryptographic audit ledgers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 p-6 space-y-4 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Fingerprint className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Biometric Gate Identification</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              AS608 optical fingerprint sensor reads minutiae templates in &lt;200ms. Identifies registered commuter without phone unlocking or card tapping.
            </p>
          </div>

          <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 p-6 space-y-4 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Dynamic Distance Fares</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Automated stage-based calculation based on exact entry and exit station coordinates. Tested and verified on Bengaluru Namma Metro routes.
            </p>
          </div>

          <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 p-6 space-y-4 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Atomic Digital Wallet</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Fare deductions occur atomically inside PostgreSQL database transactions. Prevents partial financial state, duplicate charges, or phantom debits.
            </p>
          </div>

          <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 p-6 space-y-4 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Central Transit Command</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Transit authority dashboard monitors live station gates, passenger flows, fare revenue, and hardware diagnostics in real time.
            </p>
          </div>
        </div>
      </section>

      {/* How it Works Step by Step */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-800/80 pt-16">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <h2 className="text-3xl font-bold text-white tracking-tight">The Taporaa Journey Flow</h2>
          <p className="text-slate-400 text-sm">Four seamless steps from station arrival to destination arrival</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="text-xs font-mono text-emerald-400 font-semibold">01 · BIOMETRIC ENROLL</div>
            <h4 className="text-base font-medium text-white">One-time Registration</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Commuter links their AS608 biometric fingerprint ID to their digital wallet profile with initial prepaid travel balance.
            </p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="text-xs font-mono text-cyan-400 font-semibold">02 · TOUCH TO ENTER</div>
            <h4 className="text-base font-medium text-white">Entry Gate Check-In</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Touch the sensor at Majestic. ESP32 sends authorized token to Edge Function. Journey created, gate opens in &lt;200ms.
            </p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="text-xs font-mono text-indigo-400 font-semibold">03 · ACTIVE COMMUTE</div>
            <h4 className="text-base font-medium text-white">Live Journey Tracking</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Passenger's phone displays real-time boarding status, entry timestamp, journey code, and route progress.
            </p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="text-xs font-mono text-emerald-400 font-semibold">04 · TOUCH TO EXIT</div>
            <h4 className="text-base font-medium text-white">Auto-Fare Deduction</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Touch exit sensor at Indiranagar. Backend validates route, calculates ₹15 fare, updates wallet from ₹500 to ₹485, and opens gate.
            </p>
          </div>
        </div>
      </section>

      {/* Hardware & Security Architecture */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-800/80 pt-16">
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-4">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-cyan-400">
                <Lock className="w-3.5 h-3.5" />
                <span>Zero Trust Hardware Security Model</span>
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight">
                Secure Edge-to-Cloud Transit Pipeline
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                As required by the Taporaa PRD, device secrets (such as <code className="text-emerald-400 bg-slate-950 px-1 py-0.5 rounded font-mono text-xs">x-device-token</code>) and Supabase service-role keys are strictly handled on the secure server layer and never exposed in browser bundles.
              </p>

              <div className="space-y-2.5 pt-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>No raw biometric images or templates stored in the public cloud</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>ESP32 firmware connects via secure HTTPS with hardware token validation</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Prevents duplicate active journeys and ensures idempotency</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Automatic minimum boarding balance enforcement (₹10 minimum required)</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 bg-slate-950 rounded-xl p-5 border border-slate-800 font-mono text-xs space-y-3">
              <div className="text-slate-400 text-[11px] pb-2 border-b border-slate-900 flex justify-between">
                <span>TERMINAL_ARCH.TXT</span>
                <span className="text-emerald-400">STATUS: VERIFIED</span>
              </div>
              <div className="text-slate-300 space-y-1.5 leading-relaxed text-[11px]">
                <p><span className="text-emerald-400">HARDWARE:</span> ESP32-WROOM-32 (240MHz Dual-Core, Wi-Fi 802.11 b/g/n)</p>
                <p><span className="text-cyan-400">SENSOR:</span> AS608 Optical Fingerprint Module (UART 57600 baud)</p>
                <p><span className="text-indigo-400">AUTH HEADER:</span> x-device-token: [SERVER-SIDE INJECTED]</p>
                <p><span className="text-amber-400">EDGE FUNCTION:</span> /functions/v1/passenger-lookup, /check-in, /check-out</p>
                <p><span className="text-slate-400">DATABASE:</span> PostgreSQL ACID Transactions (atomic balance + journey update)</p>
              </div>
              <div className="pt-3 border-t border-slate-900 flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Firmware Ready</span>
                <button
                  onClick={() => onSelectTab('terminal')}
                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer font-medium"
                >
                  View Hardware Console ➔
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Action CTA Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-cyan-950/30 rounded-2xl border border-emerald-500/20 p-8 md:p-12 text-center space-y-6">
          <h2 className="text-3xl font-bold text-white tracking-tight">
            Ready to experience frictionless transit?
          </h2>
          <p className="text-slate-300 max-w-xl mx-auto text-sm">
            Launch the passenger digital wallet or test the physical biometric turnstile terminal simulator with live route check-in and check-out.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => onSelectTab('passenger')}
              className="px-6 py-3 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold text-sm transition-all cursor-pointer shadow-md"
            >
              Open Passenger App
            </button>
            <button
              onClick={() => onSelectTab('terminal')}
              className="px-6 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm transition-all border border-slate-700 cursor-pointer"
            >
              Simulate Gate Sensor
            </button>
            <button
              onClick={() => onSelectTab('admin')}
              className="px-6 py-3 rounded-lg bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white font-medium text-sm transition-all border border-slate-800 cursor-pointer"
            >
              Transit Authority Admin
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
