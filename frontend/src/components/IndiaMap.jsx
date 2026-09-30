import { MapContainer, TileLayer, CircleMarker, Tooltip as LTooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

const SEV_COLOR = {
  low: "#10B981",
  moderate: "#F59E0B",
  high: "#F97316",
  critical: "#EF4444",
};

function Recenter({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points && points.length) {
      const lats = points.map((p) => p.lat);
      const lngs = points.map((p) => p.lng);
      const bounds = [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ];
      try { map.fitBounds(bounds, { padding: [30, 30], maxZoom: 7 }); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points?.map((p) => p.id))]);
  return null;
}

export function IndiaMap({ points, onSelect, valueLabel, height = 460 }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200" style={{ height }}>
      <MapContainer center={[22.5, 80]} zoom={5} style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true} attributionControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Recenter points={points} />
        {points.map((p) => {
          const color = SEV_COLOR[p.severity] || "#64748B";
          const radius = Math.max(7, Math.min(22, 7 + (p.phc_count || 3) / 4));
          return (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={radius}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.55, weight: 1.5 }}
              eventHandlers={{ click: () => onSelect && onSelect(p) }}
            >
              <LTooltip direction="top" offset={[0, -4]}>
                <div className="text-xs">
                  <div className="font-semibold text-slate-800">{p.name}</div>
                  <div className="text-slate-500">{valueLabel}: <b>{p.metric_value}</b></div>
                  <div className="capitalize text-slate-500">Severity: {p.severity}</div>
                </div>
              </LTooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}

export const MAP_SEV_COLOR = SEV_COLOR;
