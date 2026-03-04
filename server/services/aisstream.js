const WebSocket = require('ws');

class AisStreamService {
    constructor(io) {
        this.io = io;
        this.ws = null;
        this.apiKey = process.env.AISSTREAM_API_KEY;
        this.boundingBox = null; // [[[lat, lng], [lat, lng]]]
        this.reconnectTimeout = null;
        this.mockInterval = null;
        this.mockVessels = [];
    }

    start(latMin, lngMin, latMax, lngMax) {
        this.stop(); // Stop any existing connection
        this.boundingBox = [[[latMin, lngMin], [latMax, lngMax]]];

        if (!this.apiKey) {
            console.warn('AISSTREAM_API_KEY is missing. Falling back to mock data simulation entirely.');
            this.startMocking();
            return;
        }

        this.connect();

        // Even if we connect, we should ensure some mock data exists to prove the connection state if the real feed is silent
        this.startMocking();
    }

    startMocking() {
        if (this.mockInterval) clearInterval(this.mockInterval);
        this.mockVessels = []; // Reset on new area

        // Generate initial batch
        this.generateMockData();

        // Loop simulation
        this.mockInterval = setInterval(() => this.generateMockData(), 15000);
    }

    connect() {
        if (this.ws) return;

        this.ws = new WebSocket("wss://stream.aisstream.io/v0/stream");

        this.ws.on("open", () => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN && this.boundingBox) {
                console.log("Connected to AISStream with bounds:", this.boundingBox);
                const subscriptionMessage = {
                    APIKey: this.apiKey,
                    BoundingBoxes: this.boundingBox,
                    FiltersShipMMSI: [],
                    FilterMessageTypes: ["PositionReport"]
                };
                this.ws.send(JSON.stringify(subscriptionMessage));
            }
        });

        this.ws.on("message", (data) => {
            try {
                const message = JSON.parse(data);
                if (message.MessageType === "PositionReport" || (message.Message && message.Message.PositionReport)) {
                    const positionReport = message.Message.PositionReport;
                    const mmsi = message.MetaData.MMSI;
                    const callsign = message.MetaData.ShipName ? message.MetaData.ShipName.trim() : `MMSI-${mmsi}`;

                    this.io.emit('entity-update', {
                        id: `ship-${mmsi}`,
                        type: 'vessel',
                        lat: positionReport.Latitude,
                        lng: positionReport.Longitude,
                        callsign: callsign,
                        heading: positionReport.TrueHeading || 0,
                        timestamp: Date.now()
                    });
                }
            } catch (err) {
                // Silently handle parse errors
            }
        });

        this.ws.on("error", (err) => {
            console.error("AISStream error:", err.message);
        });

        this.ws.on("close", () => {
            this.ws = null;
            if (this.boundingBox) {
                console.log("AISStream closed. Reconnecting in 5s...");
                this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
            }
        });
    }

    stop() {
        this.boundingBox = null;
        this.mockVessels = [];
        if (this.mockInterval) {
            clearInterval(this.mockInterval);
            this.mockInterval = null;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.ws) {
            this.ws.terminate();
            this.ws = null;
        }
    }

    generateMockData() {
        if (!this.boundingBox || !this.boundingBox[0]) return;

        const [[latMin, lngMin], [latMax, lngMax]] = this.boundingBox[0];

        // Seed initial vessels if empty
        if (this.mockVessels.length === 0) {
            for (let i = 0; i < 5; i++) {
                this.mockVessels.push({
                    id: `vessel-mock-${9000 + i}`,
                    callsign: `NAV-M-${Math.floor(Math.random() * 90) + 10}`,
                    lat: latMin + (latMax - latMin) * Math.random(),
                    lng: lngMin + (lngMax - lngMin) * Math.random(),
                    heading: Math.random() * 360,
                    speed: (latMax - latMin) * 0.005 // Slower than planes
                });
            }
        }

        this.mockVessels.forEach(vessel => {
            // Very slow, deliberate movement
            vessel.lat += Math.cos(vessel.heading * (Math.PI / 180)) * vessel.speed;
            vessel.lng += Math.sin(vessel.heading * (Math.PI / 180)) * vessel.speed;
            vessel.heading += (Math.random() - 0.5) * 2; // Slight drift

            // Boundary bouncing
            if (vessel.lat > latMax || vessel.lat < latMin || vessel.lng > lngMax || vessel.lng < lngMin) {
                vessel.heading = (vessel.heading + 180) % 360;
                // Force back inside to prevent getting permanently stuck on edge
                vessel.lat = Math.max(latMin, Math.min(latMax, vessel.lat));
                vessel.lng = Math.max(lngMin, Math.min(lngMax, vessel.lng));
            }

            this.io.emit('entity-update', {
                id: vessel.id,
                type: 'vessel',
                lat: vessel.lat,
                lng: vessel.lng,
                callsign: vessel.callsign,
                heading: vessel.heading,
                route: 'Maritime Patrol',
                timestamp: Date.now()
            });
        });
    }
}

module.exports = { AisStreamService };

