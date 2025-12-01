import { useCallback, useRef, useMemo, useEffect, useState } from "react";
import { GoogleMap, Marker, InfoWindow } from "@react-google-maps/api";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { useMap } from "./MapProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bed, Bath, Square, MapPin, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { getPropertyUrl } from "@/lib/propertySlug";
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

export function PropertyMap({
  properties,
  subjectProperty,
  center,
  zoom = 12,
  height = "400px",
  showClustering = true,
  onPropertySelect,
  selectedPropertyId,
}: PropertyMapProps) {
  const { isLoaded, loadError, hasApiKey, authError } = useMap();
  const mapRef = useRef<google.maps.Map | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const validProperties = useMemo(
    () => properties.filter((p) => p.latitude && p.longitude),
    [properties]
  );

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
  }, []);

  const onMapUnmount = useCallback(() => {
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
    }
    markersRef.current = [];
    mapRef.current = null;
  }, []);

  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
    }
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    const markers = validProperties.map((property) => {
      const isSubject = subjectProperty?.id === property.id;
      const isSelected = selectedPropertyId === property.id;

      const marker = new google.maps.Marker({
        position: { lat: property.latitude!, lng: property.longitude! },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isSubject ? 14 : 10,
          fillColor: isSubject ? "#2563eb" : isSelected ? "#16a34a" : "#dc2626",
          fillOpacity: 0.9,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
        title: property.address,
        zIndex: isSubject ? 1000 : isSelected ? 500 : 1,
      });

      marker.addListener("click", () => {
        setSelectedProperty(property);
        onPropertySelect?.(property);
      });

      return marker;
    });

    markersRef.current = markers;

    if (showClustering && markers.length > 10) {
      clustererRef.current = new MarkerClusterer({
        map: mapRef.current,
        markers,
        algorithmOptions: { maxZoom: 15 },
      });
    } else {
      markers.forEach((marker) => marker.setMap(mapRef.current));
    }

    if (validProperties.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      validProperties.forEach((p) => {
        bounds.extend({ lat: p.latitude!, lng: p.longitude! });
      });
      
      // Fit bounds first
      mapRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      
      // Then set appropriate zoom after bounds are applied
      setTimeout(() => {
        if (!mapRef.current) return;
        const currentZoom = mapRef.current.getZoom();
        // For small property counts, ensure zoom is at least 14 for visibility
        if (validProperties.length <= 10) {
          if (currentZoom !== undefined && currentZoom < 14) {
            mapRef.current.setZoom(14);
          } else if (currentZoom !== undefined && currentZoom > 17) {
            mapRef.current.setZoom(17);
          }
        }
      }, 100);
    }

    return () => {
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
      }
      markersRef.current.forEach((marker) => marker.setMap(null));
    };
  }, [validProperties, subjectProperty, selectedPropertyId, isLoaded, showClustering, onPropertySelect]);

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
        {selectedProperty && (
          <InfoWindow
            position={{
              lat: selectedProperty.latitude!,
              lng: selectedProperty.longitude!,
            }}
            onCloseClick={() => setSelectedProperty(null)}
          >
            <div className="p-2 min-w-[200px] max-w-[280px]">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-semibold text-base">
                  {formatPrice(selectedProperty.estimatedValue || selectedProperty.lastSalePrice)}
                </p>
                {selectedProperty.opportunityScore && (
                  <span className={cn("font-bold text-sm", getScoreColor(selectedProperty.opportunityScore))}>
                    {selectedProperty.opportunityScore}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                {selectedProperty.address}, {selectedProperty.city}, {selectedProperty.state}
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                {selectedProperty.beds !== null && (
                  <span className="flex items-center gap-1">
                    <Bed className="h-3 w-3" />
                    {selectedProperty.beds}
                  </span>
                )}
                {selectedProperty.baths !== null && (
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
              <Link href={getPropertyUrl(selectedProperty)}>
                <Button size="sm" className="w-full text-xs">
                  View Details
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {subjectProperty && (
        <div className="absolute bottom-4 left-4 z-10">
          <div className="flex items-center gap-4 bg-background/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-blue-600 border-2 border-white" />
              <span>Subject</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-600 border-2 border-white" />
              <span>Comps</span>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-4 right-4 z-10">
        <Badge variant="secondary" className="shadow-lg">
          {validProperties.length} {validProperties.length === 1 ? "property" : "properties"}
        </Badge>
      </div>
    </div>
  );
}
