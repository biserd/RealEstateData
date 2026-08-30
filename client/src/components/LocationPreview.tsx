import { useId } from "react";
import { Building2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LocationPreviewMarker {
  lat: number;
  lng: number;
  color?: string;
  label?: string;
}

interface LocationPreviewProps {
  center?: { lat: number; lng: number } | null;
  markers?: LocationPreviewMarker[];
  address?: string | null;
  width?: number;
  height?: number;
  zoom?: number;
  className?: string;
  rounded?: boolean;
  variant?: "map" | "property";
  alt?: string;
}

const palette: Record<string, string> = {
  red: "#dc2626",
  blue: "#2563eb",
  green: "#16a34a",
  orange: "#ea580c",
  purple: "#9333ea",
  gray: "#64748b",
};

function isCoordinate(value: number): boolean {
  return Number.isFinite(value);
}

/**
 * A deterministic, application-owned location visual. It intentionally is not
 * a geographic basemap: no Google imagery, tiles, or API request is involved.
 * Relative marker positions are derived from coordinates already returned by
 * the application API.
 */
export function LocationPreview({
  center,
  markers = [],
  address,
  width = 640,
  height = 360,
  zoom = 15,
  className,
  rounded = true,
  variant = "map",
  alt = "Location preview",
}: LocationPreviewProps) {
  const previewId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const validMarkers = markers.filter(
    (marker) => isCoordinate(marker.lat) && isCoordinate(marker.lng),
  );
  const effectiveCenter =
    center && isCoordinate(center.lat) && isCoordinate(center.lng)
      ? center
      : validMarkers[0]
        ? { lat: validMarkers[0].lat, lng: validMarkers[0].lng }
        : null;

  if (!effectiveCenter) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          rounded && "rounded-lg",
          className,
        )}
        style={{ aspectRatio: `${width} / ${height}` }}
        data-testid="location-preview-empty"
      >
        {variant === "property" ? (
          <Building2 className="h-10 w-10 opacity-50" />
        ) : (
          <MapPin className="h-10 w-10 opacity-50" />
        )}
      </div>
    );
  }

  const canvasWidth = 640;
  const canvasHeight = 360;
  const longitudeScale = Math.max(
    0.2,
    Math.cos((effectiveCenter.lat * Math.PI) / 180),
  );
  const zoomSpan = Math.max(0.0025, 360 / 2 ** Math.max(1, Math.min(21, zoom)));
  const markerExtent = validMarkers.reduce(
    (extent, marker) =>
      Math.max(
        extent,
        Math.abs(marker.lat - effectiveCenter.lat),
        Math.abs(marker.lng - effectiveCenter.lng) * longitudeScale,
      ),
    0,
  );
  const span = Math.max(zoomSpan, markerExtent * 2.5, 0.003);

  const points = validMarkers.slice(0, 100).map((marker, index) => ({
    ...marker,
    index,
    x: Math.max(
      28,
      Math.min(
        canvasWidth - 28,
        canvasWidth / 2 +
          ((marker.lng - effectiveCenter.lng) * longitudeScale * canvasWidth) /
            span,
      ),
    ),
    y: Math.max(
      28,
      Math.min(
        canvasHeight - 54,
        canvasHeight / 2 -
          ((marker.lat - effectiveCenter.lat) * canvasHeight) / span,
      ),
    ),
  }));

  if (points.length === 0) {
    points.push({
      lat: effectiveCenter.lat,
      lng: effectiveCenter.lng,
      color: "blue",
      label: undefined,
      index: 0,
      x: canvasWidth / 2,
      y: canvasHeight / 2,
    });
  }

  const coordinateLabel = `${effectiveCenter.lat.toFixed(4)}, ${effectiveCenter.lng.toFixed(4)}`;

  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        "relative h-full w-full overflow-hidden bg-slate-100 dark:bg-slate-900",
        rounded && "rounded-lg",
        className,
      )}
      style={{ aspectRatio: `${width} / ${height}` }}
      data-testid="location-preview"
    >
      <svg
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        className="h-full w-full"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id={`${previewId}-bg`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#eff6ff" />
            <stop offset="0.52" stopColor="#e2e8f0" />
            <stop offset="1" stopColor="#dcfce7" />
          </linearGradient>
          <pattern id={`${previewId}-grid`} width="44" height="44" patternUnits="userSpaceOnUse">
            <path d="M 44 0 L 0 0 0 44" fill="none" stroke="#94a3b8" strokeOpacity="0.18" strokeWidth="1" />
          </pattern>
          <filter id={`${previewId}-shadow`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.28" />
          </filter>
        </defs>
        <rect width={canvasWidth} height={canvasHeight} fill={`url(#${previewId}-bg)`} />
        <rect width={canvasWidth} height={canvasHeight} fill={`url(#${previewId}-grid)`} />
        <path d="M-30 290 C120 210 185 245 315 168 S530 120 680 42" fill="none" stroke="#ffffff" strokeOpacity="0.88" strokeWidth="18" />
        <path d="M72 -20 C150 70 220 90 285 155 S420 285 600 390" fill="none" stroke="#ffffff" strokeOpacity="0.72" strokeWidth="10" />
        <path d="M-20 88 C135 112 235 66 350 90 S520 185 680 166" fill="none" stroke="#cbd5e1" strokeOpacity="0.8" strokeWidth="5" />
        {points.map((point) => {
          const fill = palette[String(point.color || "red").toLowerCase()] || palette.red;
          return (
            <g key={`${point.lat}-${point.lng}-${point.index}`} transform={`translate(${point.x} ${point.y})`} filter={`url(#${previewId}-shadow)`}>
              <path d="M0 19 C-4 12 -11 5 -11 -5 A11 11 0 1 1 11 -5 C11 5 4 12 0 19Z" fill={fill} stroke="#ffffff" strokeWidth="3" />
              {point.label ? (
                <text x="0" y="-1" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="700">
                  {String(point.label).slice(0, 2)}
                </text>
              ) : (
                <circle cx="0" cy="-5" r="3.2" fill="#ffffff" />
              )}
            </g>
          );
        })}
      </svg>

      <div className="absolute left-3 top-3 rounded-full border bg-background/90 px-3 py-1 text-xs font-medium shadow-sm backdrop-blur">
        Static location preview
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent px-4 pb-3 pt-10 text-white">
        {address && <p className="truncate text-sm font-medium">{address}</p>}
        <p className="text-xs text-white/75">{coordinateLabel} · {points.length} {points.length === 1 ? "location" : "locations"}</p>
      </div>
    </div>
  );
}
