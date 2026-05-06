import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Hotspot, Status } from "../api";
import {
  bearingDeg,
  brightnessLabel,
  compass,
  confidenceLabel,
  relTimeFromNow,
  severityFromFrp,
  sourceLabel,
} from "../utils/format";

type Props = {
  hotspots: Hotspot[];
  status: Status | null;
};

// Color the dot by recency: brighter = more recent.
function ageColor(ageHours: number): string {
  if (ageHours < 6) return "#ff2d2d";   // red — fresh
  if (ageHours < 24) return "#ff8800";  // orange
  if (ageHours < 48) return "#ffcc00";  // yellow
  if (ageHours < 96) return "#9c6";     // greenish
  return "#888";                         // older still
}

function radiusFor(frp: number | null): number {
  // Fire Radiative Power in MW — bigger circle for hotter pixels.
  if (frp == null) return 4;
  if (frp > 50) return 12;
  if (frp > 20) return 9;
  if (frp > 5) return 6;
  return 4;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
  ));
}

export default function FireMap({ hotspots, status }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);

  // Init map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const home: [number, number] = status
      ? [status.home.lon, status.home.lat]
      : [-83.369, 31.0381];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: home,
      zoom: 8.5,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "imperial" }), "bottom-left");
    map.on("load", () => {
      setReady(true);
      // Draw radius circles around home as a GeoJSON source + 3 line layers.
      const radii = status?.radii ?? { urgent: 25, email: 50, dashboard: 75 };
      const features = [
        circleFeature(home, radii.urgent, "urgent"),
        circleFeature(home, radii.email, "email"),
        circleFeature(home, radii.dashboard, "dashboard"),
      ];
      map.addSource("radii", { type: "geojson", data: { type: "FeatureCollection", features } });
      map.addLayer({
        id: "radii-line",
        type: "line",
        source: "radii",
        paint: {
          "line-color": [
            "match",
            ["get", "tier"],
            "urgent", "#d62828",
            "email", "#f77f00",
            "dashboard", "#999",
            "#999",
          ],
          "line-width": 1.5,
          "line-dasharray": [3, 3],
        },
      });

      // Home marker.
      new maplibregl.Marker({ color: "#1e40af" })
        .setLngLat(home)
        .setPopup(new maplibregl.Popup().setText(status?.home.label ?? "Home"))
        .addTo(map);
    });
    mapRef.current = map;
  }, [status]);

  // Render hotspot markers whenever the filtered set changes (and the map is ready).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const now = Date.now();
    for (const h of hotspots) {
      const ageHours = (now - new Date(h.acq_datetime).getTime()) / 3_600_000;
      const el = document.createElement("div");
      const r = radiusFor(h.frp);
      el.style.cssText = `
        width:${r * 2}px;height:${r * 2}px;border-radius:50%;
        background:${ageColor(ageHours)};
        border:1.5px solid rgba(0,0,0,0.4);
        box-shadow:0 0 6px ${ageColor(ageHours)}aa;
        cursor:pointer;
      `;
      const sev = severityFromFrp(h.frp);
      const home = status?.home;
      const dir = home ? compass(bearingDeg(home.lat, home.lon, h.latitude, h.longitude)) : "";
      const homeLabel = home?.label ?? "home";
      const popup = new maplibregl.Popup({ offset: r + 4, maxWidth: "280px" }).setHTML(`
        <div class="hs-popup">
          <div class="hs-popup-head" style="color:${sev.color}">
            ${sev.emoji} ${escapeHtml(sev.label)}
          </div>
          <div class="hs-popup-blurb">${escapeHtml(sev.blurb)}</div>
          <div class="hs-popup-where">
            <b>${h.distance_mi.toFixed(1)} mi</b> ${dir} of ${escapeHtml(homeLabel)}
          </div>
          <div class="hs-popup-when">
            ${escapeHtml(new Date(h.acq_datetime).toLocaleString())}
            <span class="muted">· ${escapeHtml(relTimeFromNow(h.acq_datetime))}</span>
          </div>
          <dl class="hs-popup-stats">
            <dt title="Energy radiated by the hot pixel — best proxy for fire size.">Heat output (FRP)</dt>
            <dd>${h.frp != null ? h.frp.toFixed(1) + " MW" : "—"}</dd>
            <dt title="Temperature of the hot pixel. Background land is ~290–310 K.">Pixel temperature</dt>
            <dd>${escapeHtml(brightnessLabel(h.brightness))}</dd>
            <dt title="How sure the satellite is this is real fire vs. a false positive.">Confidence</dt>
            <dd>${escapeHtml(confidenceLabel(h.confidence, h.source))}</dd>
          </dl>
          <div class="hs-popup-source muted">${escapeHtml(sourceLabel(h.source))}</div>
        </div>
      `);
      const m = new maplibregl.Marker({ element: el })
        .setLngLat([h.longitude, h.latitude])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(m);
    }
  }, [hotspots, status, ready]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

// Build a polygon approximating a circle at given lat/lon with radius in miles.
function circleFeature(
  center: [number, number],
  radiusMi: number,
  tier: string,
  steps = 96,
): GeoJSON.Feature {
  const [lon, lat] = center;
  const R = 3958.7613;
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 2 * Math.PI;
    const lat1 = (lat * Math.PI) / 180;
    const lon1 = (lon * Math.PI) / 180;
    const angDist = radiusMi / R;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angDist) +
        Math.cos(lat1) * Math.sin(angDist) * Math.cos(bearing),
    );
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angDist) * Math.cos(lat1),
        Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat2),
      );
    coords.push([(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return {
    type: "Feature",
    properties: { tier, radiusMi },
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}
