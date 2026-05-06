# Firewatcher

Wildfire situational awareness dashboard for Hahira, GA and surrounding counties. Pulls authoritative public data sources, plots active and recent hotspots on a map with a timeline slider for radar-style playback, and sends SMS/email alerts when conditions warrant.

Live: `https://fires.nijemtech.com` (deployment pending)

## Coverage area
- **Center:** Hahira, GA (31.0381°N, 83.3690°W)
- **Counties watched:** Lowndes, Brooks, Cook, Lanier, Echols, Berrien (GA) + Hamilton, Madison (FL)
- **Map radius:** 75 mi from Hahira

## Data sources

| Source | What it provides | Update cadence |
|---|---|---|
| [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) | Satellite hotspot detections (VIIRS S-NPP, VIIRS NOAA-20/21, MODIS) | Every 30 min |
| [NWS api.weather.gov](https://www.weather.gov/documentation/services-web-api) | Red Flag Warnings, Fire Weather Watches for GAZ155 + neighbors | Every 15 min |
| [GA Forestry Commission](https://gatrees.org/) | County burn ban status, daily fire activity | Hourly |
| [US Drought Monitor](https://droughtmonitor.unl.edu/) | Drought intensity (D0–D4) for Lowndes County | Weekly |
| [AirNow](https://www.airnow.gov/) | PM2.5 / smoke air quality | Hourly |
| [NIFC WFIGS](https://data-nifc.opendata.arcgis.com/) | Active wildfire incident perimeters (when available) | Hourly |

## Alert tiers

| Distance from Hahira | Notification |
|---|---|
| Within 25 mi | SMS + email (urgent) |
| 25–50 mi | Email |
| 50–75 mi | Dashboard only |

A NWS Red Flag Warning for the local zone always triggers SMS + email regardless of any hotspot distance.

## Architecture

- **Backend:** Python 3.12, FastAPI, APScheduler, SQLite. Pollers run on a schedule, normalize results, write to SQLite. REST API serves the frontend.
- **Frontend:** Vite + React + TypeScript + MapLibre GL. Single-page app with map, timeline slider for historical hotspot playback, status panel, and alert log.
- **Deployment:** Single VPS. nginx reverse-proxy → FastAPI on `127.0.0.1:8003`. Frontend served as static files. TLS via Let's Encrypt.
- **Alerts:** Twilio for SMS, SMTP (Gmail App Password or Resend) for email.

## Repo layout

```
Firewatcher/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app + routes
│   │   ├── config.py        # Settings from env
│   │   ├── db.py            # SQLite schema + helpers
│   │   ├── alerts.py        # Twilio + email dispatch
│   │   ├── geo.py           # Distance, bbox helpers
│   │   ├── scheduler.py     # APScheduler glue
│   │   └── sources/         # One module per data source
│   │       ├── firms.py
│   │       ├── nws.py
│   │       ├── gfc.py
│   │       ├── drought.py
│   │       └── airnow.py
│   └── requirements.txt
├── frontend/                # Vite + React (see frontend/README.md)
├── deploy/
│   ├── firewatcher.service  # systemd unit
│   └── nginx.conf           # nginx site config
├── .env.example
└── README.md
```

## Local development

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env  # then fill in keys
uvicorn app.main:app --reload --port 8003

# Frontend
cd frontend
npm install
npm run dev
```

## Required environment variables

See [`.env.example`](./.env.example). At minimum you need a free [NASA FIRMS map key](https://firms.modaps.eosdis.nasa.gov/api/map_key/). Twilio + email credentials only required if you enable alerts.

## License

MIT
