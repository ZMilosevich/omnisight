class OperativeService {
    constructor(io) {
        this.io = io;
        this.interval = null;
        this.operatives = [];
        this.bounds = null; // { lamin, lomin, lamax, lomax }

        // Mock Operative Data Profiles
        this.profiles = [
            { id: 'op-alpha-01', name: 'Agent Vance', avatarUrl: 'https://i.pravatar.cc/150?u=vance', status: 'Reconnaissance' },
            { id: 'op-bravo-02', name: 'Agent Chen', avatarUrl: 'https://i.pravatar.cc/150?u=chen', status: 'In Pursuit' },
            { id: 'op-charlie-03', name: 'Agent Stone', avatarUrl: 'https://i.pravatar.cc/150?u=stone', status: 'Standing By' }
        ];
    }

    start(lamin, lomin, lamax, lomax) {
        this.stop();
        this.bounds = { lamin, lomin, lamax, lomax };

        // Initialize operatives inside the bounds
        this.operatives = this.profiles.map(profile => ({
            ...profile,
            lat: lamin + (lamax - lamin) * Math.random(),
            lng: lomin + (lomax - lomin) * Math.random(),
            heading: Math.random() * 360,
            speed: (lamax - lamin) * 0.001, // Move much slower than planes
            heartRate: 75 + Math.floor(Math.random() * 20),
            missionObjective: `Investigating Sector ${Math.floor(Math.random() * 90) + 10} Anomaly`
        }));

        const simulateMovements = () => {
            if (!this.bounds) return;
            const { lamin, lomin, lamax, lomax } = this.bounds;

            this.operatives.forEach(op => {
                // Occasional course/status changes
                if (Math.random() < 0.1) {
                    op.heading += (Math.random() - 0.5) * 45;
                    op.heartRate += Math.floor((Math.random() - 0.5) * 10);
                    // constrain HR
                    if (op.heartRate < 60) op.heartRate = 60;
                    if (op.heartRate > 140) op.heartRate = 140;
                }

                if (Math.random() < 0.05) {
                    const sectors = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'];
                    const incidents = ['Unauthorized Access', 'Perimeter Breach', 'Suspicious Package', 'Signal Interference', 'Unknown Contraband'];
                    op.missionObjective = `${incidents[Math.floor(Math.random() * incidents.length)]} - Sector ${sectors[Math.floor(Math.random() * sectors.length)]}`;
                    op.status = ['In Pursuit', 'Reconnaissance', 'Standing By', 'Engaging'][Math.floor(Math.random() * 4)];
                }

                op.lat += Math.cos(op.heading * (Math.PI / 180)) * op.speed;
                op.lng += Math.sin(op.heading * (Math.PI / 180)) * op.speed;

                // Bounce off geofence boundary
                if (op.lat > lamax || op.lat < lamin || op.lng > lomax || op.lng < lomin) {
                    op.heading = (op.heading + 180) % 360;
                }

                this.io.emit('entity-update', {
                    id: op.id,
                    type: 'operative',
                    lat: op.lat,
                    lng: op.lng,
                    name: op.name,
                    avatarUrl: op.avatarUrl,
                    status: op.status,
                    heartRate: op.heartRate,
                    missionObjective: op.missionObjective,
                    heading: op.heading,
                    timestamp: Date.now()
                });
            });
        };

        // Initial burst, then interval
        simulateMovements();
        this.interval = setInterval(simulateMovements, 3000); // Update frequently for smooth HR/movement overlay
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.bounds = null;
        this.operatives = [];
    }
}

module.exports = { OperativeService };
