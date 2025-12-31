import { db } from "../db";
import { amenities } from "@shared/schema";

async function importParks() {
  console.log("=== Importing NYC Parks (Park Properties) ===");
  const url = "https://data.cityofnewyork.us/resource/enfh-gkve.json?$limit=5000";
  console.log(`Fetching: ${url}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    console.error("Failed:", response.status);
    return 0;
  }
  
  const records = await response.json();
  console.log(`Received ${records.length} records`);
  
  // Check what fields exist
  if (records.length > 0) {
    console.log("Sample record keys:", Object.keys(records[0]));
    console.log("Sample record:", JSON.stringify(records[0]).substring(0, 500));
  }
  
  let imported = 0;
  const batch = records.filter((r: any) => {
    // Try multiple coordinate field options
    const hasCoords = r.multipolygon?.coordinates || r.the_geom?.coordinates || r.mapped_in_parks || 
                      (r.latitude && r.longitude);
    return r.signname && hasCoords;
  }).map((r: any, i: number) => {
    let lat = null, lng = null;
    
    if (r.the_geom?.coordinates) {
      // Handle multipolygon - get centroid from first polygon
      const coords = r.the_geom.coordinates;
      if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
        // Multipolygon - get first point
        lng = coords[0][0][0];
        lat = coords[0][0][1];
      } else if (Array.isArray(coords[0])) {
        lng = coords[0][0];
        lat = coords[0][1];
      } else {
        lng = coords[0];
        lat = coords[1];
      }
    } else if (r.latitude && r.longitude) {
      lat = parseFloat(r.latitude);
      lng = parseFloat(r.longitude);
    }
    
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
    
    return {
      id: `park-${r.gispropnum || r.objectid || i}-${Date.now()}`,
      name: r.signname,
      category: "park",
      subcategory: r.typecategory || r.class || null,
      address: null,
      borough: r.borough || null,
      latitude: lat,
      longitude: lng,
      gridLat: Math.floor(lat * 1000),
      gridLng: Math.floor(lng * 1000),
      sourceId: r.gispropnum || null,
      sourceType: "nyc_parks",
    };
  }).filter((x: any) => x !== null);
  
  console.log(`Valid parks with coords: ${batch.length}`);
  
  if (batch.length > 0) {
    await db.insert(amenities).values(batch).onConflictDoNothing();
    imported = batch.length;
    console.log(`Imported ${imported} parks`);
  }
  
  return imported;
}

importParks().then(() => process.exit(0)).catch(console.error);
