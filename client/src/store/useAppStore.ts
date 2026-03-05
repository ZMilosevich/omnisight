import { create } from 'zustand';

export type LayerType = 'Transit' | 'Security' | 'Environment' | 'Operatives';

interface AppState {
    activeLayers: Set<LayerType>;
    selectedEntityId: string | null;
    restrictedZoneCoords: number[][] | null;
    isIntelPanelOpen: boolean;
    toggleLayer: (layer: LayerType) => void;
    setSelectedEntityId: (id: string | null) => void;
    setRestrictedZoneCoords: (coords: number[][]) => void;
    setIntelPanelOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
    activeLayers: new Set(['Transit', 'Security', 'Operatives']), // Environment off by default
    selectedEntityId: null,
    restrictedZoneCoords: null,
    isIntelPanelOpen: false,

    toggleLayer: (layer) => set((state) => {
        const next = new Set(state.activeLayers);
        if (next.has(layer)) {
            next.delete(layer);
        } else {
            next.add(layer);
        }
        return { activeLayers: next };
    }),

    setSelectedEntityId: (id) => set({ selectedEntityId: id }),
    setRestrictedZoneCoords: (coords) => set({ restrictedZoneCoords: coords }),
    setIntelPanelOpen: (open) => set({ isIntelPanelOpen: open }),
}));
