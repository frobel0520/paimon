/**
 * GitHub Pages（localStorage）模式用的 Google Places 直連用戶端。
 * 本機開發時 Google 呼叫走後端，key 不會進到瀏覽器；
 * Pages 模式沒有後端，改由瀏覽器直接呼叫，key 存在此瀏覽器的 localStorage。
 */

import type { PlaceCandidate } from "./api";
import type { OpeningHours } from "./openStatus";

const KEY_STORAGE = "paimon_google_api_key";
const BASE = "https://places.googleapis.com/v1";
const SEARCH_FIELD_MASK = "places.id,places.displayName,places.formattedAddress";
const DETAIL_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "googleMapsUri",
  "businessStatus",
  "regularOpeningHours",
  "utcOffsetMinutes",
].join(",");

export type PlaceDetails = {
  name: string;
  address: string;
  maps_url: string;
  business_status: string;
  opening_hours: OpeningHours | null;
  utc_offset_minutes: number | null;
};

export function getGoogleApiKey(): string {
  return localStorage.getItem(KEY_STORAGE) ?? "";
}

export function setGoogleApiKey(key: string): void {
  if (key.trim()) localStorage.setItem(KEY_STORAGE, key.trim());
  else localStorage.removeItem(KEY_STORAGE);
}

async function call<T>(method: string, url: string, fieldMask: string, body?: unknown): Promise<T> {
  const key = getGoogleApiKey();
  if (!key) throw new Error("尚未設定 Google API key");
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": fieldMask,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    const msg = err?.error?.message ?? res.statusText;
    throw new Error(`Google Places API 錯誤（HTTP ${res.status}）：${msg}`);
  }
  return res.json();
}

type RawPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  googleMapsUri?: string;
  businessStatus?: string;
  regularOpeningHours?: OpeningHours;
  utcOffsetMinutes?: number;
};

export async function searchPlacesDirect(query: string): Promise<PlaceCandidate[]> {
  const data = await call<{ places?: RawPlace[] }>(
    "POST",
    `${BASE}/places:searchText`,
    SEARCH_FIELD_MASK,
    { textQuery: query, languageCode: "zh-TW", pageSize: 8 }
  );
  return (data.places ?? []).map((p) => ({
    place_id: p.id ?? "",
    name: p.displayName?.text ?? "",
    address: p.formattedAddress ?? "",
  }));
}

export async function fetchPlaceDetailsDirect(placeId: string): Promise<PlaceDetails> {
  const p = await call<RawPlace>(
    "GET",
    `${BASE}/places/${placeId}?languageCode=zh-TW`,
    DETAIL_FIELD_MASK
  );
  return {
    name: p.displayName?.text ?? "",
    address: p.formattedAddress ?? "",
    maps_url: p.googleMapsUri ?? "",
    business_status: p.businessStatus ?? "",
    opening_hours: p.regularOpeningHours ?? null,
    utc_offset_minutes: p.utcOffsetMinutes ?? null,
  };
}
