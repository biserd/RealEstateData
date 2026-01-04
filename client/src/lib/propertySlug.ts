import type { Property } from "@shared/schema";

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

export function isPropertyUnit(property: Property): boolean {
  return property.propertyType === "Condo" && !!property.sqft && property.sqft <= 6000;
}

export function getPropertyUrl(property: Property): string {
  // Units (small condos) should link to the unit detail page
  // Buildings should link to the property detail page
  if (isPropertyUnit(property)) {
    // For units, use the property slug format for now (unit page will handle resolution)
    return `/unit/${generatePropertySlug(property)}`;
  }
  return `/property/${generatePropertySlug(property)}`;
}
