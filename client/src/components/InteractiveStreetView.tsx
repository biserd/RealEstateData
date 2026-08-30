import { useState } from "react";
import { Compass, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { StreetViewImage } from "@/components/StreetViewImage";
import { Button } from "@/components/ui/button";

interface InteractiveStreetViewProps {
  lat: number | null | undefined;
  lng: number | null | undefined;
  address?: string | null;
  className?: string;
  rounded?: boolean;
}

// The default state is application-rendered and makes no Google request. After
// an explicit click, use Maps Embed Street View instead of a billed Dynamic
// Street View JavaScript panorama.
export function InteractiveStreetView(props: InteractiveStreetViewProps) {
  const [activated, setActivated] = useState(false);

  if (!activated) {
    return <StaticStreetView {...props} onActivate={() => setActivated(true)} />;
  }

  return <EmbeddedPanorama {...props} />;
}

interface StaticStreetViewProps extends InteractiveStreetViewProps {
  onActivate: () => void;
}

function StaticStreetView({
  lat,
  lng,
  address,
  className,
  rounded = false,
  onActivate,
}: StaticStreetViewProps) {
  const hasCoords = isValidLatLng(lat, lng);
  return (
    <div
      className={cn(
        "relative w-full h-full",
        rounded && "rounded-lg overflow-hidden",
        className,
      )}
    >
      <StreetViewImage
        lat={lat}
        lng={lng}
        address={address}
        width={1200}
        height={500}
        loading="lazy"
        rounded={false}
        className="w-full h-full"
      />
      {hasCoords && (
        <div className="absolute bottom-3 right-3">
          <Button
            size="sm"
            variant="default"
            onClick={onActivate}
            data-testid="button-streetview-explore"
          >
            <Compass className="h-4 w-4" />
            Explore in Street View
          </Button>
        </div>
      )}
    </div>
  );
}

function EmbeddedPanorama({
  lat,
  lng,
  address,
  className,
  rounded = false,
}: InteractiveStreetViewProps) {
  const hasCoords = isValidLatLng(lat, lng);
  const embedKey = import.meta.env.VITE_GOOGLE_MAPS_EMBED_API_KEY || "";

  if (!hasCoords || !embedKey) {
    const mapsUrl = hasCoords
      ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${Number(lat)},${Number(lng)}`
      : null;
    return (
      <div
        className={cn(
          "relative w-full h-full",
          rounded && "rounded-lg overflow-hidden",
          className,
        )}
      >
        <StreetViewImage
          lat={lat}
          lng={lng}
          address={address}
          width={1200}
          height={500}
          loading="lazy"
          rounded={false}
          className="w-full h-full"
        />
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="absolute bottom-3 right-3"
            data-testid="link-streetview-external"
          >
            <Button size="sm" variant="default">
              <ExternalLink className="h-4 w-4" />
              Open Street View
            </Button>
          </a>
        )}
      </div>
    );
  }

  const params = new URLSearchParams({
    key: embedKey,
    location: `${Number(lat)},${Number(lng)}`,
    heading: "0",
    pitch: "0",
    fov: "80",
  });

  return (
    <iframe
      src={`https://www.google.com/maps/embed/v1/streetview?${params.toString()}`}
      className={cn(
        "h-full w-full border-0",
        rounded && "rounded-lg overflow-hidden",
        className,
      )}
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
      title={address ? `Interactive street view of ${address}` : "Interactive street view"}
      data-testid="streetview-embed-interactive"
    />
  );
}

function isValidLatLng(
  lat: number | null | undefined,
  lng: number | null | undefined,
): boolean {
  return (
    lat !== null &&
    lat !== undefined &&
    lng !== null &&
    lng !== undefined &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng)
  );
}
