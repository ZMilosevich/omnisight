const axios = require('axios');

function startOpenWeather(io) {
    const API_KEY = process.env.OPENWEATHER_API_KEY;
    if (!API_KEY) {
        console.warn('OPENWEATHER_API_KEY is missing. Skipping OpenWeather.');
        return;
    }

    // Coordinates for central London
    const lat = 51.5074;
    const lon = -0.1278;

    const fetchWeather = async () => {
        try {
            const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
            const response = await axios.get(url);
            const data = response.data;

            io.emit('entity-update', {
                id: `weather-${data.id}`,
                type: 'weather',
                lat: data.coord.lat,
                lng: data.coord.lon,
                callsign: `${Math.round(data.main.temp)}°C, ${data.weather[0].main}`,
                heading: data.wind.deg || 0,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('OpenWeather fetch error:', error.message);
        }
    };

    fetchWeather();
    // Weather doesn't change every second, polling every 5 minutes is plenty
    setInterval(fetchWeather, 300000);
}

module.exports = { startOpenWeather };
