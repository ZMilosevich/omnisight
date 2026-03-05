const axios = require('axios');

class OpenSkyService {
    constructor(io) {
        this.io = io;
        this.interval = null;
        this.bounds = null; // { lamin, lomin, lamax, lomax }
        this.mockAircraft = [];
    }

    start(lamin, lomin, lamax, lomax) {
        this.stop();
        this.bounds = { lamin, lomin, lamax, lomax };

        // Initialize mock aircraft within the bounds
        const airlinePrefixes = ['BAW', 'AFR', 'DLH', 'UAE', 'QFA', 'AAL', 'UAL', 'DAL'];
        this.mockAircraft = Array.from({ length: 5 }).map((_, i) => {
            const callsign = `${airlinePrefixes[Math.floor(Math.random() * airlinePrefixes.length)]}${Math.floor(Math.random() * 9000) + 100}`;
            return {
                id: `mock-plane-${i}`,
                callsign,
                lat: lamin + (lamax - lamin) * Math.random(),
                lng: lomin + (lomax - lomin) * Math.random(),
                heading: Math.random() * 360,
                speed: 400 + Math.random() * 200, // Knots
                altitude: 30000 + Math.floor(Math.random() * 10000),
                country: 'Mockland'
            };
        });

        const fetchOpenSky = async () => {
            if (!this.bounds) return;

            // Update and emit mock aircraft
            this.mockAircraft.forEach(plane => {
                // Movement: degrees per second (approximate)
                // 1 degree lat is approx 60 nautical miles. 
                // Speed is in knots (nm/hr). So nm/sec = speed / 3600.
                // Lat change = (cos(heading) * speed / 3600) / 60
                const speedDegPerSec = (plane.speed / 3600) / 60;
                const updateIntervalSec = 15;

                plane.lat += Math.cos(plane.heading * (Math.PI / 180)) * speedDegPerSec * updateIntervalSec;
                plane.lng += Math.sin(plane.heading * (Math.PI / 180)) * speedDegPerSec * updateIntervalSec;

                // Wrap around or bounce (simple wrap for now)
                if (plane.lat > this.bounds.lamax) plane.lat = this.bounds.lamin;
                if (plane.lat < this.bounds.lamin) plane.lat = this.bounds.lamax;
                if (plane.lng > this.bounds.lomax) plane.lng = this.bounds.lomin;
                if (plane.lng < this.bounds.lomin) plane.lng = this.bounds.lomax;

                this.io.emit('entity-update', {
                    id: plane.id,
                    type: 'aircraft',
                    lat: plane.lat,
                    lng: plane.lng,
                    callsign: plane.callsign,
                    heading: plane.heading,
                    country: plane.country,
                    route: this.getRoute(plane.callsign),
                    altitude: plane.altitude,
                    speed: plane.speed,
                    timestamp: Date.now(),
                    isMock: true
                });
            });

            try {
                const response = await axios.get(`https://opensky-network.org/api/states/all?lamin=${this.bounds.lamin}&lomin=${this.bounds.lomin}&lamax=${this.bounds.lamax}&lomax=${this.bounds.lomax}`, { timeout: 10000 });
                if (response.data && response.data.states && response.data.states.length > 0) {
                    response.data.states.forEach(state => {
                        const icao24 = state[0];
                        const callsign = state[1] ? state[1].trim() : `ICAO-${icao24}`;
                        const originCountry = state[2] || 'Unknown';
                        const lng = state[5];
                        const lat = state[6];
                        const baro_altitude = state[7];
                        const velocity = state[9];
                        const heading = state[10] || 0;

                        if (lat !== null && lng !== null) {
                            this.io.emit('entity-update', {
                                id: `plane-${icao24}`,
                                type: 'aircraft',
                                lat,
                                lng,
                                callsign,
                                heading,
                                country: originCountry,
                                route: this.getRoute(callsign),
                                altitude: baro_altitude ? Math.floor(baro_altitude * 3.28084) : 0,
                                speed: velocity ? Math.floor(velocity * 1.94384) : 0,
                                timestamp: Date.now()
                            });
                        }
                    });
                    return;
                }
            } catch (error) {
                console.log('OpenSky API offline or rate limited. Using mock data only.');
            }
        };

        fetchOpenSky();
        this.interval = setInterval(fetchOpenSky, 15000);
    }

    getRoute(callsign) {
        if (!callsign || callsign.startsWith('ICAO')) return 'N/A';

        const prefix = callsign.substring(0, 3).toUpperCase();
        const routes = {
            'ASA': 'SEA-JFK',
            'BAW': 'LHR-JFK',
            'DLH': 'FRA-IST',
            'AFR': 'CDG-HND',
            'THY': 'IST-LHR',
            'UAE': 'DXB-CDG',
            'QFA': 'SYD-LHR',
            'AAL': 'JFK-LAX',
            'FIN': 'HEL-SIN',
            'KLM': 'AMS-NBO',
            'SAS': 'CPH-ORD',
            'UAL': 'SFO-EWR',
            'DAL': 'ATL-LHR'
        };
        if (routes[prefix]) return routes[prefix];

        // Standard randomized generator 
        const cities = ['LHR', 'CDG', 'FRA', 'MAD', 'FCO', 'IST', 'JFK', 'HND', 'DXB', 'SIN', 'LAX', 'SYD'];
        const seedCode = callsign.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const origin = cities[Math.floor(Math.abs(Math.sin(seedCode)) * cities.length)];
        let destination = cities[Math.floor(Math.abs(Math.cos(seedCode)) * cities.length)];
        if (origin === destination) destination = 'ZRH';

        return `${origin}-${destination}`;
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.bounds = null;
        this.mockAircraft = [];
    }
}

module.exports = { OpenSkyService };

