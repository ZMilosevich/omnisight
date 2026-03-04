require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const { AisStreamService } = require('./services/aisstream');
const { OpenSkyService } = require('./services/opensky');
const { startOpenWeather } = require('./services/openweather');
const { GdeltService } = require('./services/gdelt');
const { OperativeService } = require('./services/operative');

const app = express();
app.use(cors({
  origin: [process.env.CLIENT_URL, "http://localhost:5173", "https://omnisight-iota.vercel.app"].filter(Boolean),
  credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [process.env.CLIENT_URL, "http://localhost:5173", "https://omnisight-iota.vercel.app"].filter(Boolean),
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 5001;

function isPointInPolygon(point, vs) {
  let x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i][0], yi = vs[i][1];
    let xj = vs[j][0], yj = vs[j][1];
    let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Global reactive state
let RESTRICTED_ZONE_COORDS = [];

const ioWrapper = {
  emit: (event, data) => {
    if (event === 'entity-update') {
      console.log(`Emitting ${data.type} update: ${data.id} ${data.route ? `(Route: ${data.route})` : ''}`);
      io.emit('entity-update', data);

      if ((data.type === 'vessel' || data.type === 'aircraft') &&
        RESTRICTED_ZONE_COORDS.length >= 3 &&
        isPointInPolygon([data.lng, data.lat], RESTRICTED_ZONE_COORDS)) {

        io.emit('entity-update', {
          id: `alert-${data.id}`,
          type: 'security',
          lat: data.lat,
          lng: data.lng,
          callsign: data.callsign,
          title: `UNAUTHORIZED INCURSION: ${data.callsign}`,
          severity: 'high',
          timestamp: Date.now()
        });
      }
    } else {
      io.emit(event, data);
    }
  }
};

// Initialize services
const aisStream = new AisStreamService(ioWrapper);
const openSky = new OpenSkyService(ioWrapper);
const gdelt = new GdeltService(ioWrapper);
const operatives = new OperativeService(ioWrapper);
startOpenWeather(ioWrapper); // Weather stays global for now or follows similarly

function updateServices(coords) {
  if (coords && coords.length >= 3) {
    // Calculate Bounding Box
    const lngs = coords.map(p => p[0]);
    const lats = coords.map(p => p[1]);
    const lomin = Math.min(...lngs);
    const lomax = Math.max(...lngs);
    const lamin = Math.min(...lats);
    const lamax = Math.max(...lats);

    console.log(`Starting services for area: [${lamin}, ${lomin}] to [${lamax}, ${lomax}]`);

    io.emit('clear-entities');

    aisStream.start(lamin, lomin, lamax, lomax);
    openSky.start(lamin, lomin, lamax, lomax);
    gdelt.start((lamin + lamax) / 2, (lomin + lomax) / 2);
    operatives.start(lamin, lomin, lamax, lomax);
  } else {
    console.log("No active zone. Stopping services and clearing map.");
    aisStream.stop();
    openSky.stop();
    gdelt.stop();
    operatives.stop();
    console.log("EMITTING clear-entities");
    io.emit('clear-entities');
  }
}

io.use((socket, next) => {
  socket.onAny((event, ...args) => {
    console.log(`[EVENT] ${event} from ${socket.id}`, JSON.stringify(args).substring(0, 100));
  });
  next();
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.onAny((event, ...args) => {
    console.log(`[EVENT] ${event} from ${socket.id}`, JSON.stringify(args).substring(0, 100));
  });

  socket.emit('restricted-zone', RESTRICTED_ZONE_COORDS);

  socket.on('update-restricted-zone', (coords) => {
    console.log(`Received update-restricted-zone with ${coords ? coords.length : 0} points`);
    if (coords) {
      RESTRICTED_ZONE_COORDS = [...coords];
      io.emit('restricted-zone', RESTRICTED_ZONE_COORDS);
      updateServices(RESTRICTED_ZONE_COORDS);
    }
  });

  socket.on('ping', (msg) => {
    // silent heartbeat acknowledge
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

setInterval(() => {
  console.log(`--- Status Watchdog ---`);
  console.log(`Active Zone: ${RESTRICTED_ZONE_COORDS.length} points`);
  console.log(`AIS: ${aisStream.ws ? 'Connected' : 'Disconnected'}`);
  console.log(`OpenSky: ${openSky.interval ? 'Active' : 'Idle'}`);
  console.log(`GDELT: ${gdelt.interval ? 'Active' : 'Idle'}`);
  console.log(`-----------------------`);
}, 30000);

server.listen(PORT, () => {
  console.log(`Dispatcher listening on port ${PORT}`);
});
