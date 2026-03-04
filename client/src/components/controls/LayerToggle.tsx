import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { LayerType } from '../../store/useAppStore';

const LayerToggle: React.FC = () => {
    const { activeLayers, toggleLayer } = useAppStore();

    const layers: LayerType[] = ['Transit', 'Security', 'Operatives', 'Environment'];

    return (
        <div className="glass rounded-full px-6 py-3 flex items-center gap-6 shadow-2xl border border-white/10 bg-black/40 backdrop-blur-md">
            {layers.map((layer) => {
                const isActive = activeLayers.has(layer);
                return (
                    <button
                        key={layer}
                        onClick={() => toggleLayer(layer)}
                        className={`text-xs font-mono uppercase tracking-[0.2em] transition-all duration-300 cursor-pointer whitespace-nowrap px-3 py-1 rounded-md ${isActive
                            ? 'text-blue-400 font-bold drop-shadow-[0_0_8px_rgba(59,130,246,0.5)] bg-blue-500/10 border border-blue-500/20'
                            : 'text-white/30 hover:text-white/60 border border-transparent'
                            }`}
                    >
                        {layer}
                    </button>
                );
            })}
        </div>
    );
};

export default LayerToggle;
