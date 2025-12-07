import { useEffect } from "react";
import type { Property } from "@shared/schema";

interface PropertyJsonLdProps {
  property: Property;
  compsCount?: number;
}

export function PropertyJsonLd({ property, compsCount }: PropertyJsonLdProps) {
  useEffect(() => {
    const formatPrice = (price: number | null) => {
      if (!price) return undefined;
      return price;
    };

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "RealEstateListing",
      name: property.address || "Property Listing",
      description: `${property.propertyType} in ${property.city}, ${property.state}. ${property.beds || 0} beds, ${property.baths || 0} baths${property.sqft ? `, ${property.sqft.toLocaleString()} sqft` : ""}.`,
      url: typeof window !== "undefined" ? window.location.href : undefined,
      datePosted: property.createdAt ? new Date(property.createdAt).toISOString() : undefined,
      
      offers: property.lastSalePrice ? {
        "@type": "Offer",
        price: formatPrice(property.lastSalePrice),
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      } : undefined,

      address: {
        "@type": "PostalAddress",
        streetAddress: property.address,
        addressLocality: property.city,
        addressRegion: property.state,
        postalCode: property.zipCode,
        addressCountry: "US",
      },

      geo: property.latitude && property.longitude ? {
        "@type": "GeoCoordinates",
        latitude: property.latitude,
        longitude: property.longitude,
      } : undefined,

      additionalProperty: [
        property.beds ? {
          "@type": "PropertyValue",
          name: "numberOfBedrooms",
          value: property.beds,
        } : null,
        property.baths ? {
          "@type": "PropertyValue",
          name: "numberOfBathrooms",
          value: property.baths,
        } : null,
        property.sqft ? {
          "@type": "PropertyValue",
          name: "floorSize",
          value: property.sqft,
          unitCode: "SQF",
        } : null,
        property.yearBuilt ? {
          "@type": "PropertyValue",
          name: "yearBuilt",
          value: property.yearBuilt,
        } : null,
        property.opportunityScore ? {
          "@type": "PropertyValue",
          name: "opportunityScore",
          value: property.opportunityScore,
        } : null,
        compsCount ? {
          "@type": "PropertyValue",
          name: "comparableSalesCount",
          value: compsCount,
        } : null,
      ].filter(Boolean),

      provider: {
        "@type": "Organization",
        name: "Realtors Dashboard",
        url: "https://realtorsdashboard.com",
      },
    };

    const cleanJsonLd = JSON.parse(JSON.stringify(jsonLd, (key, value) => 
      value === undefined || value === null ? undefined : value
    ));

    const scriptId = "property-jsonld";
    let script = document.getElementById(scriptId) as HTMLScriptElement;
    
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    
    script.textContent = JSON.stringify(cleanJsonLd);

    return () => {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [property, compsCount]);

  return null;
}
