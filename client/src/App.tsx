import { useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import BaseMap from './components/map/BaseMap';
import IntelPanel from './components/panel/IntelPanel';
import AIOverview from './components/panel/AIOverview';
import LayerToggle from './components/controls/LayerToggle';
import Login from './components/auth/Login';
import { useAppStore } from './store/useAppStore';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { isConnected, entities, socket } = useWebSocket();
  const restrictedZoneCoords = useAppStore(state => state.restrictedZoneCoords);
  const isIntelPanelOpen = useAppStore(state => state.isIntelPanelOpen);

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  const hasData = restrictedZoneCoords && restrictedZoneCoords.length > 0;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0a0a] text-[#ededed]">
      {/* Map Content - Filling the whole background */}
      <main className="absolute inset-0">
        <BaseMap entities={entities} socket={socket} />
      </main>

      {/* Floating Controls - Centered over the map area */}
      <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-9999 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${hasData ? 'translate-y-0' : 'translate-y-[200px]'}`}>
        <LayerToggle />
      </div>

      {/* AOI Prompt Notification / Clear Button - Top Center */}
      <div className={`absolute top-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-700 ease-in-out ${hasData ? 'translate-y-0 opacity-100' : 'translate-y-0 opacity-100'}`}>
        {!hasData ? (
          <div className="bg-black/60 backdrop-blur-md border border-white/20 px-6 py-3 rounded-full flex items-center gap-3 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 animate-pulse">
              <polygon points="12 2 2 22 12 18 22 22 12 2"></polygon>
            </svg>
            <span className="text-xs font-mono font-bold tracking-[0.2em] text-white">DRAW AREA OF INTEREST TO INITIALIZE FEED</span>
          </div>
        ) : (
          <button
            onClick={() => socket?.emit('update-restricted-zone', [])}
            className="bg-red-500/20 hover:bg-red-500/40 backdrop-blur-md border border-red-500/50 px-6 py-2.5 rounded-full flex items-center gap-3 shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all cursor-pointer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
              <path d="M18 6L6 18M6 6l12 12"></path>
            </svg>
            <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-red-100 pointer-events-none">CLEAR ACTIVE ZONE</span>
          </button>
        )}
      </div>

      {/* App Branding & Connection Status */}
      <div className="absolute top-8 left-8 z-50 flex items-center gap-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-[0em] text-white drop-shadow-2xl">
            OMNISIGHT
          </h1>
        </div>

        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[10px] font-mono uppercase tracking-widest text-white/70">
            {isConnected ? 'Link Active' : 'Link Offline'}
          </span>
        </div>
      </div>

      {/* AI Intelligence Left Panel */}
      <aside className={`absolute top-24 left-8 bottom-[180px] w-[340px] z-999 border border-white/10 bg-[#0a0a0a]/80 backdrop-blur-xl rounded-[32px] overflow-hidden shadow-2xl transition-transform duration-700 delay-100 ease-[cubic-bezier(0.16,1,0.3,1)] ${hasData ? 'translate-x-0' : 'translate-x-[-120%]'}`}>
        <AIOverview entities={entities} />
      </aside>

      {/* Intelligence Feed Right Panel */}
      <aside className={`absolute top-8 right-8 bottom-8 w-[380px] z-999 border border-white/10 bg-[#0a0a0a]/80 backdrop-blur-xl rounded-[32px] overflow-hidden shadow-2xl transition-transform duration-700 delay-150 ease-[cubic-bezier(0.16,1,0.3,1)] ${(hasData && isIntelPanelOpen) ? 'translate-x-0' : 'translate-x-[120%]'}`}>
        <IntelPanel entities={entities} />
      </aside>
    </div>
  );
}

export default App;
