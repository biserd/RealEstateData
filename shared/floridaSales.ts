// Florida DOR county numbers are historical. Miami-Dade retains Dade's number 23.
const names = [
  "Alachua", "Baker", "Bay", "Bradford", "Brevard", "Broward", "Calhoun", "Charlotte", "Citrus", "Clay",
  "Collier", "Columbia", "Miami-Dade", "DeSoto", "Dixie", "Duval", "Escambia", "Flagler", "Franklin", "Gadsden",
  "Gilchrist", "Glades", "Gulf", "Hamilton", "Hardee", "Hendry", "Hernando", "Highlands", "Hillsborough", "Holmes",
  "Indian River", "Jackson", "Jefferson", "Lafayette", "Lake", "Lee", "Leon", "Levy", "Liberty", "Madison",
  "Manatee", "Marion", "Martin", "Monroe", "Nassau", "Okaloosa", "Okeechobee", "Orange", "Osceola", "Palm Beach",
  "Pasco", "Pinellas", "Polk", "Putnam", "St. Johns", "St. Lucie", "Santa Rosa", "Sarasota", "Seminole", "Sumter",
  "Suwannee", "Taylor", "Union", "Volusia", "Wakulla", "Walton", "Washington",
];

export const floridaCounties = names.map((name, index) => ({
  code: 11 + index, name, slug: name.toLowerCase().replace(/\./g, "").replace(/ /g, "-"),
})).sort((a, b) => a.name.localeCompare(b.name));

export const floridaUses = {
  "001": "Single-family home",
  "002": "Mobile home",
  "003": "Multifamily (10+ units)",
  "004": "Condominium",
  "005": "Cooperative",
  "006": "Retirement home",
  "007": "Other residential",
  "008": "Multifamily (under 10 units)",
} as const;

export const floridaSource = "https://geodata.floridagio.gov/";
export const floridaParcelLayer = "https://services9.arcgis.com/Gh9awoU677aKree0/ArcGIS/rest/services/Florida_Statewide_Parcel_Centroid_Version/FeatureServer/0";
export const floridaZip = /^(?:3[23]\d|34[1-9])\d{2}$/;
