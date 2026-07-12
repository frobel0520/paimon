import { useCallback, useEffect, useRef, useState } from "react";
import { api, FavoritePlace, PlaceCandidate, PlacesList, useLocalStorage } from "../api";
import { setGoogleApiKey } from "../googleClient";
import { computeOpenStatus, daysSince } from "../openStatus";

function StatusPill({ place, now }: { place: FavoritePlace; now: Date }) {
  const status = computeOpenStatus(
    place.opening_hours,
    place.utc_offset_minutes,
    place.business_status,
    now
  );
  switch (status.state) {
    case "open":
      return <span className="pill open">營業中 · {status.detail}</span>;
    case "closed":
      return <span className="pill closed">已打烊 · {status.detail}</span>;
    case "temp_closed":
      return <span className="pill warn">暫停營業</span>;
    case "perm_closed":
      return <span className="pill warn">已歇業</span>;
    default:
      return <span className="pill unknown">營業時間不明</span>;
  }
}

function PlaceRow({
  place,
  now,
  refreshing,
  onRefresh,
  onDelete,
}: {
  place: FavoritePlace;
  now: Date;
  refreshing: boolean;
  onRefresh: () => void;
  onDelete: () => void;
}) {
  const days = daysSince(place.last_refreshed, now);
  return (
    <div className="place-item">
      <div className="place-main">
        <div className="place-title">
          <span className="place-name">{place.name}</span>
          <StatusPill place={place} now={now} />
        </div>
        <div className="sub">{place.address}</div>
        {place.opening_hours?.weekdayDescriptions && (
          <details className="hours-details">
            <summary className="sub">每週營業時間</summary>
            <ul className="hours-list sub">
              {place.opening_hours.weekdayDescriptions.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </details>
        )}
        <div className="sub place-meta">
          資料更新於 {days < 1 ? "今天" : `${Math.floor(days)} 天前`}
          {place.maps_url && (
            <>
              {" · "}
              <a href={place.maps_url} target="_blank" rel="noreferrer">
                在 Google 地圖開啟
              </a>
            </>
          )}
        </div>
      </div>
      <div className="place-actions">
        <button type="button" className="btn secondary" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "更新中…" : "更新"}
        </button>
        <button type="button" className="btn danger" onClick={onDelete}>
          刪除
        </button>
      </div>
    </div>
  );
}

/** GitHub Pages 模式：Google API key 存於此瀏覽器 */
function ApiKeyCard({ onSaved }: { onSaved: () => void }) {
  const [key, setKey] = useState("");
  return (
    <div className="card">
      <h2>設定 Google API key</h2>
      <p className="sub">
        此模式沒有後端，需在瀏覽器直接呼叫 Google Places API。key 只會存在這個瀏覽器的
        localStorage，建議在 Google Cloud 以「網站限制」與「僅限 Places API」保護此 key。
      </p>
      <input
        type="text"
        placeholder="貼上 API key"
        value={key}
        onChange={(e) => setKey(e.target.value)}
      />
      <button
        type="button"
        className="btn"
        disabled={!key.trim()}
        onClick={() => {
          setGoogleApiKey(key);
          setKey("");
          onSaved();
        }}
      >
        儲存
      </button>
    </div>
  );
}

