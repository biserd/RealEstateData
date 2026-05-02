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
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const [errored, setErrored] = useState(false);

  const hasCoords =
    lat !== null && lat !== undefined && lng !== null && lng !== undefined && !Number.isNaN(lat) && !Number.isNaN(lng);

  if (!apiKey || !hasCoords || errored) {
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

  const params = new URLSearchParams({
    size: `${width}x${height}`,
    location: `${lat},${lng}`,
    fov: "80",
    pitch: "0",
    key: apiKey,
  });
  const src = `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;

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
      onError={() => setErrored(true)}
      data-testid="img-streetview"
    />
  );
}
