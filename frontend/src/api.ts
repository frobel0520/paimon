import {
  fetchPlaceDetailsDirect,
  getGoogleApiKey,
  searchPlacesDirect,
} from "./googleClient";
import { localDb } from "./localDb";
import type { OpeningHours } from "./openStatus";

export type FavoritePlace = {
  id: number;
  place_id: string;
  name: string;
  address: string;
  maps_url: string;
  business_status: string;
  opening_hours: OpeningHours | null;
  utc_offset_minutes: number | null;
  last_refreshed: string;
  created_at: string;
};
export type PlaceCandidate = { place_id: string; name: string; address: string };
export type PlacesList = {
  google_configured: boolean;
  refresh_days: number;
  places: FavoritePlace[];
};

/** GitHub Pages 使用 local；本機開發預設連後端 API */
export const useLocalStorage = import.meta.env.VITE_STORAGE_MODE === "local";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

const remoteApi = {
  listPlaces: () => request<PlacesList>("/api/places"),
  searchPlaces: (q: string) =>
    request<PlaceCandidate[]>(`/api/places/search?q=${encodeURIComponent(q)}`),
  addPlace: (placeId: string) =>
    request<FavoritePlace>("/api/places", {
      method: "POST",
      body: JSON.stringify({ place_id: placeId }),
    }),
  refreshPlace: (favId: number) =>
    request<FavoritePlace>(`/api/places/${favId}/refresh`, { method: "POST" }),
  deletePlace: (favId: number) =>
    request<void>(`/api/places/${favId}`, { method: "DELETE" }),
};

const localApi = {
  listPlaces: async (): Promise<PlacesList> => ({
    google_configured: !!getGoogleApiKey(),
    refresh_days: 7,
    places: localDb.listPlaces(),
  }),
  searchPlaces: async (q: string) => searchPlacesDirect(q),
  addPlace: async (placeId: string) => {
    const details = await fetchPlaceDetailsDirect(placeId);
    return localDb.addPlace(placeId, details);
  },
  refreshPlace: async (favId: number) => {
    const place = localDb.getPlace(favId);
    const details = await fetchPlaceDetailsDirect(place.place_id);
    return localDb.updatePlace(favId, details);
  },
  deletePlace: async (favId: number) => {
    localDb.deletePlace(favId);
  },
};

export const api = useLocalStorage ? localApi : remoteApi;
