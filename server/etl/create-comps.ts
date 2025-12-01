import { db } from "../db";
import { properties, comps } from "@shared/schema";

async function createComparables() {
  console.log("Creating comparable relationships for all properties...");
  
  const allProps = await db.select({
    id: properties.id,
    zipCode: properties.zipCode,
    pricePerSqft: properties.pricePerSqft
  }).from(properties);
  
  console.log(`Found ${allProps.length} properties`);
  
  const propertiesByZip: Record<string, typeof allProps> = {};
  for (const prop of allProps) {
    if (!propertiesByZip[prop.zipCode]) {
      propertiesByZip[prop.zipCode] = [];
    }
    propertiesByZip[prop.zipCode].push(prop);
  }
  
  console.log(`Grouped into ${Object.keys(propertiesByZip).length} ZIP codes`);
  
  let compsCount = 0;
  let processed = 0;
  const batchSize = 1000;
  const compBatch: any[] = [];
  
  for (const prop of allProps) {
    const sameZipProps = propertiesByZip[prop.zipCode]?.filter(p => p.id !== prop.id) || [];
    const numComps = Math.min(sameZipProps.length, 5);
    const selectedComps = sameZipProps
      .sort(() => Math.random() - 0.5)
      .slice(0, numComps);
    
    for (const compProp of selectedComps) {
      const adjustedPrice = Math.min(
        2000000000,
        Math.round((Math.min(compProp.pricePerSqft || 400, 10000)) * 1500 * (1 + (Math.random() - 0.5) * 0.1))
      );
      compBatch.push({
        subjectPropertyId: prop.id,
        compPropertyId: compProp.id,
        similarityScore: 0.7 + Math.random() * 0.25,
        sqftAdjustment: -0.1 + Math.random() * 0.2,
        ageAdjustment: -0.05 + Math.random() * 0.1,
        bedsAdjustment: -0.05 + Math.random() * 0.1,
        adjustedPrice,
      });
      compsCount++;
    }
    
    if (compBatch.length >= batchSize) {
      await db.insert(comps).values(compBatch);
      compBatch.length = 0;
      processed += batchSize;
      console.log(`  Inserted ${processed} comps...`);
    }
  }
  
  if (compBatch.length > 0) {
    await db.insert(comps).values(compBatch);
  }
  
  console.log(`Created ${compsCount} comparable relationships`);
}

createComparables()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch(err => {
    console.error("Error:", err);
    process.exit(1);
  });
