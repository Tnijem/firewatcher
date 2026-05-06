// Same-origin in production (nginx proxies /api/* to the backend), localhost in dev.
const API_BASE = import.meta.env.DEV ? "http://127.0.0.1:8003" : "";

export type Hotspot = {
  id: number;
  source: string;
  latitude: number;
  longitude: number;
  acq_datetime: string; // ISO UTC
  confidence: string | null;
  brightness: number | null;
  frp: number | null;
  daynight: "D" | "N" | null;
  distance_mi: number;
};

export type NwsAlert = {
  id: string;
  event: string;
  zones: string;
  headline: string | null;
  sent_at: string;
  onset: string | null;
  expires: string | null;
  severity: string | null;
};

export type Status = {
  home: { lat: number; lon: number; label: string };
  radii: { urgent: number; email: number; dashboard: number };
  hotspots_24h: number;
  hotspots_24h_within_urgent: number;
  latest_hotspot_at: string | null;
  active_alerts: number;
};

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`);
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
  return r.json();
}

export const api = {
  status: () => getJson<Status>("/api/status"),
  hotspots: (sinceHours = 168) =>
    getJson<{ count: number; hotspots: Hotspot[] }>(
      `/api/hotspots?since_hours=${sinceHours}`,
    ),
  alerts: () => getJson<{ count: number; alerts: NwsAlert[] }>("/api/alerts"),
};
