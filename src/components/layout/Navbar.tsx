import React from 'react';
import { Fingerprint, Smartphone, Cpu, ShieldCheck, MapPin } from 'lucide-react';

export type ActiveTab = 'landing' | 'passenger' | 'terminal' | 'admin' | 'network';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab }) => {
  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark (Single element) */}
        <button
          onClick={() => onSelectTab('landing')}
          className="text-left group flex items-center gap-2.5 text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/25 transition-colors">
            <Fingerprint className="w-4 h-4" />
          </div>
          <span className="tracking-tight text-white font-semibold">Taporaa</span>
        </button>

        {/* Zone 2: 4-5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          <button
            onClick={() => onSelectTab('landing')}
            className={`whitespace-nowrap shrink-0 cursor-pointer transition-colors py-1 ${
              activeTab === 'landing' ? 'text-emerald-400 border-b-2 border-emerald-400 font-semibold' : 'hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => onSelectTab('passenger')}
            className={`whitespace-nowrap shrink-0 cursor-pointer transition-colors py-1 flex items-center gap-1.5 ${
              activeTab === 'passenger' ? 'text-emerald-400 border-b-2 border-emerald-400 font-semibold' : 'hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Passenger App
          </button>
          <button
            onClick={() => onSelectTab('terminal')}
            className={`whitespace-nowrap shrink-0 cursor-pointer transition-colors py-1 flex items-center gap-1.5 ${
              activeTab === 'terminal' ? 'text-emerald-400 border-b-2 border-emerald-400 font-semibold' : 'hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            ESP32 Terminal
          </button>
          <button
            onClick={() => onSelectTab('admin')}
            className={`whitespace-nowrap shrink-0 cursor-pointer transition-colors py-1 flex items-center gap-1.5 ${
              activeTab === 'admin' ? 'text-emerald-400 border-b-2 border-emerald-400 font-semibold' : 'hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Transit Admin
          </button>
          <button
            onClick={() => onSelectTab('network')}
            className={`whitespace-nowrap shrink-0 cursor-pointer transition-colors py-1 flex items-center gap-1.5 ${
              activeTab === 'network' ? 'text-emerald-400 border-b-2 border-emerald-400 font-semibold' : 'hover:text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Metro Network
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onSelectTab(activeTab === 'passenger' ? 'terminal' : 'passenger')}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-sm active:scale-95"
          >
            {activeTab === 'passenger' ? 'Open Gate Simulator' : 'Open Passenger App'}
          </button>
        </div>
      </div>

      {/* Mobile sub-navigation bar */}
      <div className="md:hidden flex items-center justify-around px-2 py-2 border-t border-slate-800 bg-slate-950/95 overflow-x-auto text-xs">
        <button
          onClick={() => onSelectTab('landing')}
          className={`px-2.5 py-1.5 rounded-md whitespace-nowrap ${activeTab === 'landing' ? 'bg-slate-800 text-emerald-400 font-medium' : 'text-slate-400'}`}
        >
          Overview
        </button>
        <button
          onClick={() => onSelectTab('passenger')}
          className={`px-2.5 py-1.5 rounded-md whitespace-nowrap ${activeTab === 'passenger' ? 'bg-slate-800 text-emerald-400 font-medium' : 'text-slate-400'}`}
        >
          Passenger
        </button>
        <button
          onClick={() => onSelectTab('terminal')}
          className={`px-2.5 py-1.5 rounded-md whitespace-nowrap ${activeTab === 'terminal' ? 'bg-slate-800 text-emerald-400 font-medium' : 'text-slate-400'}`}
        >
          ESP32 Terminal
        </button>
        <button
          onClick={() => onSelectTab('admin')}
          className={`px-2.5 py-1.5 rounded-md whitespace-nowrap ${activeTab === 'admin' ? 'bg-slate-800 text-emerald-400 font-medium' : 'text-slate-400'}`}
        >
          Admin
        </button>
        <button
          onClick={() => onSelectTab('network')}
          className={`px-2.5 py-1.5 rounded-md whitespace-nowrap ${activeTab === 'network' ? 'bg-slate-800 text-emerald-400 font-medium' : 'text-slate-400'}`}
        >
          Network
        </button>
      </div>
    </header>
  );
};
