import { useJsApiLoader } from "@react-google-maps/api";
import { createContext, useContext, type ReactNode, useEffect, useState } from "react";

interface MapContextType {
  isLoaded: boolean;
  loadError: Error | undefined;
  hasApiKey: boolean;
  authError: boolean;
}

const MapContext = createContext<MapContextType>({
  isLoaded: false,
  loadError: undefined,
  hasApiKey: false,
  authError: false,
});

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places"];

interface MapProviderProps {
  children: ReactNode;
}

export function MapProvider({ children }: MapProviderProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const hasApiKey = Boolean(apiKey && apiKey.length > 0);
  const [authError, setAuthError] = useState(false);
  
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: hasApiKey ? apiKey : "PLACEHOLDER_KEY_NOT_SET",
    libraries,
    preventGoogleFontsLoading: !hasApiKey,
  });

  useEffect(() => {
    const handleAuthFailure = () => {
      console.warn("Google Maps authentication failed. Please check API key configuration in Google Cloud Console.");
      setAuthError(true);
    };

    (window as any).gm_authFailure = handleAuthFailure;
    
    return () => {
      delete (window as any).gm_authFailure;
    };
  }, []);

  useEffect(() => {
    if (loadError) {
      console.warn("Google Maps failed to load. Please ensure the API key is configured correctly in Google Cloud Console with appropriate referrer restrictions.");
    }
  }, [loadError]);

  return (
    <MapContext.Provider value={{ isLoaded: hasApiKey && isLoaded, loadError, hasApiKey, authError }}>
      {children}
    </MapContext.Provider>
  );
}

export function useMap() {
  return useContext(MapContext);
}
