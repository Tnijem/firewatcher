import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  // Number of hours back from "now" the slider should span.
  windowHours: number;
  // Selected position in hours back from now (0 = now, windowHours = oldest).
  hoursBack: number;
  onChange: (hoursBack: number) => void;
  // Width of the trailing window the user wants visible at any frame.
  trailHours: number;
  onTrailChange: (trail: number) => void;
};

export default function Timeline({
  windowHours,
  hoursBack,
  onChange,
  trailHours,
  onTrailChange,
}: Props) {
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

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

  return (
    <div className="timeline">
      <div className="timeline-row">
        <button
          className="play-btn"
          onClick={() => {
            if (hoursBack <= 0) onChange(windowHours);
            setPlaying((p) => !p);
          }}
          title={playing ? "Pause" : "Play radar-style replay"}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <input
          type="range"
          min={0}
          max={windowHours}
          step={0.5}
          value={windowHours - hoursBack}
          onChange={(e) => onChange(windowHours - parseFloat(e.target.value))}
          style={{ flex: 1 }}
        />
        <div className="timeline-label">{label}</div>
      </div>
      <div className="timeline-row sub">
        <label>
          Trail window&nbsp;
          <select
            value={trailHours}
            onChange={(e) => onTrailChange(parseFloat(e.target.value))}
          >
            <option value={3}>3 h</option>
            <option value={12}>12 h</option>
            <option value={24}>24 h</option>
            <option value={48}>48 h</option>
            <option value={120}>5 d</option>
          </select>
        </label>
        <span className="muted">
          Drag the slider to scrub through the last {Math.round(windowHours / 24)} days.
          Older detections fade; newer ones glow.
        </span>
      </div>
    </div>
  );
}
