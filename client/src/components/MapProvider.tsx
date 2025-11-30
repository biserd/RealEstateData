import { useJsApiLoader } from "@react-google-maps/api";
import { createContext, useContext, type ReactNode } from "react";

interface MapContextType {
  isLoaded: boolean;
  loadError: Error | undefined;
}

const MapContext = createContext<MapContextType>({
  isLoaded: false,
  loadError: undefined,
});

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places"];

interface MapProviderProps {
  children: ReactNode;
}

export function MapProvider({ children }: MapProviderProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries,
  });

  return (
    <MapContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </MapContext.Provider>
  );
}

export function useMap() {
  return useContext(MapContext);
}
