import { LocationPreview } from "@/components/LocationPreview";

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
  void mapType;
  void loading;

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

  return (
    <LocationPreview
      center={effective}
      markers={validMarkers}
      width={width}
      height={height}
      zoom={zoom}
      alt={alt}
      className={className}
      rounded={rounded}
    />
  );
}
