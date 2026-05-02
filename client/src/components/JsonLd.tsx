import { useEffect, useId } from "react";

interface JsonLdProps {
  data: Record<string, any>;
  id?: string;
}

function clean(value: any): any {
  if (Array.isArray(value)) {
    const filtered = value.map(clean).filter((v) => v !== undefined && v !== null);
    return filtered.length > 0 ? filtered : undefined;
  }
  if (value && typeof value === "object") {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      const c = clean(v);
      if (c !== undefined && c !== null) result[k] = c;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }
  return value;
}

export function JsonLd({ data, id }: JsonLdProps) {
  const reactId = useId();
  const scriptId = id || `jsonld-${reactId.replace(/[:]/g, "")}`;

  useEffect(() => {
    const cleaned = clean(data) || {};
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(cleaned);

    return () => {
      const existing = document.getElementById(scriptId);
      if (existing) existing.remove();
    };
  }, [data, scriptId]);

  return null;
}

const SITE_URL = "https://realtorsdashboard.com";
const SITE_NAME = "Realtors Dashboard";

interface OrganizationJsonLdProps {
  url?: string;
  logo?: string;
}

export function OrganizationJsonLd({ url = SITE_URL, logo }: OrganizationJsonLdProps = {}) {
  return (
    <JsonLd
      id="jsonld-organization"
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: SITE_NAME,
        url,
        logo: logo || `${url}/og-image.png`,
        description:
          "Real estate intelligence platform providing transparent, data-backed insights for buyers, investors, and agents in NY, NJ, and CT.",
      }}
    />
  );
}

interface WebSiteJsonLdProps {
  url?: string;
  searchUrlTemplate?: string;
}

export function WebSiteJsonLd({
  url = SITE_URL,
  searchUrlTemplate,
}: WebSiteJsonLdProps = {}) {
  const data: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url,
  };
  if (searchUrlTemplate) {
    data.potentialAction = {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: searchUrlTemplate,
      },
      "query-input": "required name=search_term_string",
    };
  }
  return <JsonLd id="jsonld-website" data={data} />;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbsJsonLdProps {
  items: BreadcrumbItem[];
}

export function BreadcrumbsJsonLd({ items }: BreadcrumbsJsonLdProps) {
  return (
    <JsonLd
      id="jsonld-breadcrumbs"
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, idx) => ({
          "@type": "ListItem",
          position: idx + 1,
          name: item.name,
          item: item.url.startsWith("http") ? item.url : `${SITE_URL}${item.url}`,
        })),
      }}
    />
  );
}

export interface ProductOffer {
  name: string;
  price: number;
  priceCurrency?: string;
  billingIncrement?: string;
  url?: string;
}

interface ProductJsonLdProps {
  name: string;
  description: string;
  offers: ProductOffer[];
  brand?: string;
  url?: string;
}

export function ProductJsonLd({
  name,
  description,
  offers,
  brand = SITE_NAME,
  url,
}: ProductJsonLdProps) {
  return (
    <JsonLd
      id={`jsonld-product-${name.toLowerCase().replace(/\s+/g, "-")}`}
      data={{
        "@context": "https://schema.org",
        "@type": "Product",
        name,
        description,
        brand: { "@type": "Brand", name: brand },
        url,
        offers: offers.map((o) => ({
          "@type": "Offer",
          name: o.name,
          price: o.price,
          priceCurrency: o.priceCurrency || "USD",
          availability: "https://schema.org/InStock",
          url: o.url,
        })),
      }}
    />
  );
}

export interface FAQItem {
  question: string;
  answer: string;
}

interface FAQJsonLdProps {
  items: FAQItem[];
}

export function FAQJsonLd({ items }: FAQJsonLdProps) {
  return (
    <JsonLd
      id="jsonld-faq"
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      }}
    />
  );
}

interface PlaceJsonLdProps {
  name: string;
  description?: string;
  latitude?: number | null;
  longitude?: number | null;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  url?: string;
}

export function PlaceJsonLd({
  name,
  description,
  latitude,
  longitude,
  addressLocality,
  addressRegion,
  postalCode,
  url,
}: PlaceJsonLdProps) {
  return (
    <JsonLd
      id="jsonld-place"
      data={{
        "@context": "https://schema.org",
        "@type": "Place",
        name,
        description,
        url,
        address: addressLocality || addressRegion || postalCode
          ? {
              "@type": "PostalAddress",
              addressLocality,
              addressRegion,
              postalCode,
              addressCountry: "US",
            }
          : undefined,
        geo:
          latitude && longitude
            ? {
                "@type": "GeoCoordinates",
                latitude,
                longitude,
              }
            : undefined,
      }}
    />
  );
}

interface BuildingJsonLdProps {
  name: string;
  description?: string;
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  latitude?: number | null;
  longitude?: number | null;
  numberOfUnits?: number;
  url?: string;
}

export function BuildingJsonLd({
  name,
  description,
  streetAddress,
  addressLocality,
  addressRegion,
  postalCode,
  latitude,
  longitude,
  numberOfUnits,
  url,
}: BuildingJsonLdProps) {
  return (
    <JsonLd
      id="jsonld-building"
      data={{
        "@context": "https://schema.org",
        "@type": "ApartmentComplex",
        name,
        description,
        url,
        address: {
          "@type": "PostalAddress",
          streetAddress,
          addressLocality,
          addressRegion,
          postalCode,
          addressCountry: "US",
        },
        geo:
          latitude && longitude
            ? {
                "@type": "GeoCoordinates",
                latitude,
                longitude,
              }
            : undefined,
        numberOfAccommodationUnits: numberOfUnits,
      }}
    />
  );
}

interface ResidenceJsonLdProps {
  name: string;
  description?: string;
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  latitude?: number | null;
  longitude?: number | null;
  numberOfRooms?: number | null;
  floorSize?: number | null;
  url?: string;
}

export function ResidenceJsonLd({
  name,
  description,
  streetAddress,
  addressLocality,
  addressRegion,
  postalCode,
  latitude,
  longitude,
  numberOfRooms,
  floorSize,
  url,
}: ResidenceJsonLdProps) {
  return (
    <JsonLd
      id="jsonld-residence"
      data={{
        "@context": "https://schema.org",
        "@type": "Apartment",
        name,
        description,
        url,
        address: {
          "@type": "PostalAddress",
          streetAddress,
          addressLocality,
          addressRegion,
          postalCode,
          addressCountry: "US",
        },
        geo:
          latitude && longitude
            ? {
                "@type": "GeoCoordinates",
                latitude,
                longitude,
              }
            : undefined,
        numberOfRooms: numberOfRooms || undefined,
        floorSize: floorSize
          ? {
              "@type": "QuantitativeValue",
              value: floorSize,
              unitCode: "SQF",
            }
          : undefined,
      }}
    />
  );
}
