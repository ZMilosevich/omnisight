const axios = require('axios');

class OpenSkyService {
    constructor(io) {
        this.io = io;
        this.interval = null;
        this.mockPlanes = [];
        this.bounds = null; // { lamin, lomin, lamax, lomax }
    }

    start(lamin, lomin, lamax, lomax) {
        this.stop();
        this.bounds = { lamin, lomin, lamax, lomax };

        const fetchOpenSky = async () => {
            if (!this.bounds) return;

            try {
                const response = await axios.get(`https://opensky-network.org/api/states/all?lamin=${this.bounds.lamin}&lomin=${this.bounds.lomin}&lamax=${this.bounds.lamax}&lomax=${this.bounds.lomax}`, { timeout: 10000 });
                if (response.data && response.data.states && response.data.states.length > 0) {
                    response.data.states.forEach(state => {
                        const icao24 = state[0];
                        const callsign = state[1] ? state[1].trim() : `ICAO-${icao24}`;
                        const lng = state[5];
                        const lat = state[6];
                        const heading = state[10] || 0;

                        if (lat !== null && lng !== null) {
                            this.io.emit('entity-update', {
                                id: `plane-${icao24}`,
                                type: 'aircraft',
                                lat,
                                lng,
                                callsign,
                                heading,
                                route: this.getRoute(callsign),
                                timestamp: Date.now()
                            });
                        }
                    });
                    return;
                }
            } catch (error) {
                console.log('OpenSky API offline or rate limited. Using fallback.');
            }

            // Fallback Simulation logic
            this.generateMockData();
        };

        fetchOpenSky();
        this.interval = setInterval(fetchOpenSky, 15000);
    }

    generateMockData() {
        if (!this.bounds) return;

        const { lamin, lomin, lamax, lomax } = this.bounds;

        if (this.mockPlanes.length === 0) {
            for (let i = 0; i < 10; i++) {
                this.mockPlanes.push({
                    id: `plane-mock-${1000 + i}`,
                    callsign: `BAW${Math.floor(Math.random() * 900) + 100}`,
                    lat: lamin + (lamax - lamin) * Math.random(),
                    lng: lomin + (lomax - lomin) * Math.random(),
                    heading: Math.random() * 360,
                    speed: (lamax - lamin) * 0.01 // Scale speed to bounds
                });
            }
        }

        this.mockPlanes.forEach(plane => {
            plane.lat += Math.cos(plane.heading * (Math.PI / 180)) * plane.speed;
            plane.lng += Math.sin(plane.heading * (Math.PI / 180)) * plane.speed;
            plane.heading += (Math.random() - 0.5) * 5;

            // Boundary bouncing
            if (plane.lat > lamax || plane.lat < lamin || plane.lng > lomax || plane.lng < lomin) {
                plane.heading = (plane.heading + 180) % 360;
            }

            this.io.emit('entity-update', {
                id: plane.id,
                type: 'aircraft',
                lat: plane.lat,
                lng: plane.lng,
                callsign: plane.callsign,
                heading: plane.heading,
                route: this.getRoute(plane.callsign),
                timestamp: Date.now()
            });
        });
    }

    getRoute(callsign) {
        if (!callsign) return 'Unknown - Unknown';

        const prefix = callsign.substring(0, 3).toUpperCase();
        const routes = {
            'BAW': 'London (LHR) - New York (JFK)',
            'DLH': 'Frankfurt (FRA) - Istanbul (IST)',
            'AFR': 'Paris (CDG) - Tokyo (HND)',
            'THY': 'Istanbul (IST) - London (LHR)',
            'UAE': 'Dubai (DXB) - Paris (CDG)',
            'QFA': 'Sydney (SYD) - London (LHR)',
            'AAL': 'New York (JFK) - Los Angeles (LAX)',
            'FIN': 'Helsinki (HEL) - Singapore (SIN)',
            'KLM': 'Amsterdam (AMS) - Nairobi (NBO)',
            'SAS': 'Copenhagen (CPH) - Chicago (ORD)'
        };

        if (routes[prefix]) return routes[prefix];

        // Fallback generator for other callsigns
        const cities = ['London', 'Paris', 'Berlin', 'Madrid', 'Rome', 'Istanbul', 'New York', 'Tokyo', 'Dubai', 'Singapore'];
        const origin = cities[Math.floor(Math.abs(Math.sin(callsign.split('').reduce((a, b) => a + b.charCodeAt(0), 0))) * cities.length)];
        let destination = cities[Math.floor(Math.abs(Math.cos(callsign.split('').reduce((a, b) => a + b.charCodeAt(0), 0))) * cities.length)];
        if (origin === destination) destination = 'Zurich';

        return `${origin} - ${destination}`;
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.bounds = null;
        this.mockPlanes = [];
    }
}

module.exports = { OpenSkyService };

