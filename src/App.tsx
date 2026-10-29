import React, { useState, useEffect } from 'react';
import { Navbar, type ActiveTab } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { LandingPage } from './pages/LandingPage';
import { PassengerDashboard } from './pages/PassengerDashboard';
import { TerminalSimulator } from './pages/TerminalSimulator';
import { AdminDashboard } from './pages/AdminDashboard';
import { NetworkPage } from './pages/NetworkPage';
import { api } from './services/api';
import type { Station, FareRule } from './types/index';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('landing');
  const [stations, setStations] = useState<Station[]>([]);
  const [fareRules, setFareRules] = useState<FareRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function init() {
      try {
        const data = await api.getStations();
        setStations(data.stations);
        setFareRules(data.fare_rules);
      } catch (err) {
        console.error('Failed to load initial stations:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      <Navbar activeTab={activeTab} onSelectTab={setActiveTab} />

      <main className="flex-1">
        {loading ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-mono text-slate-400">Loading Taporaa Transit Network...</span>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'landing' && (
              <LandingPage stations={stations} onSelectTab={setActiveTab} />
            )}
            {activeTab === 'passenger' && (
              <PassengerDashboard
                stations={stations}
                onScanRedirect={() => setActiveTab('terminal')}
              />
            )}
            {activeTab === 'terminal' && (
              <TerminalSimulator
                stations={stations}
                onScanCompleted={() => {
                  // Optional: user can check passenger view
                }}
              />
            )}
            {activeTab === 'admin' && (
              <AdminDashboard stations={stations} fareRules={fareRules} />
            )}
            {activeTab === 'network' && (
              <NetworkPage
                stations={stations}
                fareRules={fareRules}
                onOpenPassengerApp={() => setActiveTab('passenger')}
              />
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
