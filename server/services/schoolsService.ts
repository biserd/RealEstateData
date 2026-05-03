interface SchoolRaw {
  dbn: string;
  name: string;
  district: number | null;
  borough?: string | null;
  address: string | null;
  grade_band: string | null;
  overall_score?: number | null;
  academics_score: number | null;
  climate_score: number | null;
  progress_score: number | null;
  enrollment: number | null;
  student_teacher_ratio: number | null;
  graduation_rate_4yr?: number | null;
  ela_proficiency: number | null;
  math_proficiency: number | null;
  latitude: number | null;
  longitude: number | null;
  zip_code?: string | null;
  has_prek?: boolean;
  has_3k?: boolean;
  has_gifted_talented?: boolean;
  has_dual_language?: boolean;
  website?: string | null;
  phone?: string | null;
}

export interface NearbySchool {
  dbn: string;
  name: string;
  district: number | null;
  address: string | null;
  gradeBand: string | null;
  academicsScore: number | null;
  climateScore: number | null;
  progressScore: number | null;
  overallScore: number | null;
  enrollment: number | null;
  studentTeacherRatio: number | null;
  graduationRate4yr: number | null;
  elaProficiency: number | null;
  mathProficiency: number | null;
  latitude: number;
  longitude: number;
  zipCode: string | null;
  distanceMiles: number;
  detailUrl: string;
  hasPrek: boolean;
  has3k: boolean;
  hasGiftedTalented: boolean;
  hasDualLanguage: boolean;
}

const BASE = "https://nycschoolsratings.com";
const PUBLIC_URL = `${BASE}/api/schools`;
const V1_URL = `${BASE}/api/v1/schools`;
const V1_PAGE_SIZE = 200;
const TTL_MS = 24 * 60 * 60 * 1000;

let cache: { fetchedAt: number; schools: SchoolRaw[]; source: "v1" | "public" } | null = null;
let inFlight: Promise<SchoolRaw[]> | null = null;

async function fetchV1(apiKey: string): Promise<SchoolRaw[]> {
  const all: SchoolRaw[] = [];
  let offset = 0;
  while (true) {
    const res = await fetch(`${V1_URL}?limit=${V1_PAGE_SIZE}&offset=${offset}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!res.ok) {
      throw new Error(`v1 schools API ${res.status} at offset ${offset}`);
    }
    const json = (await res.json()) as {
      data: SchoolRaw[];
      pagination: { total: number; limit: number; offset: number };
    };
    all.push(...json.data);
    const total = json.pagination?.total ?? all.length;
    offset += json.data.length;
    if (!json.data.length || all.length >= total) break;
    if (offset > 50000) break;
  }
  return all;
}

async function fetchPublic(): Promise<SchoolRaw[]> {
  const res = await fetch(PUBLIC_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`public schools API ${res.status}`);
  return (await res.json()) as SchoolRaw[];
}

async function loadSchools(): Promise<SchoolRaw[]> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return cache.schools;
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const apiKey = process.env.NYC_SCHOOLS_API_KEY;
    try {
      let schools: SchoolRaw[];
      let source: "v1" | "public";
      if (apiKey) {
        try {
          schools = await fetchV1(apiKey);
          source = "v1";
        } catch (err) {
          console.warn("[schoolsService] v1 fetch failed, falling back to public:", err);
          schools = await fetchPublic();
          source = "public";
        }
      } else {
        schools = await fetchPublic();
        source = "public";
      }
      cache = { fetchedAt: Date.now(), schools, source };
      console.log(`[schoolsService] cached ${schools.length} schools from ${source}`);
      return schools;
    } catch (err) {
      console.error("[schoolsService] failed to refresh:", err);
      if (cache) return cache.schools; // serve stale
      throw err;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3958.7613; // miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function average(...nums: Array<number | null>): number | null {
  const vals = nums.filter((n): n is number => typeof n === "number");
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.'']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildSchoolUrl(dbn: string, name: string): string {
  return `https://nycschoolsratings.com/school/${dbn.toLowerCase()}-${slugifyName(name)}`;
}

export async function getNearbySchools(
  lat: number,
  lon: number,
  opts: { limit?: number; radiusMiles?: number } = {},
): Promise<NearbySchool[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? 5, 25));
  const radius = opts.radiusMiles ?? 1.5;

  const schools = await loadSchools();
  const withDistance: NearbySchool[] = [];

  for (const s of schools) {
    if (typeof s.latitude !== "number" || typeof s.longitude !== "number") continue;
    const d = haversineMiles(lat, lon, s.latitude, s.longitude);
    if (d > radius) continue;
    withDistance.push({
      dbn: s.dbn,
      name: s.name,
      district: s.district,
      address: s.address,
      gradeBand: s.grade_band,
      academicsScore: s.academics_score,
      climateScore: s.climate_score,
      progressScore: s.progress_score,
      overallScore: s.overall_score ?? average(s.academics_score, s.climate_score, s.progress_score),
      enrollment: s.enrollment,
      studentTeacherRatio: s.student_teacher_ratio,
      graduationRate4yr: s.graduation_rate_4yr,
      elaProficiency: s.ela_proficiency,
      mathProficiency: s.math_proficiency,
      latitude: s.latitude,
      longitude: s.longitude,
      zipCode: s.zip_code,
      distanceMiles: Math.round(d * 100) / 100,
      detailUrl: buildSchoolUrl(s.dbn, s.name),
      hasPrek: !!s.has_prek,
      has3k: !!s.has_3k,
      hasGiftedTalented: !!s.has_gifted_talented,
      hasDualLanguage: !!s.has_dual_language,
    });
  }

  withDistance.sort((a, b) => {
    const sa = a.overallScore ?? -1;
    const sb = b.overallScore ?? -1;
    if (sb !== sa) return sb - sa;
    return a.distanceMiles - b.distanceMiles;
  });
  return withDistance.slice(0, limit);
}
