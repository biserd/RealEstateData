import { db } from "../db";
import { amenities } from "@shared/schema";
import { sql } from "drizzle-orm";

const BOROUGH_MAP: Record<string, string> = {
  "1": "Manhattan",
  "2": "Bronx",
  "3": "Brooklyn",
  "4": "Queens",
  "5": "Staten Island",
  "M": "Manhattan",
  "X": "Bronx",
  "K": "Brooklyn",
  "Q": "Queens",
  "R": "Staten Island",
  MANHATTAN: "Manhattan",
  BRONX: "Bronx",
  BROOKLYN: "Brooklyn",
  QUEENS: "Queens",
  "STATEN ISLAND": "Staten Island",
};

async function fetchData(url: string): Promise<any[]> {
  console.log(`Fetching: ${url.substring(0, 80)}...`);
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function importParks() {
  console.log("\n=== Importing NYC Parks ===");
  const url = "https://data.cityofnewyork.us/resource/enfh-gkve.json?$limit=5000";
  const records = await fetchData(url);
  
  let imported = 0;
  const batch = records.filter((r: any) => r.signname && r.the_geom?.coordinates)
    .map((r: any, i: number) => ({
      id: `park-${r.objectid || i}-${Date.now()}`,
      name: r.signname,
      category: "park",
      subcategory: r.typecategory || null,
      address: r.location || null,
      borough: BOROUGH_MAP[r.borough?.toUpperCase()] || r.borough || null,
      latitude: r.the_geom.coordinates[1],
      longitude: r.the_geom.coordinates[0],
      gridLat: Math.floor(r.the_geom.coordinates[1] * 1000),
      gridLng: Math.floor(r.the_geom.coordinates[0] * 1000),
      sourceId: r.objectid,
      sourceType: "nyc_parks",
    }));
    
  if (batch.length > 0) {
    await db.insert(amenities).values(batch).onConflictDoNothing();
    imported = batch.length;
    console.log(`Imported ${imported} parks`);
  }
  return imported;
}

async function importGroceries() {
  console.log("\n=== Importing Retail Food Stores ===");
  const url = "https://data.ny.gov/resource/9a8c-vfzj.json?$limit=5000&county=New%20York";
  
  try {
    const records = await fetchData(url);
    
    let imported = 0;
    const batch = records.filter((r: any) => r.latitude && r.longitude && r.dba_name)
      .map((r: any, i: number) => ({
        id: `grocery-${r.license_number || i}-${Date.now()}`,
        name: r.dba_name || r.entity_name,
        category: "grocery",
        subcategory: r.establishment_type || null,
        address: r.street_address || null,
        city: r.city || null,
        zipCode: r.zip_code || null,
        latitude: parseFloat(r.latitude),
        longitude: parseFloat(r.longitude),
        gridLat: Math.floor(parseFloat(r.latitude) * 1000),
        gridLng: Math.floor(parseFloat(r.longitude) * 1000),
        sourceId: r.license_number,
        sourceType: "ny_retail_food",
      }));
      
    if (batch.length > 0) {
      await db.insert(amenities).values(batch).onConflictDoNothing();
      imported = batch.length;
      console.log(`Imported ${imported} grocery stores`);
    }
    return imported;
  } catch (e) {
    console.error("Grocery import failed:", e);
    return 0;
  }
}

async function importRestaurants() {
  console.log("\n=== Importing NYC Restaurants (Inspection Data) ===");
  const url = "https://data.cityofnewyork.us/resource/43nn-pn8j.json?$limit=5000&$select=dba,building,street,boro,zipcode,latitude,longitude,cuisine_description&$group=dba,building,street,boro,zipcode,latitude,longitude,cuisine_description";
  
  try {
    const records = await fetchData(url);
    
    let imported = 0;
    const batch = records.filter((r: any) => r.latitude && r.longitude && r.dba)
      .map((r: any, i: number) => ({
        id: `restaurant-${i}-${Date.now()}`,
        name: r.dba,
        category: "restaurant",
        subcategory: r.cuisine_description || null,
        address: `${r.building || ''} ${r.street || ''}`.trim() || null,
        borough: BOROUGH_MAP[r.boro?.toUpperCase()] || r.boro || null,
        zipCode: r.zipcode || null,
        latitude: parseFloat(r.latitude),
        longitude: parseFloat(r.longitude),
        gridLat: Math.floor(parseFloat(r.latitude) * 1000),
        gridLng: Math.floor(parseFloat(r.longitude) * 1000),
        sourceId: null,
        sourceType: "nyc_restaurants",
      }));
      
    if (batch.length > 0) {
      await db.insert(amenities).values(batch).onConflictDoNothing();
      imported = batch.length;
      console.log(`Imported ${imported} restaurants`);
    }
    return imported;
  } catch (e) {
    console.error("Restaurant import failed:", e);
    return 0;
  }
}

async function importFarmersMarkets() {
  console.log("\n=== Importing NYC Farmers Markets ===");
  const url = "https://data.cityofnewyork.us/resource/j8gx-kc43.json?$limit=1000";
  
  try {
    const records = await fetchData(url);
    
    let imported = 0;
    const batch = records.filter((r: any) => r.latitude && r.longitude && r.marketname)
      .map((r: any, i: number) => ({
        id: `farmers-market-${i}-${Date.now()}`,
        name: r.marketname,
        category: "grocery",
        subcategory: "farmers_market",
        address: r.streetaddress || null,
        borough: BOROUGH_MAP[r.borough?.toUpperCase()] || r.borough || null,
        zipCode: r.zipcode || null,
        latitude: parseFloat(r.latitude),
        longitude: parseFloat(r.longitude),
        gridLat: Math.floor(parseFloat(r.latitude) * 1000),
        gridLng: Math.floor(parseFloat(r.longitude) * 1000),
        sourceId: null,
        sourceType: "nyc_farmers_markets",
      }));
      
    if (batch.length > 0) {
      await db.insert(amenities).values(batch).onConflictDoNothing();
      imported = batch.length;
      console.log(`Imported ${imported} farmers markets`);
    }
    return imported;
  } catch (e) {
    console.error("Farmers markets import failed:", e);
    return 0;
  }
}

async function main() {
  console.log("=== NYC Amenity Import ===\n");
  
  const parks = await importParks();
  const groceries = await importGroceries();
  const restaurants = await importRestaurants();
  const markets = await importFarmersMarkets();
  
  console.log("\n=== Import Summary ===");
  console.log(`Parks: ${parks}`);
  console.log(`Groceries: ${groceries}`);
  console.log(`Restaurants: ${restaurants}`);
  console.log(`Farmers Markets: ${markets}`);
  console.log(`Total: ${parks + groceries + restaurants + markets}`);
  
  process.exit(0);
}

main().catch(console.error);
