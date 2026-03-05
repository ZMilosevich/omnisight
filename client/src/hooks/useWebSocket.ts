import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from '../store/useAppStore';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

export interface Entity {
    id: string;
    type: 'aircraft' | 'vessel' | 'security' | 'operative' | 'weather';
    lat: number;
    lng: number;
    speed?: number;
    heading?: number;
    callsign?: string;
    route?: string;
    country?: string;
    altitude?: number;
    title?: string;
    severity?: 'low' | 'medium' | 'high';
    // Operative Specific
    name?: string;
    avatarUrl?: string;
    status?: string;
    heartRate?: number;
    missionObjective?: string;
    timestamp: number;
}

export const useWebSocket = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [entities, setEntities] = useState<Record<string, Entity>>({});
    const [isConnected, setIsConnected] = useState(false);
    const { setRestrictedZoneCoords } = useAppStore();

    useEffect(() => {
        const newSocket = io(BACKEND_URL);

        newSocket.on('connect', () => {
            console.log('Connected to dispatcher');
            setIsConnected(true);
        });

        newSocket.on('restricted-zone', (coords: number[][]) => {
            setRestrictedZoneCoords(coords);
        });

        newSocket.on('entity-update', (data: Entity) => {
            setEntities((prev) => ({
                ...prev,
                [data.id]: {
                    ...data,
                    timestamp: Date.now()
                }
            }));
        });

        newSocket.on('entity-remove', (id: string) => {
            setEntities((prev) => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
        });

        newSocket.on('clear-entities', () => {
            setEntities(prev => {
                const updated: Record<string, Entity> = {};
                for (const key in prev) {
                    if (prev[key].type === 'weather') {
                        updated[key] = prev[key];
                    }
                }
                return updated;
            });
        });

        newSocket.on('disconnect', () => {
            console.log('Disconnected from dispatcher');
            setIsConnected(false);
        });

        setSocket(newSocket);

        const pingInterval = setInterval(() => {
            if (newSocket.connected) {
                newSocket.emit('ping', 'client-heartbeat');
            }
        }, 5000);

        return () => {
            clearInterval(pingInterval);
            newSocket.close();
        };
    }, []);

    return { socket, entities, isConnected };
};
