require('dotenv').config();
const { AisStreamService } = require('./services/aisstream');
const { OpenSkyService } = require('./services/opensky');
const { GdeltService } = require('./services/gdelt');

const mockIo = {
    emit: (event, data) => {
        console.log(`[MOCK IO] ${event}:`, data.id, data.type);
    }
};

const ais = new AisStreamService(mockIo);
const sky = new OpenSkyService(mockIo);
const gdelt = new GdeltService(mockIo);

console.log("Starting test for London area...");
// London approx bounds
const lamin = 51.3, lomin = -0.3, lamax = 51.7, lomax = 0.1;

ais.start(lamin, lomin, lamax, lomax);
sky.start(lamin, lomin, lamax, lomax);
gdelt.start((lamin + lamax) / 2, (lomin + lomax) / 2);

setTimeout(() => {
    console.log("Test finished.");
    process.exit(0);
}, 20000);
