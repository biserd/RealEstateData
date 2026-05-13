import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { Response } from "express";

const CACHE_DIR = path.join(process.cwd(), ".cache", "maps");

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

async function fetchAndCache(
  filename: string,
  url: string,
): Promise<Buffer> {
  const filePath = path.join(CACHE_DIR, filename);

  try {
    return await fs.readFile(filePath);
  } catch {
    // not cached, fall through
  }

  if (inflight.has(filename)) {
    return inflight.get(filename)!;
  }

  const promise = (async () => {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`upstream ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await ensureDir();
    await fs.writeFile(filePath, buf);
    return buf;
  })();

  inflight.set(filename, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(filename);
  }
}

function sendImage(res: Response, buf: Buffer, hit: boolean): void {
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("X-Cache", hit ? "HIT" : "MISS");
  res.send(buf);
}

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
  const filePath = path.join(CACHE_DIR, filename);

  let hit = true;
  let buf: Buffer;
  try {
    buf = await fs.readFile(filePath);
  } catch {
    hit = false;
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
      buf = await fetchAndCache(filename, url);
    } catch (err) {
      console.error("[mapImageCache] streetview fetch failed:", err);
      res.status(502).json({ message: "Failed to fetch street view" });
      return;
    }
  }
  sendImage(res, buf, hit);
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
  const filePath = path.join(CACHE_DIR, filename);

  let hit = true;
  let buf: Buffer;
  try {
    buf = await fs.readFile(filePath);
  } catch {
    hit = false;
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
      buf = await fetchAndCache(filename, url);
    } catch (err) {
      console.error("[mapImageCache] staticmap fetch failed:", err);
      res.status(502).json({ message: "Failed to fetch static map" });
      return;
    }
  }
  sendImage(res, buf, hit);
}

export async function getCacheStats(): Promise<{ files: number; bytes: number }> {
  try {
    await ensureDir();
    const files = await fs.readdir(CACHE_DIR);
    let bytes = 0;
    for (const f of files) {
      try {
        const stat = await fs.stat(path.join(CACHE_DIR, f));
        bytes += stat.size;
      } catch {}
    }
    return { files: files.length, bytes };
  } catch {
    return { files: 0, bytes: 0 };
  }
}
