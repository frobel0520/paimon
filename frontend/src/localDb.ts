import type { FavoritePlace } from "./api";
import type { PlaceDetails } from "./googleClient";

const DB_KEY = "paimon_db_v2";
const LEGACY_KEY = "paimon_db_v1"; // 多使用者時代的資料，保留不刪（可當備份）

type DbShape = {
  places: FavoritePlace[];
  nextPlaceId: number;
};

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, ".000Z");
}

function loadDb(): DbShape {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) {
    return { places: [], nextPlaceId: 1, ...(JSON.parse(raw) as Partial<DbShape>) };
  }
  return migrateLegacy();
}

/** 第一次啟動時，把 v1（各使用者分開）的店家收藏合併搬進 v2 */
function migrateLegacy(): DbShape {
  const db: DbShape = { places: [], nextPlaceId: 1 };
  const raw = localStorage.getItem(LEGACY_KEY);
  if (raw) {
    try {
      const legacy = JSON.parse(raw) as {
        places?: Array<FavoritePlace & { user_id?: number }>;
      };
      const seen = new Set<string>();
      for (const entry of legacy.places ?? []) {
        if (seen.has(entry.place_id)) continue;
        seen.add(entry.place_id);
        const { user_id: _, ...place } = entry;
        db.places.push({ ...place, id: db.nextPlaceId++ });
      }
    } catch {
      // 舊資料無法解析就從空的開始
    }
  }
  saveDb(db);
  return db;
}

function saveDb(db: DbShape): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export const localDb = {
  listPlaces(): FavoritePlace[] {
    return loadDb().places.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  },

  getPlace(favId: number): FavoritePlace {
    const place = loadDb().places.find((p) => p.id === favId);
    if (!place) throw new Error("Place not found");
    return place;
  },

  addPlace(placeId: string, details: PlaceDetails): FavoritePlace {
    const db = loadDb();
    if (db.places.some((p) => p.place_id === placeId)) {
      throw new Error("此店家已在清單中");
    }
    const t = nowIso();
    const place: FavoritePlace = {
      id: db.nextPlaceId++,
      place_id: placeId,
      ...details,
      last_refreshed: t,
      created_at: t,
    };
    db.places.push(place);
    saveDb(db);
    return place;
  },

  updatePlace(favId: number, details: PlaceDetails): FavoritePlace {
    const db = loadDb();
    const place = db.places.find((p) => p.id === favId);
    if (!place) throw new Error("Place not found");
    Object.assign(place, details, { last_refreshed: nowIso() });
    saveDb(db);
    return place;
  },

  deletePlace(favId: number): void {
    const db = loadDb();
    const idx = db.places.findIndex((p) => p.id === favId);
    if (idx < 0) throw new Error("Place not found");
    db.places.splice(idx, 1);
    saveDb(db);
  },
};
