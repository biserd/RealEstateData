interface UnitForSlug {
  unitBbl: string;
  unitDesignation?: string | null;
  buildingDisplayAddress?: string | null;
  unitDisplayAddress?: string | null;
  borough?: string | null;
  slug?: string | null;
}

export function generateUnitSlug(unit: UnitForSlug, buildingContext?: { displayAddress?: string; borough?: string }): string {
  if (unit.slug) {
    return unit.slug;
  }
  
  const slugParts: string[] = [];
  
  const address = unit.buildingDisplayAddress || unit.unitDisplayAddress || buildingContext?.displayAddress;
  if (address) {
    const addressSlug = address
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 40);
    slugParts.push(addressSlug);
  }
  
  if (unit.unitDesignation) {
    slugParts.push(`unit-${unit.unitDesignation.toLowerCase().replace(/[^a-z0-9]/g, '')}`);
  }
  
  const borough = unit.borough || buildingContext?.borough;
  if (borough) {
    const boroughSlug = borough
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z]/g, '');
    slugParts.push(boroughSlug);
  }
  
  const bblSuffix = unit.unitBbl.slice(-9);
  slugParts.push(bblSuffix);
  
  return slugParts.filter(Boolean).join('-');
}

export function getUnitUrl(unit: UnitForSlug, buildingContext?: { displayAddress?: string; borough?: string }): string {
  return `/unit/${generateUnitSlug(unit, buildingContext)}`;
}
