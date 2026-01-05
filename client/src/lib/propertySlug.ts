import type { Property } from "@shared/schema";

export function generateOpportunitySlug(opportunity: {
  address: string;
  city: string;
  zipCode: string;
  propertyId?: string;
}): string {
  const slugParts: string[] = [];
  
  if (opportunity.address) {
    const addressSlug = opportunity.address
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
    slugParts.push(addressSlug);
  }
  
  if (opportunity.city) {
    const citySlug = opportunity.city
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
    slugParts.push(citySlug);
  }
  
  if (opportunity.zipCode) {
    slugParts.push(opportunity.zipCode);
  }
  
  if (opportunity.propertyId) {
    slugParts.push(opportunity.propertyId);
  }
  
  return slugParts.filter(Boolean).join('-');
}

export function formatPropertyAddress(property: { address: string; unit?: string | null }): string {
  const trimmedUnit = property.unit?.trim();
  if (trimmedUnit) {
    // Add "Apt" prefix if unit doesn't already have one
    const hasPrefix = /^(apt|unit|suite|ste|#|floor|fl)\b/i.test(trimmedUnit);
    const formattedUnit = hasPrefix ? trimmedUnit : `Apt ${trimmedUnit}`;
    return `${property.address}, ${formattedUnit}`;
  }
  return property.address;
}

export function formatFullAddress(property: { address: string; unit?: string | null; city: string; state: string; zipCode: string }): string {
  const streetAddress = formatPropertyAddress(property);
  return `${streetAddress}, ${property.city}, ${property.state} ${property.zipCode}`;
}

export function generatePropertySlug(property: Property): string {
  const slugParts: string[] = [];
  
  if (property.address) {
    const addressSlug = property.address
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
    slugParts.push(addressSlug);
  }
  
  if (property.city) {
    const citySlug = property.city
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
    slugParts.push(citySlug);
  }
  
  if (property.zipCode) {
    slugParts.push(property.zipCode);
  }
  
  slugParts.push(property.id);
  
  return slugParts.filter(Boolean).join('-');
}

export function extractPropertyIdFromSlug(slug: string): string {
  const uuidRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  const match = slug.match(uuidRegex);
  if (match) {
    return match[0];
  }
  const parts = slug.split('-');
  return parts[parts.length - 1];
}

export function extractZipCodeFromSlug(slug: string): string | null {
  // Slug format: address-city-zipCode-uuid
  // Example: 1532-thieriot-avenue-bronx-10460-49d90fd6-39ba-4c48-ab24-1f0f473414d6
  // ZIP code is a 5-digit number before the UUID
  const zipCodeRegex = /(\d{5})-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  const match = slug.match(zipCodeRegex);
  if (match) {
    return match[1];
  }
  // Fallback: find any 5-digit sequence that looks like a ZIP
  const anyZipMatch = slug.match(/\b(\d{5})\b/);
  return anyZipMatch ? anyZipMatch[1] : null;
}

export function extractLocationFromSlug(slug: string): { address: string; city: string; zipCode: string | null } {
  // Slug format: address-city-zipCode-uuid
  const zipCode = extractZipCodeFromSlug(slug);
  
  // Remove the UUID part
  const uuidRegex = /-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  const withoutUuid = slug.replace(uuidRegex, '');
  
  // Remove ZIP code if present
  const withoutZip = zipCode ? withoutUuid.replace(new RegExp(`-${zipCode}$`), '') : withoutUuid;
  
  // Convert dashes back to spaces and capitalize
  const parts = withoutZip.split('-').filter(Boolean);
  
  // Try to identify city (last word before ZIP, typically borough names)
  const boroughs = ['manhattan', 'brooklyn', 'bronx', 'queens', 'staten'];
  let cityIndex = parts.findIndex(p => boroughs.includes(p.toLowerCase()));
  
  if (cityIndex === -1) {
    // No borough found, assume last part is city
    cityIndex = parts.length - 1;
  }
  
  const city = parts[cityIndex] ? parts[cityIndex].charAt(0).toUpperCase() + parts[cityIndex].slice(1) : '';
  const address = parts.slice(0, cityIndex).map(p => 
    p.charAt(0).toUpperCase() + p.slice(1)
  ).join(' ');
  
  return { address, city, zipCode };
}

export function getPropertyUrl(property: Property): string {
  // All properties from the properties table link to /properties/
  // Individual condo units from the condo_units table use /unit/ routes
  return `/properties/${generatePropertySlug(property)}`;
}
