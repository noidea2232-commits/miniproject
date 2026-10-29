import React from 'react';
import { Fingerprint, Shield, Cpu, Database } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-950 border-t border-slate-900 text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-base">
              <div className="w-6 h-6 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Fingerprint className="w-3.5 h-3.5" />
              </div>
              <span>Taporaa</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Move Smarter. Travel Seamlessly. Biometric contactless ticketing, digital transit wallet, and automated route fare calculation.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">Core Modules</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-center gap-1.5"><Fingerprint className="w-3 h-3 text-emerald-400" /> Biometric Passenger Lookup</li>
              <li className="flex items-center gap-1.5"><Cpu className="w-3 h-3 text-cyan-400" /> ESP32 &amp; AS608 Hardware Terminal</li>
              <li className="flex items-center gap-1.5"><Database className="w-3 h-3 text-indigo-400" /> Supabase Edge Functions &amp; ACID Ledger</li>
              <li className="flex items-center gap-1.5"><Shield className="w-3 h-3 text-amber-400" /> Central Transit Administration</li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">Verified Integration</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><span className="text-slate-200">Terminal:</span> ESP32-WROOM-32 Wi-Fi</li>
              <li><span className="text-slate-200">Optical Sensor:</span> AS608 Biometric Module</li>
              <li><span className="text-slate-200">Baseline Route:</span> Majestic ↔ Indiranagar (₹15)</li>
              <li><span className="text-slate-200">Auth Token:</span> Server-Side x-device-token</li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">Architecture &amp; Security</h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-2">
              Zero biometric templates or service keys stored in browser client bundles. All fare deductions and balance updates are atomic transactions.
            </p>
            <div className="text-xs text-emerald-400 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" /> ISO 24745 Biometric Compliance
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© 2026 Taporaa Smart Mobility Platform. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span>Privacy &amp; Data Security</span>
            <span>Transit API Specs</span>
            <span>Hardware Firmware Guide</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
