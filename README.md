# omnisight# OmniSight: Real-Time Intelligence & Situational Awareness Dashboard

OmniSight is a high-performance, real-time web application designed to aggregate and visualize global open-source intelligence (OSINT). It combines live transit data, environmental conditions, and geopolitical events into a single, cohesive, dark-themed map interface.

By utilizing WebSockets and a Node.js dispatcher, OmniSight normalizes highly fragmented global data streams into a sleek, low-latency UI.

## 🌟 Key Features

* **Fullscreen Tactical Map:** Built on **Mapbox GL JS** utilizing a custom dark-mode basemap to reduce eye strain and highlight critical data points.
* **Live Entity Tracking:** Real-time plotting of global airspace (ADS-B) and maritime traffic (AIS) with interactive popups displaying speed, heading, and callsigns.
* **Geopolitical Event Feed (GDELT):** A dedicated, glassmorphic right-hand side panel featuring an **AG Grid** data table that streams, filters, and categorizes global news and conflict data via the CAMEO code system.
* **Floating Layer Management:** A centralized toggle control positioned between the map and the data panel, allowing users to instantly declutter the interface by hiding specific intelligence layers (Transit, Security, Environment).
* **Modern UI/UX:** Styled completely with **Tailwind CSS** and **shadcn/ui**, ensuring a responsive, sleek, and highly functional interface designed to handle overlapping complex data without overwhelming the user.

## 🏗️ Technical Architecture

To prevent browser freezing from thousands of simultaneous markers, the architecture is split into a central dispatcher and a lightweight client:

* **Backend (The Dispatcher):** A **Node.js** server maintains connections to rate-limited REST APIs and WebSocket streams. It normalizes the data (aligning ship and plane data structures) and broadcasts a unified feed to the client.
* **Frontend (The Visualizer):** A **React** application that strictly listens to the Node.js broadcast, updating Mapbox markers and AG Grid rows dynamically.

### Tech Stack
* **Frontend:** React, Mapbox GL JS, AG Grid, shadcn/ui, Tailwind CSS, Lucide Icons.
* **Backend:** Node.js, Express, Socket.io (or Server-Sent Events).
* **Data Sources (Free APIs):**
    * OpenSky Network (Air Traffic)
    * AISStream.io (Maritime Traffic)
    * GDELT Project 2.0 (Geopolitical Events)
    * OpenWeather (Environmental Data)
    * TomTom (Road Traffic)

## 🚀 Getting Started

### Prerequisites
* Node.js (v18+)
* A Mapbox API Access Token (Free tier)
* An AISStream API Key (Free tier)
* An OpenWeather API Key (Free tier)
* A TomTom Developer API Key (Free tier)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/ZMilosevich/omnisight.git
    cd omnisight
    ```

2.  **Install Backend Dependencies:**
    ```bash
    cd server
    npm install
    # If starting from scratch:
    # npm init -y
    # npm install express socket.io cors dotenv
    ```

3.  **Install Frontend Dependencies:**
    ```bash
    cd ../client
    npm install
    # If starting from scratch:
    # npm create vite@latest . -- --template react-ts
    # npm install mapbox-gl react-map-gl ag-grid-react ag-grid-community 
    # npm install tailwindcss postcss autoprefixer
    # npx tailwindcss init -p
    ```

4.  **Environment Variables:**
    Create a `.env` file in both the `/client` and `/server` directories based on the provided `.env.example` files.

    *Client `.env` (inside `/client`):*
    ```env
    VITE_MAPBOX_TOKEN=your_mapbox_token_here
    VITE_BACKEND_URL=http://localhost:5000
    ```

    *Server `.env` (inside `/server`):*
    ```env
    AISSTREAM_API_KEY=your_aisstream_key_here
    OPENWEATHER_API_KEY=your_openweather_key_here
    TOMTOM_API_KEY=your_tomtom_key_here
    ```

### Running the Application (Development Mode)

Open two terminal windows.

*Terminal 1 (Backend):*
```bash
cd server
npm run dev # or: node index.js
```

*Terminal 2 (Frontend):*
```bash
cd client
npm run dev
```

## 🗺️ Roadmap & Future Implementations

- [ ] Implement Deck.gl overlay for rendering >100,000 concurrent points smoothly.
- [ ] Add historical time-slider for 24-hour pattern playback.
- [ ] Integrate local Open Data portals for regional crime statistics.
- [ ] Add geofencing alerts for specific maritime chokepoints or airspaces.

## 📄 License
This project is licensed under the GNU General Public License v3 - see the [LICENSE](LICENSE) file for details.

## 📁 Project Structure

```
src/
├── assets/                 # Local icons, dark-mode logos, or custom map markers
├── components/
│   ├── map/                # Everything related to the Mapbox canvas
│   │   ├── BaseMap.tsx     # The core Mapbox GL JS wrapper component
│   │   ├── EntityPopup.tsx # The custom tooltip for clicked ships/planes
│   │   └── layers/         # Individual components to render specific data
│   │       ├── TransitLayer.tsx
│   │       ├── WeatherLayer.tsx
│   │       └── GdeltLayer.tsx
│   ├── panel/              # The right-hand intelligence feed
│   │   ├── IntelPanel.tsx  # The glassmorphic <aside> wrapper
│   │   ├── GdeltGrid.tsx   # The AG Grid component implementation
│   │   └── ThreatMeter.tsx # Optional: A visual summary of current grid data
│   ├── controls/           # The floating menu between the map and panel
│   │   └── LayerToggle.tsx # The shadcn buttons to switch map layers on/off
│   └── ui/                 # Auto-generated folder for shadcn components
│       ├── button.tsx
│       ├── switch.tsx
│       └── sheet.tsx
├── hooks/                  # Custom React hooks for data fetching & streams
│   ├── useWebSocket.ts     # Manages the Socket.io connection to your Node backend
│   └── useMapState.ts      # Tracks viewport coordinates and zoom level
├── store/                  # Global state management (Zustand or Redux)
│   └── useAppStore.ts      # Stores which layers are active, selected entity data, etc.
├── utils/                  # Helper functions
│   ├── cameoCodes.ts       # Maps GDELT CAMEO codes to human-readable strings & colors
│   └── geoHelpers.ts       # Functions for calculating distances or formatting GeoJSON
├── types/                  # TypeScript interfaces (highly recommended)
│   └── index.ts            # Definitions for Ship, Aircraft, and GdeltEvent objects
├── App.tsx                 # The main layout shell (orchestrating map, panel, controls)
├── index.css               # Tailwind CSS imports and global dark-mode variables
└── main.tsx                # React entry point