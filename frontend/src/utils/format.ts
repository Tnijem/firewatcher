// Translate raw FIRMS values into things a person can read.

export type Severity = {
  emoji: string;
  label: string;
  color: string;
  blurb: string;
};

// Bucket by Fire Radiative Power (megawatts of energy radiated by the hot pixel).
// FRP is the best proxy for "how big is this thing" since pixel-temp can saturate.
export function severityFromFrp(frp: number | null | undefined): Severity {
  if (frp == null) {
    return { emoji: "🔥", label: "Heat detection", color: "#9ca3af", blurb: "Satellite saw a hot pixel" };
  }
  if (frp < 5) return {
    emoji: "🔥",
    label: "Small heat source",
    color: "#60a5fa",
    blurb: "Burn pile, controlled burn, or industrial heat",
  };
  if (frp < 20) return {
    emoji: "🔥",
    label: "Small fire",
    color: "#fbbf24",
    blurb: "Small ground fire or established controlled burn",
  };
  if (frp < 100) return {
    emoji: "🔥🔥",
    label: "Moderate fire",
    color: "#f97316",
    blurb: "Active fire with notable heat output",
  };
  return {
    emoji: "🔥🔥🔥",
    label: "Large fire",
    color: "#dc2626",
    blurb: "High-intensity fire — worth watching closely",
  };
}

// VIIRS uses letter codes; MODIS uses 0–100.
export function confidenceLabel(c: string | null, source: string): string {
  if (c == null || c === "") return "—";
  if (source.startsWith("MODIS")) {
    const n = Number(c);
    if (Number.isNaN(n)) return c;
    if (n < 30) return `Low (${n}%) — possibly false positive`;
    if (n < 80) return `Nominal (${n}%) — likely real`;
    return `High (${n}%) — very likely real`;
  }
  // VIIRS
  if (c === "l") return "Low — possibly false positive";
  if (c === "n") return "Nominal — likely real";
  if (c === "h") return "High — very likely real";
  return c;
}

export function sourceLabel(src: string): string {
  if (src.startsWith("VIIRS_SNPP")) return "VIIRS · Suomi NPP satellite";
  if (src.startsWith("VIIRS_NOAA20")) return "VIIRS · NOAA-20 satellite";
  if (src.startsWith("VIIRS_NOAA21")) return "VIIRS · NOAA-21 satellite";
  if (src.startsWith("MODIS")) return "MODIS · Aqua/Terra satellite";
  return src;
}

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                 "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function compass(bearingDegrees: number): string {
  return COMPASS[Math.round(bearingDegrees / 22.5) % 16];
}

export function relTimeFromNow(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "in the future";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 36) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const d = Math.round(hr / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

// Brightness comes in Kelvin. Background land surface in this region is
// typically ~290–310 K — anything well above that is the "fire" signal.
export function brightnessLabel(k: number | null): string {
  if (k == null) return "—";
  const c = Math.round(k - 273.15);
  return `${k.toFixed(0)} K (≈${c}°C / ${Math.round(c * 9 / 5 + 32)}°F)`;
}
