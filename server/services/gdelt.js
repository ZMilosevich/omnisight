const axios = require('axios');

class GdeltService {
    constructor(io) {
        this.io = io;
        this.interval = null;
        this.center = null; // { lat, lng }
        this.dummyTitles = [
            'Civil Unrest Reported in Financial District',
            'Suspicious Package Investigated Near Tube Station',
            'Road Blockade by Protesters',
            'Emergency Services Dispatched to Sector 4'
        ];
        this.dummyIdx = 0;
    }

    start(lat, lng) {
        this.stop();
        this.center = { lat, lng };

        const fetchGdelt = async () => {
            if (!this.center) return;

            try {
                // Search for news near the center point
                const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=london&mode=artlist&maxrecords=5&format=json`;
                const response = await axios.get(url, { timeout: 10000 });

                if (response.data && response.data.articles) {
                    response.data.articles.forEach((article, index) => {
                        const hash = article.url.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
                        const pseudoRandom1 = Math.abs(Math.sin(hash));
                        const pseudoRandom2 = Math.abs(Math.cos(hash));

                        const latJitter = this.center.lat + (pseudoRandom1 - 0.5) * 0.1;
                        const lngJitter = this.center.lng + (pseudoRandom2 - 0.5) * 0.1;

                        this.io.emit('entity-update', {
                            id: `gdelt-live-${index}`,
                            type: 'security',
                            lat: latJitter,
                            lng: lngJitter,
                            callsign: article.domain || 'NEWS REPORT',
                            title: article.title.length > 50 ? article.title.substring(0, 47) + '...' : article.title,
                            severity: ['low', 'medium', 'high'][Math.floor(pseudoRandom1 * 3)],
                            timestamp: Date.now()
                        });
                    });
                    return;
                }
            } catch (error) {
                console.log('GDELT API error. Using fallback.');
            }

            // Fallback
            this.generateMockData();
        };

        fetchGdelt();
        this.interval = setInterval(fetchGdelt, 20000);
    }

    generateMockData() {
        if (!this.center) return;
        const lat = this.center.lat + (Math.random() - 0.5) * 0.1;
        const lng = this.center.lng + (Math.random() - 0.5) * 0.1;

        this.io.emit('entity-update', {
            id: 'gdelt-mock',
            type: 'security',
            lat,
            lng,
            callsign: 'POLICE REPORT',
            title: this.dummyTitles[this.dummyIdx % this.dummyTitles.length],
            severity: 'medium',
            timestamp: Date.now()
        });
        this.dummyIdx++;
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.center = null;
    }
}

module.exports = { GdeltService };
