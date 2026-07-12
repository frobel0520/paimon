# Paimon — 常去店家

收藏常去的飲食店家，隨時查看「現在有沒有開」。資料來源：Google Places API (New)。

- 以店名搜尋 Google 店家並收藏
- 清單即時顯示 營業中／已打烊／幾點開門（含跨夜時段）、每週營業時間、Google 地圖連結
- 營業時段快取在本地（SQLite 或瀏覽器 localStorage），「現在是否營業」由前端計算；
  只有新增店家、按「更新」、或快取超過 `PLACES_REFRESH_DAYS`（預設 7 天）才呼叫 Google，
  正常使用遠低於免費額度（Text Search Pro 5,000 次/月、Place Details Enterprise 1,000 次/月）

## 需求

- Python 3.11+（已在 Python 3.14 驗證）
- Node.js 18+
- Google Maps API key（啟用 **Places API (New)**）

## 啟動（本機）

### 後端

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env   # 貼上你的 GOOGLE_MAPS_API_KEY
.\.venv\Scripts\python -m app.main
```

（或 `flask --app app.main:app run --port 8000 --debug`）

### 前端

```powershell
cd frontend
npm install
npm run dev
```

瀏覽器開啟 http://localhost:5173，直接進入店家頁。

## API

- `GET /api/health` — 健康檢查
- `GET /api/places` — 收藏清單（含快取的營業時段）
- `GET /api/places/search?q=` — 以店名搜尋 Google 店家
- `POST /api/places` — 加入收藏（body: `{place_id}`）
- `POST /api/places/{id}/refresh` — 重新抓取店家資料
- `DELETE /api/places/{id}` — 移除收藏

資料庫：`backend/paimon.db`（SQLite，自動建立）。
舊版（多模組時代）的資料表會在第一次啟動時自動移除，
整個舊 DB 會先備份成 `backend/paimon.db.bak`，店家收藏自動搬移。

## GitHub Pages（localStorage）模式

僅部署前端、無後端，資料與 API key 存在瀏覽器 localStorage：

- push 到 `main` 後 GitHub Actions 自動部署（Settings → Pages → Source: GitHub Actions）
- 第一次進頁面時貼上 API key。此模式 key 會暴露於瀏覽器，
  請務必在 Google Cloud 對該 key 設定「網站限制」（如 `https://<帳號>.github.io/*`，
  **`/*` 結尾必要**）與「僅限 Places API (New)」，並與後端用的 key 分開兩把

### 本機預覽 Pages 建置

```powershell
cd frontend
$env:VITE_STORAGE_MODE="local"
$env:VITE_BASE_PATH="/paimon/"
npm run build
npx serve dist
```

## 技術棧

- 後端：Flask + SQLAlchemy + SQLite
- 前端：React + TypeScript + Vite
