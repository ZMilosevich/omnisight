const WebSocket = require('ws');

class AisStreamService {
    constructor(io) {
        this.io = io;
        this.ws = null;
        this.apiKey = process.env.AISSTREAM_API_KEY;
        this.boundingBox = null; // [[[lat, lng], [lat, lng]]]
        this.reconnectTimeout = null;
    }

    start(latMin, lngMin, latMax, lngMax) {
        this.stop(); // Stop any existing connection
        this.boundingBox = [[[latMin, lngMin], [latMax, lngMax]]];

        if (!this.apiKey) {
            console.warn('AISSTREAM_API_KEY is missing.');
            return;
        }

        this.connect();
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
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.ws) {
            this.ws.terminate();
            this.ws = null;
        }
    }
}

module.exports = { AisStreamService };

