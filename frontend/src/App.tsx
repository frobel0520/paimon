import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api, Modules, useLocalStorage, User } from "./api";
import { useUser } from "./context/UserContext";
import DietPage from "./pages/DietPage";
import NotesPage from "./pages/NotesPage";
import PlacesPage from "./pages/PlacesPage";
import SettingsPage from "./pages/SettingsPage";

function ProfileSelect() {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { login } = useUser();
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    api
      .listUsers()
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const enterProfile = (id: number) => {
    setError("");
    login(id);
    navigate("/", { replace: true });
  };

  const create = async () => {
    setError("");
    setCreating(true);
    try {
      const u = await api.createUser(name.trim());
      setName("");
      await api.listUsers().then(setUsers);
      enterProfile(u.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "建立失敗");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="header">
        <span className="logo">Paimon</span>
      </div>
      <p className="sub">
        選擇個人檔案或建立新的（內部使用）
        {useLocalStorage && (
          <>
            <br />
            資料儲存在此瀏覽器（GitHub Pages 模式）
          </>
        )}
      </p>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <h2>現有檔案</h2>
        {loading ? (
          <p className="sub">載入中…</p>
        ) : (
          <ul className="profile-list">
            {users.map((u) => (
              <li key={u.id}>
                <button type="button" className="profile-btn" onClick={() => enterProfile(u.id)}>
                  {u.name}
                </button>
              </li>
            ))}
            {users.length === 0 && <p className="sub">尚無檔案，請建立</p>}
          </ul>
        )}
      </div>
      <div className="card">
        <h2>新建檔案</h2>
        <input
          type="text"
          placeholder="顯示名稱"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && create()}
        />
        <button
          className="btn"
          type="button"
          onClick={create}
          disabled={!name.trim() || creating}
        >
          {creating ? "建立中…" : "建立並進入"}
        </button>
      </div>
    </div>
  );
}

function Dashboard() {
  const { userId, logout } = useUser();
  const [modules, setModules] = useState<Modules | null>(null);
  const [modulesError, setModulesError] = useState("");
  const [userName, setUserName] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;
    setModulesError("");
    api
      .getModules(userId)
      .then(setModules)
      .catch((e) => {
        setModulesError(e instanceof Error ? e.message : "無法載入模組");
        setModules(null);
      });
    api
      .listUsers()
      .then((list) => {
        const u = list.find((x) => x.id === userId);
        if (u) setUserName(u.name);
      })
      .catch(() => setUserName(""));
  }, [userId]);

  if (!userId) return <Navigate to="/profiles" replace />;

  const switchProfile = () => {
    logout();
    navigate("/profiles", { replace: true });
  };

  type ModuleItem = {
    key: string;
    title: string;
    path: string;
    enabled?: boolean;
    locked?: boolean;
    label?: string;
  };

  const items: ModuleItem[] = [
    { key: "notes", title: "日常記事", path: "/notes", enabled: modules?.notes },
    { key: "diet", title: "飲食", path: "/diet", enabled: modules?.diet },
    { key: "places", title: "常去店家", path: "/places", enabled: modules?.places },
    {
      key: "games",
      title: "遊戲",
      path: "#",
      enabled: false,
      locked: true,
      label: "Sprint 2",
    },
    {
      key: "work",
      title: "工作",
      path: "#",
      enabled: false,
      locked: true,
      label: "Sprint 2",
    },
  ];

  const modulesReady = modules !== null;

  return (
    <div className="app-shell">
      <div className="header">
        <div>
          <div className="logo">Paimon</div>
          <div className="sub">你好，{userName || "…"}</div>
        </div>
        <button type="button" className="btn secondary" onClick={switchProfile}>
          切換檔案
        </button>
      </div>
      {modulesError && (
        <p className="error">
          {modulesError}
          {!useLocalStorage && (
            <>
              <br />
              <span className="sub">請確認後端是否在 http://127.0.0.1:8000 執行中</span>
            </>
          )}
        </p>
      )}
      <div className="card">
        <h2>模組</h2>
        {!modulesReady && !modulesError && <p className="sub">載入模組中…</p>}
        <div className="grid-modules">
          {items.map((item) => {
            const off =
              item.locked || (modulesReady && item.enabled === false);
            const cls = `module-card${off ? " disabled" : ""}`;
            if (off) {
              return (
                <span key={item.key} className={cls}>
                  {item.title}
                  {item.label && <span className="badge">{item.label}</span>}
                </span>
              );
            }
            if (!modulesReady && !item.locked) {
              return (
                <span key={item.key} className="module-card disabled">
                  {item.title}
                </span>
              );
            }
            return (
              <Link key={item.key} to={item.path} className={cls.replace(" disabled", "")}>
                {item.title}
              </Link>
            );
          })}
        </div>
        <div className="btn-row">
          <Link to="/settings" className="btn secondary">
            模組設定
          </Link>
        </div>
      </div>
    </div>
  );
}

function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <Link to="/" className="nav-back">
        ← 回首頁
      </Link>
      {children}
    </>
  );
}

function RequireUser({ children }: { children: (userId: number) => ReactNode }) {
  const { userId } = useUser();
  if (!userId) return <Navigate to="/profiles" replace />;
  return <>{children(userId)}</>;
}

export default function App() {
  const { userId } = useUser();

  return (
    <Routes>
      <Route path="/profiles" element={<ProfileSelect />} />
      <Route
        path="/"
        element={userId ? <Dashboard /> : <Navigate to="/profiles" replace />}
      />
      <Route
        path="/notes"
        element={
          <RequireUser>
            {(uid) => (
              <div className="app-shell">
                <Layout>
                  <NotesPage userId={uid} />
                </Layout>
              </div>
            )}
          </RequireUser>
        }
      />
      <Route
        path="/diet"
        element={
          <RequireUser>
            {(uid) => (
              <div className="app-shell">
                <Layout>
                  <DietPage userId={uid} />
                </Layout>
              </div>
            )}
          </RequireUser>
        }
      />
      <Route
        path="/places"
        element={
          <RequireUser>
            {(uid) => (
              <div className="app-shell">
                <Layout>
                  <PlacesPage userId={uid} />
                </Layout>
              </div>
            )}
          </RequireUser>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireUser>
            {(uid) => (
              <div className="app-shell">
                <Layout>
                  <SettingsPage userId={uid} />
                </Layout>
              </div>
            )}
          </RequireUser>
        }
      />
      <Route path="*" element={<Navigate to={userId ? "/" : "/profiles"} replace />} />
    </Routes>
  );
}