export default function PlacesPage({ userId }: { userId: number }) {
  const [data, setData] = useState<PlacesList | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<PlaceCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState("");
  const [refreshingIds, setRefreshingIds] = useState<Set<number>>(new Set());
  const [now, setNow] = useState(() => new Date());
  const autoRefreshed = useRef(false);

  // 每分鐘重算一次營業狀態
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(() => {
    api
      .listPlaces(userId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "載入失敗"));
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const updateRow = (updated: FavoritePlace) => {
    setData((d) =>
      d ? { ...d, places: d.places.map((p) => (p.id === updated.id ? updated : p)) } : d
    );
  };

  const refresh = useCallback(
    async (place: FavoritePlace, silent = false) => {
      setRefreshingIds((s) => new Set(s).add(place.id));
      try {
        const updated = await api.refreshPlace(userId, place.id);
        updateRow(updated);
      } catch (e) {
        if (!silent) setError(e instanceof Error ? e.message : "更新失敗");
      } finally {
        setRefreshingIds((s) => {
          const next = new Set(s);
          next.delete(place.id);
          return next;
        });
      }
    },
    [userId]
  );

  // 進頁面時背景更新過期資料（逐一進行，控制 API 用量）
  useEffect(() => {
    if (!data || !data.google_configured || autoRefreshed.current) return;
    autoRefreshed.current = true;
    const stale = data.places.filter((p) => daysSince(p.last_refreshed) >= data.refresh_days);
    (async () => {
      for (const p of stale) {
        await refresh(p, true);
      }
    })();
  }, [data, refresh]);

  const search = async () => {
    setError("");
    setSearching(true);
    setCandidates(null);
    try {
      setCandidates(await api.searchPlaces(userId, query.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "搜尋失敗");
    } finally {
      setSearching(false);
    }
  };

  const add = async (candidate: PlaceCandidate) => {
    setError("");
    setAddingId(candidate.place_id);
    try {
      await api.addPlace(userId, candidate.place_id);
      setCandidates(null);
      setQuery("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "新增失敗");
    } finally {
      setAddingId("");
    }
  };

  const remove = async (place: FavoritePlace) => {
    setError("");
    try {
      await api.deletePlace(userId, place.id);
      setData((d) => (d ? { ...d, places: d.places.filter((p) => p.id !== place.id) } : d));
    } catch (e) {
      setError(e instanceof Error ? e.message : "刪除失敗");
    }
  };

  if (!data) {
    return error ? <p className="error">{error}</p> : <p className="sub">載入中…</p>;
  }

  const needKey = !data.google_configured;

  return (
    <>
      {needKey && useLocalStorage && <ApiKeyCard onSaved={load} />}
      {needKey && !useLocalStorage && (
        <div className="card">
          <h2>尚未設定 Google API key</h2>
          <p className="sub">
            請在 backend/.env 設定 GOOGLE_MAPS_API_KEY（參考 backend/.env.example），
            重新啟動後端後即可搜尋與更新店家。已收藏的店家仍會以快取資料顯示。
          </p>
        </div>
      )}
      <div className="card">
        <h2>新增店家</h2>
        <input
          type="text"
          placeholder="輸入店名搜尋，例如：八方雲集 內湖"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && query.trim() && !searching && search()}
        />
        <button
          type="button"
          className="btn"
          onClick={search}
          disabled={!query.trim() || searching || needKey}
        >
          {searching ? "搜尋中…" : "搜尋"}
        </button>
        {error && <p className="error">{error}</p>}
        {candidates && candidates.length === 0 && <p className="sub">找不到符合的店家</p>}
        {candidates?.map((c) => (
          <div key={c.place_id} className="option-item">
            <div style={{ flex: 1 }}>
              <div>{c.name}</div>
              <div className="sub">{c.address}</div>
            </div>
            <button
              type="button"
              className="btn secondary"
              onClick={() => add(c)}
              disabled={!!addingId}
            >
              {addingId === c.place_id ? "加入中…" : "加入"}
            </button>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>常去店家</h2>
        {data.places.length === 0 && <p className="sub">尚未收藏任何店家，先在上方搜尋加入吧</p>}
        {data.places.map((p) => (
          <PlaceRow
            key={p.id}
            place={p}
            now={now}
            refreshing={refreshingIds.has(p.id)}
            onRefresh={() => refresh(p)}
            onDelete={() => remove(p)}
          />
        ))}
        {useLocalStorage && data.google_configured && (
          <p className="sub">
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setGoogleApiKey("");
                load();
              }}
            >
              清除此瀏覽器儲存的 Google API key
            </button>
          </p>
        )}
      </div>
    </>
  );
}
