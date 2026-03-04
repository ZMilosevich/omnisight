const axios = require('axios');

class OpenSkyService {
    constructor(io) {
        this.io = io;
        this.interval = null;
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
                console.log('OpenSky API offline or rate limited. Waiting for next polling cycle.');
            }
        };

        fetchOpenSky();
        this.interval = setInterval(fetchOpenSky, 15000);
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
    }
}

module.exports = { OpenSkyService };

