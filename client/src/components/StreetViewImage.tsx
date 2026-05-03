import { useState } from "react";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreetViewImageProps {
  lat: number | null | undefined;
  lng: number | null | undefined;
  address?: string | null;
  width?: number;
  height?: number;
  className?: string;
  alt?: string;
  rounded?: boolean;
  loading?: "lazy" | "eager";
}

export function StreetViewImage({
  lat,
  lng,
  address,
  width = 640,
  height = 360,
  className,
  alt,
  rounded = true,
  loading = "lazy",
}: StreetViewImageProps) {
  const [streetErrored, setStreetErrored] = useState(false);
  const [mapErrored, setMapErrored] = useState(false);

  const hasCoords =
    lat !== null && lat !== undefined && lng !== null && lng !== undefined && !Number.isNaN(lat) && !Number.isNaN(lng);

  if (!hasCoords || mapErrored) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          rounded && "rounded-lg",
          className,
        )}
        style={{ aspectRatio: `${width} / ${height}` }}
        data-testid="img-streetview-fallback"
      >
        <Building2 className="h-10 w-10 opacity-50" />
      </div>
    );
  }

  const reqW = Math.min(width, 640);
  const reqH = Math.min(height, 640);

  if (streetErrored) {
    const mapSrc = `/api/img/staticmap?lat=${lat}&lng=${lng}&zoom=17&w=${reqW}&h=${reqH}&marker=red`;
    return (
      <img
        src={mapSrc}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        alt={alt || (address ? `Map view of ${address}` : "Map view")}
        className={cn(
          "w-full h-full object-cover",
          rounded && "rounded-lg",
          className,
        )}
        onError={() => setMapErrored(true)}
        data-testid="img-streetview-map-fallback"
      />
    );
  }

  const src = `/api/img/streetview?lat=${lat}&lng=${lng}&w=${reqW}&h=${reqH}`;

  return (
    <img
      src={src}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      alt={alt || (address ? `Street view of ${address}` : "Street view")}
      className={cn(
        "w-full h-full object-cover",
        rounded && "rounded-lg",
        className,
      )}
      onError={() => setStreetErrored(true)}
      data-testid="img-streetview"
    />
  );
}
