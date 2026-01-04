const NYC_GEOCLIENT_API = "https://api.nyc.gov/geoclient/v2";

export interface GeoclientAddressResult {
  success: boolean;
  normalizedAddress?: string;
  bbl?: string;
  bin?: string;
  latitude?: number;
  longitude?: number;
  borough?: string;
  zipCode?: string;
  streetName?: string;
  houseNumber?: string;
  confidence: number;
  error?: string;
}

interface GeoclientApiResponse {
  address?: {
    bbl?: string;
    buildingIdentificationNumber?: string;
    boePreferredStreetName?: string;
    giStreetName1?: string;
    houseNumber?: string;
    latitude?: string;
    longitude?: string;
    zipCode?: string;
    uspsPreferredCityName?: string;
    boroughCode1In?: string;
    message?: string;
    message2?: string;
    geosupportReturnCode?: string;
    geosupportReturnCode2?: string;
    reasonCode?: string;
  };
}

const BOROUGH_MAP: Record<string, string> = {
  MANHATTAN: "1",
  MN: "1",
  "NEW YORK": "1",
  BRONX: "2",
  BX: "2",
  BROOKLYN: "3",
  BK: "3",
  KINGS: "3",
  QUEENS: "4",
  QN: "4",
  "STATEN ISLAND": "5",
  SI: "5",
  RICHMOND: "5",
};

function getApiKey(): string | null {
  return process.env.NYC_GEOCLIENT_API_KEY || null;
}

export function isGeoclientAvailable(): boolean {
  return !!getApiKey();
}

function parseBoroughCode(input: string): string | null {
  const normalized = input.toUpperCase().trim();
  if (BOROUGH_MAP[normalized]) return BOROUGH_MAP[normalized];
  if (/^[1-5]$/.test(normalized)) return normalized;
  return null;
}

function parseHouseNumberAndStreet(address: string): { houseNumber: string; street: string } | null {
  const match = address.match(/^(\d+[-\d]*)\s+(.+)$/);
  if (match) {
    return { houseNumber: match[1], street: match[2] };
  }
  return null;
}

export async function normalizeAddress(
  address: string,
  boroughOrZip: string
): Promise<GeoclientAddressResult> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      success: false,
      confidence: 0,
      error: "NYC Geoclient API key not configured. Set NYC_GEOCLIENT_API_KEY to enable address normalization.",
    };
  }

  const parsed = parseHouseNumberAndStreet(address);
  if (!parsed) {
    return {
      success: false,
      confidence: 0,
      error: `Could not parse house number from address: ${address}`,
    };
  }

  const params = new URLSearchParams({
    houseNumber: parsed.houseNumber,
    street: parsed.street,
  });

  const boroughCode = parseBoroughCode(boroughOrZip);
  if (boroughCode) {
    const boroughNames = ["", "manhattan", "bronx", "brooklyn", "queens", "staten island"];
    params.set("borough", boroughNames[parseInt(boroughCode)]);
  } else if (/^\d{5}$/.test(boroughOrZip)) {
    params.set("zip", boroughOrZip);
  } else {
    return {
      success: false,
      confidence: 0,
      error: `Invalid borough or ZIP code: ${boroughOrZip}`,
    };
  }

  try {
    const url = `${NYC_GEOCLIENT_API}/address.json?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        confidence: 0,
        error: `Geoclient API error: ${response.status} - ${errorText.substring(0, 200)}`,
      };
    }

    const data: GeoclientApiResponse = await response.json();

    if (!data.address) {
      return {
        success: false,
        confidence: 0,
        error: "No address data in response",
      };
    }

    const addr = data.address;
    const returnCode = addr.geosupportReturnCode || "";
    const isSuccess = returnCode === "00" || returnCode === "01";

    if (!isSuccess) {
      return {
        success: false,
        confidence: 0,
        error: addr.message || addr.message2 || `Geoclient return code: ${returnCode}`,
      };
    }

    const normalizedStreet = addr.boePreferredStreetName || addr.giStreetName1 || parsed.street;
    const normalizedAddress = `${addr.houseNumber || parsed.houseNumber} ${normalizedStreet}`.toUpperCase().trim();

    return {
      success: true,
      normalizedAddress,
      bbl: addr.bbl || undefined,
      bin: addr.buildingIdentificationNumber || undefined,
      latitude: addr.latitude ? parseFloat(addr.latitude) : undefined,
      longitude: addr.longitude ? parseFloat(addr.longitude) : undefined,
      borough: addr.boroughCode1In || undefined,
      zipCode: addr.zipCode || undefined,
      streetName: normalizedStreet,
      houseNumber: addr.houseNumber || parsed.houseNumber,
      confidence: returnCode === "00" ? 1.0 : 0.9,
    };
  } catch (error: any) {
    return {
      success: false,
      confidence: 0,
      error: `Geoclient request failed: ${error.message}`,
    };
  }
}

export async function batchNormalizeAddresses(
  addresses: Array<{ address: string; boroughOrZip: string }>,
  options: { 
    maxPerSecond?: number;
    maxConcurrent?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<GeoclientAddressResult[]> {
  const { maxPerSecond = 40, onProgress } = options;
  const maxConcurrent = Math.min(options.maxConcurrent ?? 10, maxPerSecond);
  const results: GeoclientAddressResult[] = [];
  const delayMs = Math.ceil(1000 / maxPerSecond * maxConcurrent);

  if (!isGeoclientAvailable()) {
    return addresses.map(() => ({
      success: false,
      confidence: 0,
      error: "NYC Geoclient API key not configured",
    }));
  }

  console.log(`  Processing ${addresses.length} addresses (${maxPerSecond}/sec, ${maxConcurrent} concurrent)`);

  for (let i = 0; i < addresses.length; i += maxConcurrent) {
    const batch = addresses.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map((a) => normalizeAddress(a.address, a.boroughOrZip))
    );
    results.push(...batchResults);

    if (onProgress) {
      onProgress(results.length, addresses.length);
    }

    if (i + maxConcurrent < addresses.length && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

export function simpleAddressNormalize(address: string): string {
  return address
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\bSTREET\b/g, "ST")
    .replace(/\bAVENUE\b/g, "AVE")
    .replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bDRIVE\b/g, "DR")
    .replace(/\bLANE\b/g, "LN")
    .replace(/\bROAD\b/g, "RD")
    .replace(/\bCOURT\b/g, "CT")
    .replace(/\bPLACE\b/g, "PL")
    .replace(/\bCIRCLE\b/g, "CIR")
    .replace(/\bTERRACE\b/g, "TER")
    .replace(/\bNORTH\b/g, "N")
    .replace(/\bSOUTH\b/g, "S")
    .replace(/\bEAST\b/g, "E")
    .replace(/\bWEST\b/g, "W")
    .replace(/\bAPARTMENT\b/g, "APT")
    .replace(/\bSUITE\b/g, "STE")
    .replace(/\bFLOOR\b/g, "FL")
    .replace(/\./g, "")
    .replace(/,\s*APT\s+/g, " APT ")
    .replace(/,\s*UNIT\s+/g, " UNIT ")
    .replace(/,\s*#\s*/g, " #")
    .replace(/\s+/g, " ")
    .trim();
}
