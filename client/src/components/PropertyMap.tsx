import { useCallback, useRef, useMemo, useState } from "react";
import { GoogleMap, Marker, InfoWindow } from "@react-google-maps/api";
import { MapProvider, useMap } from "./MapProvider";
import { StaticMapImage } from "./StaticMapImage";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bed, Bath, Square, MapPin, ExternalLink, Map as MapIcon } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { getPropertyUrl, formatPropertyAddress } from "@/lib/propertySlug";
import type { Property } from "@shared/schema";

interface PropertyMapProps {
  properties: Property[];
  subjectProperty?: Property;
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: string;
  showClustering?: boolean;
  onPropertySelect?: (property: Property) => void;
  selectedPropertyId?: string;
  getMarkerUrl?: (property: Property) => string;
  interactiveByDefault?: boolean;
}

const defaultCenter = { lat: 40.7128, lng: -74.006 };

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  styles: [
    {
      featureType: "poi",
      elementType: "labels",
      stylers: [{ visibility: "off" }],
    },
  ],
};

// P-03: Wrap the inner map in its own MapProvider so the Google Maps JS API
// is only requested on routes that actually render <PropertyMap>.
// `useJsApiLoader` is module-scoped, so multiple <MapProvider> mounts dedupe
// to a single script load.
//
// Cost optimization: by default we render a cheap cached Static Map preview
// and only mount the Maps JS API (Dynamic Maps, billed per load) once the
// user clicks "Load interactive map". Pass `interactiveByDefault` to opt out.
export function PropertyMap(props: PropertyMapProps) {
  const [activated, setActivated] = useState(!!props.interactiveByDefault);

  if (activated) {
    return (
      <MapProvider>
        <PropertyMapInner {...props} />
      </MapProvider>
    );
  }

  const height = props.height || "400px";
  const center =
    props.center ||
    (props.subjectProperty?.latitude && props.subjectProperty?.longitude
      ? { lat: props.subjectProperty.latitude, lng: props.subjectProperty.longitude }
      : props.properties.find((p) => p.latitude && p.longitude)
        ? {
            lat: props.properties.find((p) => p.latitude && p.longitude)!.latitude!,
            lng: props.properties.find((p) => p.latitude && p.longitude)!.longitude!,
          }
        : null);

  const markerCount = props.properties.filter((p) => p.latitude && p.longitude).length +
    (props.subjectProperty?.latitude && props.subjectProperty?.longitude ? 1 : 0);

  return (
    <div
      className="relative rounded-lg overflow-hidden border bg-muted"
      style={{ height }}
      data-testid="map-static-preview"
    >
      {center ? (
        <StaticMapImage
          center={center}
          zoom={props.zoom || 15}
          markers={[{ lat: center.lat, lng: center.lng, color: "blue" }]}
          width={640}
          height={400}
          className="w-full h-full"
          rounded={false}
          loading="lazy"
          alt="Map preview"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <MapIcon className="h-10 w-10 text-muted-foreground opacity-50" />
        </div>
      )}

      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
        <Button
          onClick={() => setActivated(true)}
          size="lg"
          className="shadow-xl"
          data-testid="button-activate-map"
        >
          <MapIcon className="mr-2 h-4 w-4" />
          Load interactive map
        </Button>
      </div>

      {markerCount > 0 && (
        <div className="absolute top-4 right-4 z-10">
          <Badge variant="secondary" className="shadow-lg">
            {markerCount} {markerCount === 1 ? "property" : "properties"}
          </Badge>
        </div>
      )}
    </div>
  );
}

