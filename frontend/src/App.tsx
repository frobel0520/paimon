import PlacesPage from "./pages/PlacesPage";

export default function App() {
  return (
    <div className="app-shell">
      <div className="header">
        <div>
          <div className="logo">Paimon</div>
          <div className="sub">常去店家 · 現在有開嗎？</div>
        </div>
      </div>
      <PlacesPage />
    </div>
  );
}
