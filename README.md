# Paimon

內部使用的模組化日常助理 Web（Sprint 1：個人檔案、模組開關、記事、飲食輪盤與飲食紀錄）。

## 需求

- Python 3.11+（已在 Python 3.14 驗證）
- Node.js 18+

## 啟動

### 後端

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
.\.venv\Scripts\python -m app.main
```

（或 `flask --app app.main:app run --port 8000 --debug`）

### 前端

```powershell
cd frontend
npm install
npm run dev
```

瀏覽器開啟：http://localhost:5173

1. 建立或選擇個人檔案  
2. 首頁進入「日常記事」「飲食」  
3. 「模組設定」可開關飲食／記事（遊戲、工作為 Sprint 2）

## API

- `GET /api/health` — 健康檢查  
- `GET/POST /api/users` — 個人檔案  
- `GET/PATCH /api/users/{id}/modules` — 模組開關  
- `GET/POST/PATCH/DELETE /api/users/{id}/notes` — 記事  
- `GET/POST/DELETE /api/users/{id}/diet/...` — 輪盤與飲食紀錄  

資料庫：`backend/paimon.db`（SQLite，自動建立）

## Sprint 1 驗收對照

- [x] 個人檔案選擇／建立，重新整理後保留（localStorage）  
- [x] 模組開關（飲食、記事；遊戲／工作標示 Sprint 2）  
- [x] 記事 CRUD、篩選  
- [x] 食物／飲料輪盤自訂與轉動  
- [x] 飲食紀錄列表  

## 技術棧

- 後端：Flask + SQLAlchemy + SQLite（本機開發用，相容 Python 3.14）  
- 前端：React + TypeScript + Vite  
- **GitHub Pages**：僅部署前端，資料存於瀏覽器 `localStorage`（無需後端）

---

## 部署到 GitHub Pages

與「蘑菇戰情室」相同，使用 GitHub Actions 自動發布靜態站點。

### 第一次設定

1. 在 GitHub 建立 repository（建議名稱 **`paimon`**，網址會是 `https://<使用者>.github.io/paimon/`）
2. 將本專案 push 到 `main` 分支：

```powershell
cd C:\Users\ytwei\Projects\paimon
git init
git add .
git commit -m "初始版本：Paimon Sprint 1"
git branch -M main
git remote add origin https://github.com/<你的帳號>/paimon.git
git push -u origin main
```

3. GitHub repo → **Settings → Pages → Build and deployment**
   - Source：**GitHub Actions**
4. push 後 Actions 會執行 `.github/workflows/deploy-pages.yml`，約 1～2 分鐘完成

### 運作方式

| 環境 | 資料儲存 |
|------|----------|
| 本機 `npm run dev` + 後端 | SQLite（`backend/paimon.db`） |
| GitHub Pages | 瀏覽器 `localStorage`（每台裝置／瀏覽器各自一份） |

> 若 repo 名稱不是 `paimon`，workflow 會自動用 `/你的-repo-名稱/` 作為路徑，無需手動改檔。

### 本機預覽 Pages 建置

```powershell
cd frontend
$env:VITE_STORAGE_MODE="local"
$env:VITE_BASE_PATH="/paimon/"
npm run build
npx serve dist
```

開啟終端顯示的網址（路徑需含 `/paimon/`）。