function PropertyMapInner({
  properties,
  subjectProperty,
  center,
  zoom = 14,
  height = "400px",
  showClustering = true,
  onPropertySelect,
  selectedPropertyId,
  getMarkerUrl,
}: PropertyMapProps) {
  const { isLoaded, loadError, hasApiKey, authError } = useMap();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const validProperties = useMemo(
    () => properties.filter((p) => p.latitude && p.longitude),
    [properties]
  );

  // Always render the subject pin if it has coordinates, even when it's not
  // included in the `properties` array (e.g. the unit-detail map passes a
  // synthetic subject whose id doesn't match any nearby property, or the
  // property-detail comps map has zero comps).
  const subjectInList = useMemo(
    () => !!subjectProperty && validProperties.some((p) => p.id === subjectProperty.id),
    [subjectProperty, validProperties]
  );
  const showStandaloneSubject =
    !!subjectProperty &&
    !subjectInList &&
    !!subjectProperty.latitude &&
    !!subjectProperty.longitude;

  const allMarkers = useMemo(() => {
    if (showStandaloneSubject && subjectProperty) {
      return [subjectProperty, ...validProperties];
    }
    return validProperties;
  }, [showStandaloneSubject, subjectProperty, validProperties]);

  const mapCenter = useMemo(() => {
    if (center) return center;
    if (subjectProperty?.latitude && subjectProperty?.longitude) {
      return { lat: subjectProperty.latitude, lng: subjectProperty.longitude };
    }
    if (validProperties.length > 0) {
      const firstWithCoords = validProperties[0];
      return { lat: firstWithCoords.latitude!, lng: firstWithCoords.longitude! };
    }
    return defaultCenter;
  }, [center, subjectProperty, validProperties]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;

    if (allMarkers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      allMarkers.forEach((p) => {
        bounds.extend({ lat: p.latitude!, lng: p.longitude! });
      });
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });

      setTimeout(() => {
        const currentZoom = map.getZoom();
        if (allMarkers.length <= 10) {
          if (currentZoom !== undefined && currentZoom < 14) {
            map.setZoom(14);
          } else if (currentZoom !== undefined && currentZoom > 17) {
            map.setZoom(17);
          }
        }
      }, 100);
    }
  }, [allMarkers]);

  const onMapUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  const handleMarkerClick = useCallback((property: Property) => {
    setSelectedProperty(property);
    onPropertySelect?.(property);
  }, [onPropertySelect]);

  const getMarkerIcon = useCallback((property: Property) => {
    const isSubject = subjectProperty?.id === property.id;
    const isSelected = selectedPropertyId === property.id;

    if (isSubject) {
      // Distinctive teardrop pin for the subject property so it stands out
      // from the small circular comp markers around it.
      return {
        path: "M 0,0 C -2,-10 -12,-12 -12,-22 a 12,12 0 1,1 24,0 C 12,-12 2,-10 0,0 z",
        scale: 1.4,
        fillColor: "#2563eb",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3,
        anchor: new google.maps.Point(0, 0),
        labelOrigin: new google.maps.Point(0, -22),
      };
    }

    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 9,
      fillColor: isSelected ? "#16a34a" : "#dc2626",
      fillOpacity: 0.9,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    };
  }, [subjectProperty?.id, selectedPropertyId]);

  const formatPrice = (price: number | null) => {
    if (!price) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 75) return "text-emerald-600";
    if (score >= 50) return "text-amber-600";
    return "text-red-600";
  };

  if (!hasApiKey) {
    return (
      <Card className="flex items-center justify-center" style={{ height }}>
        <CardContent className="text-center p-6">
          <MapPin className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">Map not available</p>
          <p className="text-xs text-muted-foreground">Google Maps API key not configured</p>
        </CardContent>
      </Card>
    );
  }

  if (loadError || authError) {
    return (
      <Card className="flex items-center justify-center" style={{ height }}>
        <CardContent className="text-center p-6">
          <MapPin className="mx-auto mb-2 h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground mb-2">
            {authError ? "Map authentication failed" : "Failed to load map"}
          </p>
          <p className="text-xs text-muted-foreground">
            Please check Google Maps API configuration in Google Cloud Console
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!isLoaded) {
    return (
      <Card className="flex items-center justify-center animate-pulse" style={{ height }}>
        <CardContent className="text-center p-6">
          <MapPin className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden border" style={{ height }}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={zoom}
        options={mapOptions}
        onLoad={onMapLoad}
        onUnmount={onMapUnmount}
      >
        {allMarkers.map((property) => {
          const isSubject = subjectProperty?.id === property.id;
          return (
            <Marker
              key={property.id}
              position={{ lat: property.latitude!, lng: property.longitude! }}
              icon={getMarkerIcon(property)}
              title={isSubject ? `Subject: ${formatPropertyAddress(property)}` : formatPropertyAddress(property)}
              label={
                isSubject
                  ? {
                      text: "S",
                      color: "#ffffff",
                      fontWeight: "700",
                      fontSize: "12px",
                    }
                  : undefined
              }
              zIndex={
                isSubject ? 1000 :
                selectedPropertyId === property.id ? 500 : 1
              }
              onClick={() => handleMarkerClick(property)}
            />
          );
        })}

        {selectedProperty && (() => {
          const isSubject = subjectProperty?.id === selectedProperty.id;
          const priceValue = selectedProperty.estimatedValue || selectedProperty.lastSalePrice;
          const headlineTitle = priceValue
            ? formatPrice(priceValue)
            : isSubject
              ? "This unit"
              : selectedProperty.address || "Property";
          const locationLine = [selectedProperty.address, selectedProperty.city, selectedProperty.state]
            .filter((part) => part && String(part).trim().length > 0)
            .join(", ");
          return (
            <InfoWindow
              position={{
                lat: selectedProperty.latitude!,
                lng: selectedProperty.longitude!,
              }}
              onCloseClick={() => setSelectedProperty(null)}
            >
              <div className="p-2 min-w-[200px] max-w-[280px]">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-semibold text-base">{headlineTitle}</p>
                  {selectedProperty.opportunityScore && (
                    <span className={cn("font-bold text-sm", getScoreColor(selectedProperty.opportunityScore))}>
                      {selectedProperty.opportunityScore}
                    </span>
                  )}
                </div>
                {locationLine && (
                  <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                    {locationLine}
                    {selectedProperty.zipCode ? ` ${selectedProperty.zipCode}` : ""}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                  {selectedProperty.beds !== null && selectedProperty.beds !== undefined && (
                    <span className="flex items-center gap-1">
                      <Bed className="h-3 w-3" />
                      {selectedProperty.beds}
                    </span>
                  )}
                  {selectedProperty.baths !== null && selectedProperty.baths !== undefined && (
                    <span className="flex items-center gap-1">
                      <Bath className="h-3 w-3" />
                      {selectedProperty.baths}
                    </span>
                  )}
                  {selectedProperty.sqft && (
                    <span className="flex items-center gap-1">
                      <Square className="h-3 w-3" />
                      {selectedProperty.sqft.toLocaleString()}
                    </span>
                  )}
                </div>
                {!isSubject && (
                  <Link href={getMarkerUrl ? getMarkerUrl(selectedProperty) : getPropertyUrl(selectedProperty)}>
                    <Button size="sm" className="w-full text-xs">
                      View Details
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Button>
                  </Link>
                )}
              </div>
            </InfoWindow>
          );
        })()}
      </GoogleMap>

      {subjectProperty && (
        <div className="absolute bottom-4 left-4 z-10">
          <div className="flex items-center gap-4 bg-background/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border text-xs">
            <div className="flex items-center gap-1.5">
              <span className="relative inline-flex items-center justify-center w-4 h-5">
                <svg viewBox="-14 -24 28 26" className="w-4 h-5">
                  <path
                    d="M 0,0 C -2,-10 -12,-12 -12,-22 a 12,12 0 1,1 24,0 C 12,-12 2,-10 0,0 z"
                    fill="#2563eb"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <text
                    x="0"
                    y="-18"
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="#ffffff"
                  >
                    S
                  </text>
                </svg>
              </span>
              <span className="font-medium">This unit</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-600 border-2 border-white" />
              <span>Nearby properties</span>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-4 right-4 z-10">
        <Badge variant="secondary" className="shadow-lg">
          {validProperties.length} {validProperties.length === 1 ? "property" : "properties"}
          {showStandaloneSubject ? " + subject" : ""}
        </Badge>
      </div>
    </div>
  );
}
