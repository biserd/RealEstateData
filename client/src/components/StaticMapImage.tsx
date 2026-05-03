import { useState } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface MapMarker {
  lat: number;
  lng: number;
  color?: string;
  label?: string;
}

interface StaticMapImageProps {
  center?: { lat: number; lng: number } | null;
  zoom?: number;
  markers?: MapMarker[];
  width?: number;
  height?: number;
  mapType?: "roadmap" | "satellite" | "hybrid" | "terrain";
  className?: string;
  alt?: string;
  rounded?: boolean;
  loading?: "lazy" | "eager";
}

export function StaticMapImage({
  center,
  zoom = 15,
  markers = [],
  width = 640,
  height = 360,
  mapType = "roadmap",
  className,
  alt = "Map view",
  rounded = true,
  loading = "lazy",
}: StaticMapImageProps) {
  const [errored, setErrored] = useState(false);

  const validMarkers = markers.filter(
    (m) => m.lat !== null && m.lng !== null && !Number.isNaN(m.lat) && !Number.isNaN(m.lng),
  );
  const hasCenter = center && !Number.isNaN(center.lat) && !Number.isNaN(center.lng);

  // Determine an effective center: explicit center wins, else first marker
  const effective = hasCenter
    ? { lat: center!.lat, lng: center!.lng }
    : validMarkers.length > 0
      ? { lat: validMarkers[0].lat, lng: validMarkers[0].lng }
      : null;

  if (!effective || errored) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          rounded && "rounded-lg",
          className,
        )}
        style={{ aspectRatio: `${width} / ${height}` }}
        data-testid="img-staticmap-fallback"
      >
        <MapPin className="h-10 w-10 opacity-50" />
      </div>
    );
  }

  const reqW = Math.min(width, 640);
  const reqH = Math.min(height, 640);
  const markerColor = validMarkers[0]?.color || "red";

  const params = new URLSearchParams({
    lat: String(effective.lat),
    lng: String(effective.lng),
    zoom: String(zoom),
    w: String(reqW),
    h: String(reqH),
    maptype: mapType,
    marker: markerColor,
  });
  const src = `/api/img/staticmap?${params.toString()}`;

  return (
    <img
      src={src}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      alt={alt}
      className={cn(
        "w-full h-full object-cover",
        rounded && "rounded-lg",
        className,
      )}
      onError={() => setErrored(true)}
      data-testid="img-staticmap"
    />
  );
}
