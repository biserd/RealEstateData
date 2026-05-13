import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { Response } from "express";
import { objectStorageClient } from "../replit_integrations/object_storage/objectStorage";

const CACHE_DIR = path.join(process.cwd(), ".cache", "maps");

// Object Storage bucket + path prefix for persistent map image cache.
// Files live at: <bucket>/<OBJ_PREFIX>/<filename>
// Survives deploys; local disk is a warm L1, Object Storage is the durable L2.
function getObjStorage(): { bucketName: string; prefix: string } | null {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) return null;
  return { bucketName: bucketId, prefix: "maps-cache" };
}

let dirReady: Promise<void> | null = null;
function ensureDir(): Promise<void> {
  if (!dirReady) {
    dirReady = fs.mkdir(CACHE_DIR, { recursive: true }).then(() => undefined);
  }
  return dirReady;
}

const inflight = new Map<string, Promise<Buffer>>();

function cacheKey(prefix: string, params: Record<string, string | number>): string {
  const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  const hash = createHash("sha1").update(`${prefix}:${sorted}`).digest("hex");
  return `${prefix}_${hash}.jpg`;
}

function roundCoord(n: number): string {
  // 4 decimals ≈ 11m. All units in the same condo building collapse to one
  // cache key, dramatically increasing hit rate.
  return n.toFixed(4);
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

// ---------- Object Storage helpers ----------

async function readFromObjStorage(filename: string): Promise<Buffer | null> {
  const obj = getObjStorage();
  if (!obj) return null;
  try {
    const file = objectStorageClient.bucket(obj.bucketName).file(`${obj.prefix}/${filename}`);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buf] = await file.download();
    return buf;
  } catch {
    return null;
  }
}

async function writeToObjStorage(filename: string, buf: Buffer): Promise<void> {
  const obj = getObjStorage();
  if (!obj) return;
  try {
    const file = objectStorageClient.bucket(obj.bucketName).file(`${obj.prefix}/${filename}`);
    await file.save(buf, { contentType: "image/jpeg", resumable: false });
  } catch (err) {
    console.warn("[mapImageCache] obj-storage write failed:", err);
  }
}

// ---------- Core fetch-and-cache logic ----------

async function fetchAndCache(filename: string, url: string): Promise<Buffer> {
  // L1: local disk
  const localPath = path.join(CACHE_DIR, filename);
  try {
    return await fs.readFile(localPath);
  } catch {}

  // L2: Object Storage (survives deploys)
  const fromObj = await readFromObjStorage(filename);
  if (fromObj) {
    // Backfill disk so next request is instant
    await ensureDir();
    fs.writeFile(localPath, fromObj).catch(() => {});
    return fromObj;
  }

  // Dedupe concurrent requests for the same key
  if (inflight.has(filename)) return inflight.get(filename)!;

  const promise = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await ensureDir();
    // Write to both tiers concurrently; don't block the response on obj-storage
    await fs.writeFile(localPath, buf);
    writeToObjStorage(filename, buf).catch(() => {});
    return buf;
  })();

  inflight.set(filename, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(filename);
  }
}

// ---------- Cache-hit check (disk first, then obj-storage) ----------

async function tryReadCache(
  filename: string,
): Promise<{ buf: Buffer; hit: boolean } | null> {
  const localPath = path.join(CACHE_DIR, filename);

  // L1 disk
  try {
    const buf = await fs.readFile(localPath);
    return { buf, hit: true };
  } catch {}

  // L2 Object Storage
  const buf = await readFromObjStorage(filename);
  if (buf) {
    // Backfill disk
    await ensureDir();
    fs.writeFile(localPath, buf).catch(() => {});
    return { buf, hit: true };
  }

  return null;
}

function sendImage(res: Response, buf: Buffer, hit: boolean): void {
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("X-Cache", hit ? "HIT" : "MISS");
  res.send(buf);
}

// ---------- Public API ----------

export async function serveStreetView(
  res: Response,
  rawLat: unknown,
  rawLng: unknown,
  rawW: unknown,
  rawH: unknown,
): Promise<void> {
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ message: "lat and lng required" });
    return;
  }
  const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || "";
  if (!apiKey) {
    res.status(503).json({ message: "Maps API key not configured" });
    return;
  }

  const w = clampInt(rawW, 100, 640, 480);
  const h = clampInt(rawH, 100, 640, 270);
  const latStr = roundCoord(lat);
  const lngStr = roundCoord(lng);

  const filename = cacheKey("sv", { lat: latStr, lng: lngStr, w, h });

  const cached = await tryReadCache(filename);
  if (cached) {
    sendImage(res, cached.buf, true);
    return;
  }

  const params = new URLSearchParams({
    size: `${w}x${h}`,
    location: `${latStr},${lngStr}`,
    fov: "80",
    pitch: "0",
    source: "outdoor",
    key: apiKey,
  });
  const url = `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;

  try {
    const buf = await fetchAndCache(filename, url);
    sendImage(res, buf, false);
  } catch (err) {
    console.error("[mapImageCache] streetview fetch failed:", err);
    res.status(502).json({ message: "Failed to fetch street view" });
  }
}

export async function serveStaticMap(
  res: Response,
  rawLat: unknown,
  rawLng: unknown,
  rawZoom: unknown,
  rawW: unknown,
  rawH: unknown,
  rawMarker: unknown,
  rawMapType: unknown,
): Promise<void> {
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ message: "lat and lng required" });
    return;
  }
  const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || "";
  if (!apiKey) {
    res.status(503).json({ message: "Maps API key not configured" });
    return;
  }

  const w = clampInt(rawW, 100, 640, 480);
  const h = clampInt(rawH, 100, 640, 270);
  const zoom = clampInt(rawZoom, 1, 21, 15);
  const latStr = roundCoord(lat);
  const lngStr = roundCoord(lng);
  const mapType = ["roadmap", "satellite", "hybrid", "terrain"].includes(String(rawMapType))
    ? String(rawMapType)
    : "roadmap";
  const markerColor = String(rawMarker || "red").replace(/[^a-z0-9]/gi, "").slice(0, 12) || "red";

  const filename = cacheKey("sm", { lat: latStr, lng: lngStr, z: zoom, w, h, t: mapType, m: markerColor });

  const cached = await tryReadCache(filename);
  if (cached) {
    sendImage(res, cached.buf, true);
    return;
  }

  const params = new URLSearchParams({
    size: `${w}x${h}`,
    center: `${latStr},${lngStr}`,
    zoom: String(zoom),
    maptype: mapType,
    scale: "2",
    key: apiKey,
  });
  params.append("markers", `color:${markerColor}|${latStr},${lngStr}`);
  const url = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;

  try {
    const buf = await fetchAndCache(filename, url);
    sendImage(res, buf, false);
  } catch (err) {
    console.error("[mapImageCache] staticmap fetch failed:", err);
    res.status(502).json({ message: "Failed to fetch static map" });
  }
}

export async function getCacheStats(): Promise<{
  diskFiles: number;
  diskBytes: number;
  objStorageEnabled: boolean;
}> {
  let diskFiles = 0;
  let diskBytes = 0;
  try {
    await ensureDir();
    const files = await fs.readdir(CACHE_DIR);
    diskFiles = files.length;
    for (const f of files) {
      try {
        const stat = await fs.stat(path.join(CACHE_DIR, f));
        diskBytes += stat.size;
      } catch {}
    }
  } catch {}
  return { diskFiles, diskBytes, objStorageEnabled: !!getObjStorage() };
}
