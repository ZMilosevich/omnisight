import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import useSupercluster from 'use-supercluster';
import type { Entity } from '../../hooks/useWebSocket';
import { useAppStore } from '../../store/useAppStore';

// Replace with your actual token in .env
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface BaseMapProps {
    entities: Record<string, Entity>;
    socket?: any;
}

const BaseMap: React.FC<BaseMapProps> = ({ entities, socket }) => {
    const { activeLayers, selectedEntityId, setSelectedEntityId, restrictedZoneCoords } = useAppStore();
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const draw = useRef<MapboxDraw | null>(null);
    const markers = useRef<Record<string, mapboxgl.Marker>>({});
    const activePopup = useRef<mapboxgl.Popup | null>(null);
    const socketRef = useRef(socket);
    const updateTimeout = useRef<any>(null);
    const debouncedUpdateRef = useRef<any>(null);

    const debouncedUpdate = React.useCallback((coords: number[][]) => {
        if (updateTimeout.current) clearTimeout(updateTimeout.current);
        updateTimeout.current = setTimeout(() => {
            console.log(`Emitting update-restricted-zone with ${coords.length} points`);
            socketRef.current?.emit('update-restricted-zone', coords);
        }, 100);
    }, []);

    useEffect(() => {
        debouncedUpdateRef.current = debouncedUpdate;
    }, [debouncedUpdate]);

    const [bounds, setBounds] = React.useState<[number, number, number, number] | null>(null);
    const [zoom, setZoom] = React.useState(9);
    const [zoomError, setZoomError] = React.useState<string | null>(null);

    useEffect(() => {
        socketRef.current = socket;
        if (socket) {
            // Force reset the active zone on mount so the user always 
            // starts with the 'DRAW AREA' prompt.
            console.log('Sending reset to restricted zone.');
            socket.emit('update-restricted-zone', []);
        }
    }, [socket]);

    useEffect(() => {
        if (map.current || !mapContainer.current) return;

        try {
            map.current = new mapboxgl.Map({
                container: mapContainer.current,
                style: 'mapbox://styles/mapbox/dark-v11',
                center: [-0.1278, 51.5074], // London
                zoom: 9,
                pitch: 45,
                attributionControl: false,
            });

            map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-left');

            // MapboxDraw might be exported with .default in some Vite setups
            const MapboxDrawConstructor = (MapboxDraw as any).default || MapboxDraw;

            draw.current = new MapboxDrawConstructor({
                displayControlsDefault: false,
                controls: {
                    polygon: true,
                    trash: true
                },
                defaultMode: 'draw_polygon'
            });
            map.current.addControl(draw.current as unknown as mapboxgl.IControl, 'bottom-left');

            map.current.on('draw.create', (e: any) => {
                if (!draw.current || !map.current) return;

                const currentZoom = map.current.getZoom();
                if (currentZoom < 11) {
                    setZoomError('COMMAND: ZOOM IN TO DEFINE TACTICAL PERIMETER');

                    if (e.features && e.features.length > 0) {
                        draw.current.delete(e.features.map((f: any) => f.id));
                    } else {
                        draw.current.deleteAll();
                    }

                    // Re-arm the tool safely after internal state settles
                    setTimeout(() => {
                        try {
                            if (draw.current) draw.current.changeMode('draw_polygon');
                        } catch (err) {
                            console.error('Failed to rearm polygon mode:', err);
                        }
                    }, 300);

                    setTimeout(() => setZoomError(null), 3000);
                    return;
                }

                const data = draw.current.getAll();
                if (data && data.features.length > 0) {
                    const feature = data.features[0];
                    if (feature.geometry.type === 'Polygon') {
                        debouncedUpdateRef.current?.(feature.geometry.coordinates[0]);
                        // Instantly purge it from MapboxDraw to prevent dragging interaction
                        setTimeout(() => {
                            if (draw.current) draw.current.deleteAll();
                        }, 50);
                    }
                }
            });

            map.current.on('moveend', () => {
                const mapInstance = map.current;
                if (!mapInstance) return;
                const bounds = mapInstance.getBounds();
                if (!bounds) return;
                const b = bounds.toArray();
                setBounds([b[0][0], b[0][1], b[1][0], b[1][1]]);
                setZoom(mapInstance.getZoom());
            });

            map.current.on('load', () => {
                // Add a native locked restricted zone layer
                map.current?.addSource('restricted-zone-source', {
                    type: 'geojson',
                    data: {
                        type: 'FeatureCollection',
                        features: []
                    }
                });

                map.current?.addLayer({
                    id: 'restricted-zone-fill',
                    type: 'fill',
                    source: 'restricted-zone-source',
                    paint: {
                        'fill-color': '#10b981',
                        'fill-opacity': 0.1
                    }
                });

                map.current?.addLayer({
                    id: 'restricted-zone-line',
                    type: 'line',
                    source: 'restricted-zone-source',
                    paint: {
                        'line-color': '#10b981',
                        'line-width': 2,
                        'line-dasharray': [2, 2]
                    }
                });

                // Add a simulated weather layer (Semi-transparent radar pulse)
                map.current?.addSource('weather-radar', {
                    type: 'geojson',
                    data: {
                        type: 'FeatureCollection',
                        features: [
                            {
                                type: 'Feature',
                                properties: { intensity: 0.5 },
                                geometry: {
                                    type: 'Point',
                                    coordinates: [-0.1278, 51.5074]
                                }
                            }
                        ]
                    }
                });

                map.current?.addLayer({
                    id: 'weather-layer',
                    type: 'circle',
                    source: 'weather-radar',
                    layout: {
                        'visibility': activeLayers.has('Environment') ? 'visible' : 'none'
                    },
                    paint: {
                        'circle-radius': 300,
                        'circle-color': '#3b82f6',
                        'circle-opacity': 0.4,
                        'circle-blur': 2
                    }
                });

                // Add Official Mapbox Traffic Layer
                map.current?.addSource('mapbox-traffic', {
                    type: 'vector',
                    url: 'mapbox://mapbox.mapbox-traffic-v1'
                });

                map.current?.addLayer({
                    id: 'traffic-layer',
                    type: 'line',
                    source: 'mapbox-traffic',
                    'source-layer': 'traffic',
                    layout: {
                        'visibility': activeLayers.has('Environment') ? 'visible' : 'none',
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    paint: {
                        'line-width': [
                            'interpolate', ['linear'], ['zoom'],
                            12, 1,
                            16, 4
                        ],
                        'line-color': [
                            'case',
                            ['==', ['get', 'congestion'], 'low'], '#22c55e',
                            ['==', ['get', 'congestion'], 'moderate'], '#eab308',
                            ['==', ['get', 'congestion'], 'heavy'], '#f97316',
                            ['==', ['get', 'congestion'], 'severe'], '#ef4444',
                            '#22c55e'
                        ],
                        'line-opacity': 0.75
                    }
                }, 'restricted-zone-fill'); // Put traffic under the zone fill for better blending
            });

            // Update bounds on move
            map.current.on('move', () => {
                if (!map.current) return;
                const b = map.current.getBounds();
                if (b) {
                    setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
                    setZoom(map.current.getZoom());
                }
            });

            // Initial bounds
            map.current.once('idle', () => {
                if (!map.current) return;
                const b = map.current.getBounds();
                if (b) {
                    setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
                    setZoom(map.current.getZoom());
                }
            });

        } catch (err) {
            console.error('BaseMap Initialization Error:', err);
        }

        return () => {
            if (activePopup.current) {
                activePopup.current.remove();
            }
            map.current?.remove();
            map.current = null;
        };
    }, []);

    // Reactive layer visibility updates for map sources
    useEffect(() => {
        if (!map.current) return;
        try {
            if (!map.current.isStyleLoaded()) return;

            if (map.current.getLayer('weather-layer')) {
                map.current.setLayoutProperty(
                    'weather-layer',
                    'visibility',
                    activeLayers.has('Environment') ? 'visible' : 'none'
                );
            }
            if (map.current.getLayer('traffic-layer')) {
                map.current.setLayoutProperty(
                    'traffic-layer',
                    'visibility',
                    activeLayers.has('Environment') ? 'visible' : 'none'
                );
            }
        } catch (e) {
        }
    }, [activeLayers]);

    // Sync Native GL Source with Store
    useEffect(() => {
        if (!map.current) return;
        const source = map.current.getSource('restricted-zone-source') as mapboxgl.GeoJSONSource;
        const hasExternalZone = restrictedZoneCoords && restrictedZoneCoords.length >= 3;

        if (source) {
            if (hasExternalZone) {
                source.setData({
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        properties: {},
                        geometry: {
                            type: 'Polygon',
                            coordinates: [restrictedZoneCoords]
                        }
                    }]
                });
            } else {
                source.setData({
                    type: 'FeatureCollection',
                    features: []
                });
            }
        }

        if (draw.current) {
            const internalData = draw.current.getAll();
            if (internalData.features.length > 0) {
                draw.current.deleteAll();
            }

            // Auto-toggle drawing mode
            if (!hasExternalZone) {
                try {
                    draw.current.changeMode('draw_polygon');
                } catch (e) {
                    console.warn('MapboxDraw mode change delayed:', e);
                }
            } else {
                try {
                    draw.current.changeMode('simple_select');
                } catch (e) {
                }
            }
        }
    }, [restrictedZoneCoords]);

    // Sync markers with supercluster
    const isTransitActive = activeLayers.has('Transit');

    const points = React.useMemo(() => {
        return Object.values(entities)
            .filter(e => {
                if (e.type === 'security') return activeLayers.has('Security');
                if (e.type === 'operative') return activeLayers.has('Operatives');
                return isTransitActive;
            })
            .map(entity => ({
                type: 'Feature' as const,
                properties: {
                    cluster: false,
                    entityId: entity.id,
                    entity
                },
                geometry: {
                    type: 'Point' as const,
                    coordinates: [entity.lng, entity.lat]
                }
            }));
    }, [entities, activeLayers, isTransitActive]);

    const { clusters, supercluster } = useSupercluster({
        points,
        bounds: bounds || undefined,
        zoom,
        options: { radius: 75, maxZoom: 20 }
    });

    // Render Markers
    useEffect(() => {
        if (!map.current) return;

        const currentMarkerKeys = new Set<string>();

        clusters.forEach(cluster => {
            const [longitude, latitude] = cluster.geometry.coordinates;
            const properties = cluster.properties as any;
            const isCluster = properties.cluster;
            const pointCount = properties.point_count;
            const entityId = properties.entityId;
            const entity = properties.entity;

            const markerId = isCluster ? `cluster-${cluster.id}` : `entity-${entityId}`;
            currentMarkerKeys.add(markerId);

            let marker = markers.current[markerId];

            if (!marker) {
                const el = document.createElement('div');

                if (isCluster) {
                    el.className = 'w-10 h-10 rounded-full bg-blue-500/80 border-2 border-white/50 text-white font-bold flex items-center justify-center shadow-lg cursor-pointer backdrop-blur-sm transition-transform hover:scale-110';
                    el.style.width = `${Math.max(30, 10 + (pointCount / points.length) * 40)}px`;
                    el.style.height = el.style.width;
                    el.innerText = pointCount.toString();

                    el.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (!supercluster || !map.current) return;
                        const expansionZoom = Math.min(supercluster.getClusterExpansionZoom(cluster.id as number), 20);
                        map.current.flyTo({
                            center: [longitude, latitude],
                            zoom: expansionZoom,
                            speed: 1.2
                        });
                    });
                } else if (entity) {
                    el.className = `p-1 rounded-full border border-white/20 backdrop-blur-md flex items-center justify-center transition-opacity duration-500 cursor-pointer ${entity.type === 'aircraft' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`;

                    el.innerHTML = entity.type === 'aircraft'
                        ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.3c.4-.2.6-.6.5-1.1Z"/></svg>`
                        : entity.type === 'vessel'
                            ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10V6M2 10h20m-2 0a8 8 0 1 1-16 0h16ZM2 10h20m-2 0a8 8 0 1 1-16 0h16Z"/></svg>`
                            : entity.type === 'operative'
                                ? `<div class="w-full h-full rounded-full border-2 border-emerald-500/80 bg-black overflow-hidden shadow-[0_0_12px_rgba(16,185,129,0.4)]"><img src="${entity.avatarUrl}" class="w-full h-full object-cover pointer-events-none" /></div><div class="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-[2.5px] border-slate-900 shadow-[0_0_8px_rgba(16,185,129,0.9)] z-10"></div>`
                                : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

                    if (entity.type === 'operative') {
                        el.className = `w-10 h-10 cursor-pointer z-50 relative flex items-center justify-center hover:z-[60]`;
                    } else if (entity.type === 'security') {
                        el.className = `p-1 rounded-full border border-red-500/50 bg-red-500/20 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)] animate-pulse transition-opacity duration-500 cursor-pointer`;
                    }

                    el.addEventListener('click', (e) => {
                        e.stopPropagation();
                        setSelectedEntityId(entity.id);
                    });
                }

                if (map.current) {
                    marker = new mapboxgl.Marker({ element: el, rotation: entity?.type === 'operative' ? 0 : (entity?.heading || 0) })
                        .setLngLat([longitude, latitude])
                        .addTo(map.current);

                    markers.current[markerId] = marker;
                }
            } else {
                marker.setLngLat([longitude, latitude]);
                if (entity?.heading !== undefined && entity?.type !== 'operative') {
                    marker.setRotation(entity.heading);
                }
            }
        });

        // Cleanup unused markers
        Object.keys(markers.current).forEach((key) => {
            if (!currentMarkerKeys.has(key)) {
                markers.current[key].remove();
                delete markers.current[key];
            }
        });

    }, [clusters, setSelectedEntityId, points, supercluster]);

    // Handle single popup rendering with extended details
    useEffect(() => {
        if (!map.current) return;

        // If no selection, destroy the active popup completely
        if (!selectedEntityId) {
            if (activePopup.current) {
                const popup = activePopup.current;
                activePopup.current = null;
                popup.remove();
            }
            return;
        }

        const entity = entities[selectedEntityId];
        if (!entity) return;

        let nearestAgentText = 'None Available';
        if (entity.type === 'security') {
            let nearestDistance = Infinity;
            Object.values(entities).forEach(e => {
                if (e.type === 'operative') {
                    const dLat = (e.lat - entity.lat) * (Math.PI / 180);
                    const dLon = (e.lng - entity.lng) * (Math.PI / 180);
                    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos(entity.lat * (Math.PI / 180)) * Math.cos(e.lat * (Math.PI / 180)) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
                    const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

                    if (dist < nearestDistance) {
                        nearestDistance = dist;
                        nearestAgentText = `${e.name || e.id} (${dist.toFixed(1)}km)`;
                    }
                }
            });
        }

        const extraDetails = entity.type === 'operative'
            ? `   <div class="mb-3 relative overflow-hidden rounded border border-white/20 bg-black/80 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]" style="height: 140px;">
                      <!-- Simulated Video Feed -->
                      <video src="https://www.w3schools.com/html/mov_bbb.mp4" autoplay loop muted playsinline class="w-full h-full object-cover filter grayscale contrast-125 brightness-75 mix-blend-screen opacity-60"></video>
                      
                      <!-- Scanlines Overlay -->
                      <div class="absolute inset-0 pointer-events-none" style="background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px);"></div>
                      
                      <div class="absolute top-2 left-2 flex items-center gap-1.5 px-1.5 py-0.5 bg-black/80 border border-white/10 rounded text-[9px] font-mono text-white/90 shadow-md backdrop-blur-md">
                          <div class="w-1 h-1 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,1)] animate-pulse"></div>
                          BODYCAM
                      </div>
                      <div class="absolute bottom-2 right-2 flex items-center gap-2">
                         <div class="flex items-center gap-1 bg-black/80 border border-white/10 px-1.5 py-0.5 rounded backdrop-blur-md text-[9px] font-mono text-emerald-400 font-bold">
                             <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                             <span id="popup-bpm">${entity.heartRate} BPM</span>
                         </div>
                      </div>
                      <!-- Audio waveform simulation overlay -->
                      <div class="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-start gap-[2px] px-2 pb-1 opacity-80 backdrop-blur-[1px]">
                          <div class="w-[2px] bg-blue-500 h-2 animate-[pulse_1s_ease-in-out_infinite]"></div>
                          <div class="w-[2px] bg-blue-500 h-4 animate-[pulse_1.2s_ease-in-out_infinite_0.1s]"></div>
                          <div class="w-[2px] bg-blue-500 h-1 animate-[pulse_0.8s_ease-in-out_infinite_0.4s]"></div>
                          <div class="w-[2px] bg-blue-500 h-3 animate-[pulse_1.1s_ease-in-out_infinite_0.2s]"></div>
                          <div class="w-[2px] bg-blue-500 h-5 animate-[pulse_0.9s_ease-in-out_infinite_0.3s]"></div>
                          <div class="w-[2px] bg-blue-500 h-2 animate-[pulse_1s_ease-in-out_infinite_0.1s]"></div>
                          <div class="w-[2px] bg-blue-500 h-1 animate-[pulse_1.5s_ease-in-out_infinite_0.5s]"></div>
                      </div>
                  </div>
                  <div class="space-y-2 mt-4">
                      <div class="flex justify-between items-center text-[10px] font-mono gap-4">
                          <span class="text-white/30 uppercase tracking-tighter whitespace-nowrap">Status:</span>
                          <span id="popup-status" class="text-emerald-400 font-bold text-right tracking-tight">${entity.status}</span>
                      </div>
                      <div class="flex justify-between items-center text-[10px] font-mono gap-4">
                          <span class="text-white/30 uppercase tracking-tighter whitespace-nowrap mt-0.5">Objective:</span>
                          <span id="popup-objective" class="text-white/80 font-bold text-right tracking-tight leading-snug">${entity.missionObjective || 'Awaiting Orders'}</span>
                      </div>
                      <button id="comms-btn" class="w-full mt-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/50 rounded text-[10px] font-mono font-bold text-emerald-400 transition-colors uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer">
                         <span id="comms-text" class="flex items-center justify-center gap-2">
                             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                             INITIATE COMMS
                         </span>
                      </button>
                  </div>`
            : entity.type === 'aircraft'
                ? `   <div class="flex justify-between items-center text-[10px] font-mono mb-1.5">
                      <span class="text-white/30 uppercase tracking-tighter whitespace-nowrap">ICAO24:</span>
                      <span class="text-white font-medium text-right font-mono tracking-widest">${(entity.id || '').replace('plane-', '').toUpperCase()}</span>
                  </div>
                  <div class="flex justify-between items-center text-[10px] font-mono mb-1.5">
                      <span class="text-white/30 uppercase tracking-tighter whitespace-nowrap">Country:</span>
                      <span class="text-white font-medium text-right">${entity.country || 'Unknown'}</span>
                  </div>
                  <div class="flex justify-between items-center text-[10px] font-mono mb-1.5">
                      <span class="text-white/30 uppercase tracking-tighter whitespace-nowrap">Route:</span>
                      <span class="text-white font-medium text-right">${entity.route && entity.route !== 'N/A' ? entity.route : 'Unknown'}</span>
                  </div>
                  <div class="flex justify-between items-center text-[10px] font-mono mb-1.5">
                      <span class="text-white/30 uppercase tracking-tighter">Altitude:</span>
                      <span id="popup-altitude" class="text-white font-medium">${(entity.altitude !== undefined && entity.altitude !== null && entity.altitude > 0) ? `${Math.round(entity.altitude).toLocaleString()} ft` : 'n/a'}</span>
                  </div>
                  <div class="flex justify-between items-center text-[10px] font-mono mb-1.5">
                      <span class="text-white/30 uppercase tracking-tighter">Speed:</span>
                      <span id="popup-speed" class="text-white font-medium">${(entity.speed !== undefined && entity.speed !== null && entity.speed > 0) ? Math.round(entity.speed) + ' kt' : 'n/a'}</span>
                  </div>
                  <div class="flex justify-between items-center text-[10px] font-mono">
                      <span class="text-white/30 uppercase tracking-tighter whitespace-nowrap">Source:</span>
                      <span class="text-blue-400 font-medium text-right font-bold">ADS-B / OpenSky</span>
                  </div>`
                : entity.type === 'vessel'
                    ? `   
                  <div class="mb-3 relative overflow-hidden rounded border border-white/20 shadow-[0_4px_10px_rgba(0,0,0,0.5)] bg-black/50" style="height: 100px;">
                      <img src="${[
                        'https://loremflickr.com/400/200/ship,container,ocean,cargo/all?random=1',
                        'https://loremflickr.com/400/200/ship,vessel,sea,tanker/all?random=2',
                        'https://loremflickr.com/400/200/ship,maritime,harbor/all?random=3',
                        'https://loremflickr.com/400/200/vessel,industrial,port/all?random=4',
                        'https://loremflickr.com/400/200/ship,freight,water/all?random=5'
                    ][(entity.id || '').split('').reduce((a, b) => a + b.charCodeAt(0), 0) % 5]}" class="w-full h-full object-cover filter brightness-75 contrast-110 shadow-inner" onerror="this.src='https://images.unsplash.com/photo-1544216717-3b95221d6f0b?fit=crop&w=400&h=200'" />
                      <div class="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 text-[8px] font-mono text-white/50 border border-white/10 rounded">AIS DB FEED</div>
                  </div>
                  <div class="flex justify-between items-center text-[10px] font-mono mt-2">
                      <span class="text-white/30 uppercase tracking-tighter">Speed</span>
                      <span id="popup-speed" class="text-white font-medium">${(entity.speed !== undefined && entity.speed !== null) ? Math.round(entity.speed) + ' kt' : 'n/a'}</span>
                  </div>
                  <div class="flex justify-between items-center text-[10px] font-mono">
                      <span class="text-white/30 uppercase tracking-tighter">Status</span>
                      <span class="text-emerald-400 font-medium">Underway</span>
                  </div>`
                    : `   <div class="flex justify-between items-center text-[10px] font-mono">
                      <span class="text-white/30 uppercase tracking-tighter">Event</span>
                      <span class="text-white font-medium text-right leading-[13px] ml-4">${entity.title || 'Incident'}</span>
                  </div>
                  <div class="flex justify-between items-center text-[10px] font-mono mt-1.5">
                      <span class="text-white/30 uppercase tracking-tighter">Severity</span>
                      <span class="text-red-400 font-medium uppercase font-bold">${entity.severity || 'HIGH'}</span>
                  </div>
                  <div class="flex justify-between items-center text-[10px] font-mono mt-1.5 pt-1.5 border-t border-white/10">
                      <span class="text-white/30 uppercase tracking-tighter">Nearest Agent:</span>
                      <span id="popup-nearest-agent" class="text-emerald-400 font-bold tracking-tight">${nearestAgentText}</span>
                  </div>`;

        const popupHTML = `
            <div class="px-4 py-3 bg-black/80 backdrop-blur-xl border border-white/10 rounded-lg min-w-[280px] max-w-[400px]">
                <div class="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                    <span class="text-[9px] font-mono text-blue-400 uppercase tracking-[0.2em] font-bold">${entity.type}</span>
                    <span class="w-1.5 h-1.5 rounded-full ${entity.type === 'security' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'}"></span>
                </div>
                ${entity.type === 'aircraft' ? `
                    <div class="text-lg font-black italic tracking-tight text-white uppercase leading-none">${entity.callsign && entity.callsign.trim() !== '' ? entity.callsign : 'UNKNOWN'}</div>
                    <div class="text-[11px] font-bold font-mono text-white/50 mb-3 uppercase">${(entity.id || '').replace('plane-', '')}</div>
                ` : `
                    <div class="text-lg font-black italic tracking-tight text-white mb-3 uppercase leading-tight">${entity.name || entity.callsign || entity.id}</div>
                `}
                <div class="space-y-1.5">
                    <div class="flex justify-between items-center text-[10px] font-mono">
                        <span class="text-white/30 uppercase tracking-tighter">Lat / Lng:</span>
                        <span id="popup-latlng" class="text-white font-medium">${entity.lat.toFixed(4)}, ${entity.lng.toFixed(4)}</span>
                    </div>
                    ${extraDetails}
                    <div class="flex justify-between items-center text-[10px] font-mono border-t border-white/10 pt-1.5 mt-1.5">
                        <span class="text-white/30 uppercase tracking-tighter">Heading:</span>
                        <span id="popup-heading" class="text-blue-400 font-bold">${entity.heading !== undefined && entity.heading < 360 ? Math.round(entity.heading) + '°' : 'N/A'}</span>
                    </div>
                </div>
            </div>
        `;

        const isSameEntity = activePopup.current && (activePopup.current as any)._entityId === selectedEntityId;

        if (isSameEntity && activePopup.current) {
            // Hot update the existing popup's location without tearing down HTML rendering
            activePopup.current.setLngLat([entity.lng, entity.lat]);

            // Surgically update DOM to avoid destroying the running video element
            const el = activePopup.current.getElement();
            if (el) {
                const latLngEl = el.querySelector('#popup-latlng');
                if (latLngEl) latLngEl.textContent = `${entity.lat.toFixed(4)}, ${entity.lng.toFixed(4)}`;

                const headingEl = el.querySelector('#popup-heading');
                if (headingEl) headingEl.textContent = entity.heading !== undefined && entity.heading < 360 ? `${Math.round(entity.heading)}°` : 'N/A';

                const speedEl = el.querySelector('#popup-speed');
                if (speedEl) speedEl.textContent = (entity.speed !== undefined && entity.speed !== null && entity.speed > 0) ? `${Math.round(entity.speed)} kt` : 'n/a';

                const altitudeEl = el.querySelector('#popup-altitude');
                if (altitudeEl) altitudeEl.textContent = (entity.altitude !== undefined && entity.altitude !== null && entity.altitude > 0) ? `${Math.round(entity.altitude).toLocaleString()} ft` : 'n/a';

                if (entity.type === 'operative') {
                    const bpmEl = el.querySelector('#popup-bpm');
                    if (bpmEl) bpmEl.textContent = `${entity.heartRate} BPM`;

                    const statusEl = el.querySelector('#popup-status');
                    if (statusEl) statusEl.textContent = entity.status || 'Active';

                    const objectiveEl = el.querySelector('#popup-objective');
                    if (objectiveEl) objectiveEl.textContent = entity.missionObjective || 'Awaiting Orders';
                }

                if (entity.type === 'security') {
                    const nearestAgentEl = el.querySelector('#popup-nearest-agent');
                    if (nearestAgentEl) nearestAgentEl.textContent = nearestAgentText;
                }
            }
        } else {
            if (activePopup.current) activePopup.current.remove();

            // Instantiate completely new popup
            const newPopup = new mapboxgl.Popup({
                offset: 25,
                className: 'tactical-popup',
                closeButton: false,
                closeOnClick: true,
            }).setLngLat([entity.lng, entity.lat])
                .setHTML(popupHTML)
                .addTo(map.current);

            (newPopup as any)._entityId = selectedEntityId;

            // Attach Event Listeners to DOM nodes in Popup
            setTimeout(() => {
                const el = newPopup.getElement();
                if (!el) return;
                const reqBtn = el.querySelector('#comms-btn');
                const reqText = el.querySelector('#comms-text');

                if (reqBtn && reqText) {
                    reqBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (reqBtn.classList.contains('comm-active')) return;
                        reqBtn.classList.add('comm-active');

                        reqText.innerHTML = 'CONNECTING... <span class="animate-pulse">_</span>';
                        reqBtn.className = 'w-full mt-3 py-1.5 bg-blue-500/20 border border-blue-500/50 rounded text-[10px] font-mono font-bold text-blue-400 transition-colors uppercase tracking-widest flex items-center justify-center gap-2 comm-active cursor-pointer';

                        setTimeout(() => {
                            reqText.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> LINK SECURE';
                            reqBtn.className = 'w-full mt-3 py-1.5 bg-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.3)] border border-emerald-500/80 rounded text-[10px] font-mono font-bold text-white transition-colors uppercase tracking-widest flex items-center justify-center gap-2 comm-active cursor-pointer';
                        }, 2000);
                    });
                }
            }, 50);

            // Listen for popup close event natively to reset strict UI state
            newPopup.on('close', () => {
                if (activePopup.current === newPopup) {
                    setSelectedEntityId(null);
                    activePopup.current = null;
                }
            });

            activePopup.current = newPopup;
        }

    }, [selectedEntityId, entities, setSelectedEntityId]);

    return (
        <div className="w-full h-full relative bg-slate-950">
            <div
                ref={mapContainer}
                className="absolute inset-0 w-full h-full"
                style={{ minHeight: '100%' }}
            />

            {/* Tactical Zoom Warning Overlay */}
            {zoomError && (
                <div className="absolute inset-0 pointer-events-none z-[1000] flex items-center justify-center">
                    <div className="px-8 py-4 bg-red-950/40 backdrop-blur-md border-y border-red-500/50 w-full flex items-center justify-center gap-4 animate-in fade-in zoom-in duration-300">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 animate-pulse">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <span className="text-sm font-mono font-black text-red-100 tracking-[0.3em] uppercase">
                            {zoomError}
                        </span>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 animate-pulse">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                    </div>
                </div>
            )}

            {/* Overlay for no token warning */}
            {!import.meta.env.VITE_MAPBOX_TOKEN && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
                    <div className="p-8 bg-[#1a1a1a] border border-red-500/30 rounded-2xl shadow-2xl text-center max-w-md">
                        <h2 className="text-xl font-bold text-red-500 mb-2">Mapbox Token Missing</h2>
                        <p className="text-slate-400 text-sm mb-6">
                            Please add your Mapbox access token to <code className="text-emerald-400 bg-emerald-400/10 px-1 py-0.5 rounded">client/.env</code> to enable tactical map visualization.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BaseMap;