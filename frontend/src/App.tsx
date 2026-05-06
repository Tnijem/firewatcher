import { useEffect, useMemo, useState } from "react";
import AdSlot from "./components/AdSlot";
import CookieConsent from "./components/CookieConsent";
import FireMap from "./components/FireMap";
import Footer from "./components/Footer";
import StatusPanel from "./components/StatusPanel";
import Timeline from "./components/Timeline";
import { api, type Hotspot, type NwsAlert, type Status } from "./api";
import "./App.css";

const WINDOW_HOURS = 120;

export default function App() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [alerts, setAlerts] = useState<NwsAlert[]>([]);
  const [hoursBack, setHoursBack] = useState(0);
  const [trailHours, setTrailHours] = useState(24);
  const [showAll, setShowAll] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [s, h, a] = await Promise.all([api.status(), api.hotspots(WINDOW_HOURS), api.alerts()]);
        if (cancelled) return;
        setStatus(s);
        setHotspots(h.hotspots);
        setAlerts(a.alerts);
        setErr(null);
      } catch (e) {
        if (!cancelled) setErr(String(e));
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const visible = useMemo(() => {
    if (showAll) return hotspots;
    const now = Date.now();
    const endMs = now - hoursBack * 3_600_000;
    const startMs = endMs - trailHours * 3_600_000;
    return hotspots.filter((h) => {
      const t = new Date(h.acq_datetime).getTime();
      return t >= startMs && t <= endMs;
    });
  }, [hotspots, hoursBack, trailHours, showAll]);

  return (
    <div className="app">
      <div className="map-wrap">
        <FireMap hotspots={visible} status={status} />
        <div className="overlay-tl">
          <StatusPanel status={status} alerts={alerts} visibleCount={visible.length} />
        </div>
        {err && <div className="overlay-err">⚠ {err}</div>}
      </div>
      <AdSlot />
      <div className="timeline-wrap">
        <Timeline
          windowHours={WINDOW_HOURS}
          hoursBack={hoursBack}
          onChange={setHoursBack}
          trailHours={trailHours}
          onTrailChange={setTrailHours}
          showAll={showAll}
          onShowAllChange={setShowAll}
          hotspots={hotspots}
        />
        <Footer />
      </div>
      <CookieConsent />
    </div>
  );
}
