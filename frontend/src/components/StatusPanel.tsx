import { useState } from "react";
import type { NwsAlert, Status } from "../api";

export default function StatusPanel({
  status,
  alerts,
  visibleCount,
}: {
  status: Status | null;
  alerts: NwsAlert[];
  visibleCount: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (!status) return <div className="panel">Loading…</div>;
  const closeCount = status.hotspots_24h_within_urgent;
  const overall = closeCount > 0 ? "alert" : alerts.length > 0 ? "warn" : "ok";
  return (
    <div className={`panel panel-${overall} ${collapsed ? "panel-collapsed" : ""}`}>
      <div
        className="panel-title"
        onClick={() => setCollapsed((c) => !c)}
        role="button"
        tabIndex={0}
      >
        <span className="dot" />
        <span className="panel-title-text">Firewatcher — {status.home.label}</span>
        <span className="panel-toggle">{collapsed ? "▾" : "▴"}</span>
      </div>
      {!collapsed && <>

      <div className="panel-grid">
        <Stat label={`Hotspots within ${status.radii.urgent} mi (24h)`} value={closeCount} hl={closeCount > 0} />
        <Stat label="Hotspots in coverage area (24h)" value={status.hotspots_24h} />
        <Stat label="Visible on map" value={visibleCount} />
        <Stat label="Active fire-weather alerts" value={alerts.length} hl={alerts.length > 0} />
      </div>
      {alerts.length > 0 && (
        <ul className="alerts">
          {alerts.map((a) => (
            <li key={a.id}>
              <b>{a.event}</b> — {a.headline ?? a.zones}
            </li>
          ))}
        </ul>
      )}
      <div className="panel-foot muted">
        Last detection:{" "}
        {status.latest_hotspot_at
          ? new Date(status.latest_hotspot_at).toLocaleString()
          : "none yet"}
      </div>
      </>}
    </div>
  );
}

function Stat({ label, value, hl }: { label: string; value: number; hl?: boolean }) {
  return (
    <div className={`stat ${hl ? "stat-hl" : ""}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
