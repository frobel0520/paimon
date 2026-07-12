import { useEffect, useState } from "react";
import { api, Modules } from "../api";

const LABELS: Record<keyof Modules, string> = {
  diet: "飲食",
  places: "常去店家",
  games: "遊戲",
  notes: "日常記事",
  work: "工作",
};

const SPRINT2: (keyof Modules)[] = ["games", "work"];

export default function SettingsPage({ userId }: { userId: number }) {
  const [modules, setModules] = useState<Modules | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.getModules(userId).then(setModules).catch((e) => setError(e.message));
  }, [userId]);

  const toggle = async (key: keyof Modules) => {
    if (!modules || SPRINT2.includes(key)) return;
    setError("");
    setMsg("");
    const next = !modules[key];
    try {
      const updated = await api.patchModules(userId, { [key]: next });
      setModules(updated);
      setMsg("已更新");
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失敗");
    }
  };

  if (!modules) return <p className="sub">載入中…</p>;

  return (
    <div className="card">
      <h2>模組設定</h2>
      <p className="sub">關閉後首頁不顯示該模組入口。遊戲／工作將於 Sprint 2 開放。</p>
      {Object.keys(LABELS).map((key) => {
        const k = key as keyof Modules;
        const locked = SPRINT2.includes(k);
        return (
          <div key={k} className={`toggle-row${locked ? " locked" : ""}`}>
            <span>
              {LABELS[k]}
              {locked && <span className="badge">Sprint 2</span>}
            </span>
            <button
              type="button"
              className="btn secondary"
              disabled={locked}
              onClick={() => toggle(k)}
            >
              {modules[k] ? "已開啟" : "已關閉"}
            </button>
          </div>
        );
      })}
      {error && <p className="error">{error}</p>}
      {msg && <p className="sub">{msg}</p>}
    </div>
  );
}
