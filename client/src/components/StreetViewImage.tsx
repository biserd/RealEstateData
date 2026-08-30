import { LocationPreview } from "@/components/LocationPreview";

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
  void loading;

  const hasCoords =
    lat !== null && lat !== undefined && lng !== null && lng !== undefined && !Number.isNaN(lat) && !Number.isNaN(lng);

  return (
    <LocationPreview
      center={hasCoords ? { lat: Number(lat), lng: Number(lng) } : null}
      markers={hasCoords ? [{ lat: Number(lat), lng: Number(lng), color: "blue" }] : []}
      address={address}
      width={width}
      height={height}
      zoom={17}
      alt={alt || (address ? `Location preview of ${address}` : "Location preview")}
      className={className}
      rounded={rounded}
      variant="property"
    />
  );
}
