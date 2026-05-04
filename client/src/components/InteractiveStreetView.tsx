import { useEffect, useRef, useState } from "react";
import { Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import { MapProvider, useMap } from "@/components/MapProvider";
import { StreetViewImage } from "@/components/StreetViewImage";
import { Button } from "@/components/ui/button";

interface InteractiveStreetViewProps {
  lat: number | null | undefined;
  lng: number | null | undefined;
  address?: string | null;
  className?: string;
  rounded?: boolean;
}

// P-03: Until the visitor clicks "Explore", render only the cached static
// Street View image (no Maps JS). Once activated, mount a local MapProvider
// so the panorama bundle is fetched on demand for that single component.
export function InteractiveStreetView(props: InteractiveStreetViewProps) {
  const [activated, setActivated] = useState(false);

  if (!activated) {
    return <StaticStreetView {...props} onActivate={() => setActivated(true)} />;
  }

  return (
    <MapProvider>
      <ActivePanorama {...props} />
    </MapProvider>
  );
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

function ActivePanorama({
  lat,
  lng,
  address,
  className,
  rounded = false,
}: InteractiveStreetViewProps) {
  const { isLoaded } = useMap();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panoRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const [noPanorama, setNoPanorama] = useState(false);

  const hasCoords = isValidLatLng(lat, lng);

  useEffect(() => {
    if (!isLoaded || !hasCoords || !containerRef.current) return;
    const position = { lat: Number(lat), lng: Number(lng) };

    const svService = new google.maps.StreetViewService();
    svService.getPanorama(
      { location: position, radius: 50, source: google.maps.StreetViewSource.OUTDOOR },
      (data, status) => {
        if (status !== google.maps.StreetViewStatus.OK || !data?.location) {
          setNoPanorama(true);
          return;
        }
        const heading = google.maps.geometry?.spherical
          ? google.maps.geometry.spherical.computeHeading(
              data.location.latLng!,
              new google.maps.LatLng(position),
            )
          : 0;

        panoRef.current = new google.maps.StreetViewPanorama(containerRef.current!, {
          position: data.location.latLng!,
          pov: { heading, pitch: 0 },
          zoom: 0,
          addressControl: false,
          fullscreenControl: true,
          motionTracking: false,
          motionTrackingControl: false,
          enableCloseButton: false,
          panControl: true,
          zoomControl: true,
        });
      },
    );

    return () => {
      panoRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [isLoaded, hasCoords, lat, lng]);

  if (noPanorama) {
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
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full h-full",
        rounded && "rounded-lg overflow-hidden",
        className,
      )}
      data-testid="streetview-panorama-interactive"
      aria-label={address ? `Interactive street view of ${address}` : "Interactive street view"}
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
