import { useEffect, useMemo, useRef, useState } from "react";
import type { Hotspot } from "../api";

type Props = {
  // Number of hours back from "now" the slider should span.
  windowHours: number;
  // Selected position in hours back from now (0 = now, windowHours = oldest).
  hoursBack: number;
  onChange: (hoursBack: number) => void;
  // Width of the trailing window the user wants visible at any frame.
  trailHours: number;
  onTrailChange: (trail: number) => void;
  // Show every hotspot regardless of the slider position.
  showAll: boolean;
  onShowAllChange: (v: boolean) => void;
  // For activity tick marks under the scrubber.
  hotspots: Hotspot[];
};

const TICK_BINS = 60; // resolution of the activity heatmap under the scrubber

export default function Timeline({
  windowHours,
  hoursBack,
  onChange,
  trailHours,
  onTrailChange,
  showAll,
  onShowAllChange,
  hotspots,
}: Props) {
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  // Bucket hotspots into TICK_BINS time bins so we can paint activity ticks
  // under the scrubber. Index 0 = oldest, last = now.
  const bins = useMemo(() => {
    const counts = new Array<number>(TICK_BINS).fill(0);
    const now = Date.now();
    const windowMs = windowHours * 3_600_000;
    const start = now - windowMs;
    for (const h of hotspots) {
      const t = new Date(h.acq_datetime).getTime();
      if (t < start || t > now) continue;
      const idx = Math.min(
        TICK_BINS - 1,
        Math.floor(((t - start) / windowMs) * TICK_BINS),
      );
      counts[idx]++;
    }
    const peak = Math.max(1, ...counts);
    return { counts, peak };
  }, [hotspots, windowHours]);

  // Auto-advance: walk the slider from oldest -> now over ~25 seconds, then stop.
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    lastTickRef.current = performance.now();
    const tick = (t: number) => {
      const dt = (t - lastTickRef.current) / 1000;
      lastTickRef.current = t;
      // Advance "back-pointer" toward 0 (now). 25s sweep across the window.
      const next = Math.max(0, hoursBack - (windowHours / 25) * dt);
      onChange(next);
      if (next <= 0) {
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, windowHours, hoursBack, onChange]);

  const label = useMemo(() => {
    const ts = new Date(Date.now() - hoursBack * 3_600_000);
    return ts.toLocaleString();
  }, [hoursBack]);

  // Click on a tick to jump the slider there.
  const onTickClick = (binIdx: number) => {
    const fractionFromOldest = (binIdx + 0.5) / TICK_BINS;
    const hoursFromOldest = fractionFromOldest * windowHours;
    onChange(windowHours - hoursFromOldest);
  };

  return (
    <div className="timeline">
      <div className="timeline-row">
        <button
          className="play-btn"
          onClick={() => {
            if (hoursBack <= 0) onChange(windowHours);
            setPlaying((p) => !p);
          }}
          aria-label={playing ? "Pause replay" : "Play replay"}
          title={playing ? "Pause" : "Play radar-style replay"}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <div className="scrubber">
          <div className="ticks" aria-hidden="true">
            {bins.counts.map((n, i) => (
              <button
                key={i}
                type="button"
                className={`tick ${n > 0 ? "tick-on" : ""}`}
                style={{ height: n > 0 ? `${4 + (n / bins.peak) * 16}px` : "2px" }}
                title={n > 0 ? `${n} detection${n === 1 ? "" : "s"}` : ""}
                onClick={() => n > 0 && onTickClick(i)}
                tabIndex={n > 0 ? 0 : -1}
              />
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={windowHours}
            step={0.5}
            value={windowHours - hoursBack}
            onChange={(e) => onChange(windowHours - parseFloat(e.target.value))}
            disabled={showAll}
            aria-label="Timeline scrubber"
          />
        </div>
        <div className="timeline-label">{label}</div>
      </div>
      <div className="timeline-row sub">
        <label className="show-all">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => onShowAllChange(e.target.checked)}
          />
          Show all
        </label>
        <label>
          Trail&nbsp;
          <select
            value={trailHours}
            onChange={(e) => onTrailChange(parseFloat(e.target.value))}
            disabled={showAll}
          >
            <option value={3}>3 h</option>
            <option value={12}>12 h</option>
            <option value={24}>24 h</option>
            <option value={48}>48 h</option>
            <option value={120}>5 d</option>
          </select>
        </label>
        <span className="muted hide-mobile">
          Tap a tick to jump to that moment, or hit ▶ for radar-style replay.
        </span>
      </div>
    </div>
  );
}
