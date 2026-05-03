import { useEffect, useRef, useState } from "react";
import { Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMap } from "@/components/MapProvider";
import { StreetViewImage } from "@/components/StreetViewImage";
import { Button } from "@/components/ui/button";

interface InteractiveStreetViewProps {
  lat: number | null | undefined;
  lng: number | null | undefined;
  address?: string | null;
  className?: string;
  rounded?: boolean;
}

export function InteractiveStreetView({
  lat,
  lng,
  address,
  className,
  rounded = false,
}: InteractiveStreetViewProps) {
  const { isLoaded } = useMap();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panoRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const [activated, setActivated] = useState(false);
  const [noPanorama, setNoPanorama] = useState(false);

  const hasCoords =
    lat !== null &&
    lat !== undefined &&
    lng !== null &&
    lng !== undefined &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng);

  useEffect(() => {
    if (!activated || !isLoaded || !hasCoords || !containerRef.current) return;
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
  }, [activated, isLoaded, hasCoords, lat, lng]);

  // Until the user clicks "Explore", show the cached static image with an overlay button.
  // This avoids loading the (paid) Street View Panorama for visitors who never interact.
  if (!activated || noPanorama) {
    return (
      <div className={cn("relative w-full h-full", rounded && "rounded-lg overflow-hidden", className)}>
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
        {!noPanorama && hasCoords && isLoaded && (
          <div className="absolute bottom-3 right-3">
            <Button
              size="sm"
              variant="default"
              onClick={() => setActivated(true)}
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

  return (
    <div
      ref={containerRef}
      className={cn("w-full h-full", rounded && "rounded-lg overflow-hidden", className)}
      data-testid="streetview-panorama-interactive"
      aria-label={address ? `Interactive street view of ${address}` : "Interactive street view"}
    />
  );
}
