import { db } from "../db";
import { amenities } from "@shared/schema";

const BOROUGH_MAP: Record<string, string> = {
  M: "Manhattan", X: "Bronx", K: "Brooklyn", Q: "Queens", R: "Staten Island",
};

async function importPlaygrounds() {
  console.log("=== Importing NYC Playgrounds ===");
  const url = "https://data.cityofnewyork.us/resource/y6ja-fw4f.json?$limit=5000";
  console.log(`Fetching: ${url}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    console.error("Failed:", response.status);
    return 0;
  }
  
  const records = await response.json();
  console.log(`Received ${records.length} playground records`);
  
  if (records.length > 0) {
    console.log("Sample keys:", Object.keys(records[0]));
  }
  
  let imported = 0;
  const batch = records.filter((r: any) => {
    const lat = r.lat || r.latitude || (r.the_geom?.coordinates && r.the_geom.coordinates[1]);
    return r.name && lat;
  }).map((r: any, i: number) => {
    let lat = null, lng = null;
    
    if (r.lat && r.lon) {
      lat = parseFloat(r.lat);
      lng = parseFloat(r.lon);
    } else if (r.latitude && r.longitude) {
      lat = parseFloat(r.latitude);
      lng = parseFloat(r.longitude);
    } else if (r.the_geom?.coordinates) {
      lat = r.the_geom.coordinates[1];
      lng = r.the_geom.coordinates[0];
    }
    
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
    
    return {
      id: `playground-${r.prop_id || r.objectid || i}-${Date.now()}`,
      name: r.name || "Playground",
      category: "park",
      subcategory: "playground",
      address: null,
      borough: BOROUGH_MAP[r.borough] || r.borough || null,
      latitude: lat,
      longitude: lng,
      gridLat: Math.floor(lat * 1000),
      gridLng: Math.floor(lng * 1000),
      sourceId: r.prop_id || null,
      sourceType: "nyc_playgrounds",
    };
  }).filter((x: any) => x !== null);
  
  console.log(`Valid playgrounds: ${batch.length}`);
  
  if (batch.length > 0) {
    await db.insert(amenities).values(batch).onConflictDoNothing();
    imported = batch.length;
    console.log(`Imported ${imported} playgrounds`);
  }
  
  return imported;
}

async function importPlazas() {
  console.log("\n=== Importing NYC Plazas ===");
  const url = "https://data.cityofnewyork.us/resource/cqsj-cfgu.json?$limit=1000";
  console.log(`Fetching: ${url}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    console.error("Failed:", response.status);
    return 0;
  }
  
  const records = await response.json();
  console.log(`Received ${records.length} plaza records`);
  
  let imported = 0;
  const batch = records.filter((r: any) => {
    const hasCoords = r.latitude || r.the_geom?.coordinates;
    return r.plaza_name && hasCoords;
  }).map((r: any, i: number) => {
    let lat = null, lng = null;
    
    if (r.latitude && r.longitude) {
      lat = parseFloat(r.latitude);
      lng = parseFloat(r.longitude);
    } else if (r.the_geom?.coordinates) {
      lat = r.the_geom.coordinates[1];
      lng = r.the_geom.coordinates[0];
    }
    
    if (!lat || !lng) return null;
    
    return {
      id: `plaza-${r.objectid || i}-${Date.now()}`,
      name: r.plaza_name,
      category: "park",
      subcategory: "plaza",
      address: r.plaza_address || null,
      borough: r.borough || null,
      latitude: lat,
      longitude: lng,
      gridLat: Math.floor(lat * 1000),
      gridLng: Math.floor(lng * 1000),
      sourceId: null,
      sourceType: "nyc_plazas",
    };
  }).filter((x: any) => x !== null);
  
  console.log(`Valid plazas: ${batch.length}`);
  
  if (batch.length > 0) {
    await db.insert(amenities).values(batch).onConflictDoNothing();
    imported = batch.length;
    console.log(`Imported ${imported} plazas`);
  }
  
  return imported;
}

async function importOpenSpaceFacilities() {
  console.log("\n=== Importing NYC Open Space Facilities ===");
  const url = "https://data.cityofnewyork.us/resource/rjaj-zgq7.json?$limit=5000";
  console.log(`Fetching: ${url}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    console.error("Failed:", response.status);
    return 0;
  }
  
  const records = await response.json();
  console.log(`Received ${records.length} records`);
  
  if (records.length > 0) {
    console.log("Sample keys:", Object.keys(records[0]));
  }
  
  let imported = 0;
  const batch = records.filter((r: any) => {
    return (r.lat && r.lon) || (r.latitude && r.longitude) || r.the_geom?.coordinates;
  }).map((r: any, i: number) => {
    let lat = null, lng = null;
    
    if (r.lat && r.lon) {
      lat = parseFloat(r.lat);
      lng = parseFloat(r.lon);
    } else if (r.latitude && r.longitude) {
      lat = parseFloat(r.latitude);
      lng = parseFloat(r.longitude);
    } else if (r.the_geom?.coordinates) {
      lat = r.the_geom.coordinates[1];
      lng = r.the_geom.coordinates[0];
    }
    
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
    
    return {
      id: `facility-${r.facid || r.objectid || i}-${Date.now()}`,
      name: r.facname || r.name || "Recreation Facility",
      category: "park",
      subcategory: r.factype || r.facsubgrp || "recreation",
      address: r.address || null,
      borough: BOROUGH_MAP[r.boro] || r.boro || null,
      latitude: lat,
      longitude: lng,
      gridLat: Math.floor(lat * 1000),
      gridLng: Math.floor(lng * 1000),
      sourceId: r.facid || null,
      sourceType: "nyc_facilities",
    };
  }).filter((x: any) => x !== null);
  
  console.log(`Valid facilities: ${batch.length}`);
  
  if (batch.length > 0) {
    await db.insert(amenities).values(batch).onConflictDoNothing();
    imported = batch.length;
    console.log(`Imported ${imported} facilities`);
  }
  
  return imported;
}

async function main() {
  const playgrounds = await importPlaygrounds();
  const plazas = await importPlazas();
  const facilities = await importOpenSpaceFacilities();
  
  console.log("\n=== Summary ===");
  console.log(`Playgrounds: ${playgrounds}`);
  console.log(`Plazas: ${plazas}`);
  console.log(`Facilities: ${facilities}`);
  console.log(`Total: ${playgrounds + plazas + facilities}`);
  
  process.exit(0);
}

main().catch(console.error);
