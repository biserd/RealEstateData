import { useEffect, useState } from "react";

const STORAGE_KEY = "rd_anon_unit_views";
const LIMIT = 3;

interface ViewState {
  ids: string[];
  limitReached: boolean;
  count: number;
  remaining: number;
  reset: () => void;
}

function readStored(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeStored(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

/**
 * Tracks anonymous unit-page views in localStorage. After LIMIT distinct
 * views, `limitReached` is true. Authenticated users should bypass this
 * by passing `enabled: false`.
 */
export function useAnonUnitViewLimit(unitId: string | undefined, enabled: boolean): ViewState {
  const [ids, setIds] = useState<string[]>(() => readStored());

  useEffect(() => {
    if (!enabled || !unitId) return;
    setIds((prev) => {
      if (prev.includes(unitId)) return prev;
      const next = [...prev, unitId];
      writeStored(next);
      return next;
    });
  }, [unitId, enabled]);

  const count = ids.length;
  const limitReached = enabled && count > LIMIT;
  const remaining = Math.max(0, LIMIT - count);

  const reset = () => {
    writeStored([]);
    setIds([]);
  };

  return { ids, limitReached, count, remaining, reset };
}

export const ANON_UNIT_VIEW_LIMIT = LIMIT;
