# 排程寫入 Google Sheet PWA

一個可安裝的 PWA（漸進式網頁應用程式），讓您輸入日期區間與間隔，自動產生排程並寫入 Google Sheets。

---

## 📂 檔案結構

```
/
├── index.html       # 主介面
├── manifest.json    # PWA 設定
├── sw.js            # Service Worker（離線 + 通知）
├── Code.gs          # Google Apps Script 後端（貼入 GAS 編輯器）
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── .nojekyll        # GitHub Pages 所需
```

---

## 🚀 部署步驟

### 一、設定 Google Apps Script

1. 開啟您的 Google Sheet：[點此開啟](https://docs.google.com/spreadsheets/d/1B7U_7wb8TQy2kIE9eGVVylxWjToPh52KoscPQ3nnymY/edit)
2. 點選選單列 **「擴充功能」→「Apps Script」**
3. 將 `Code.gs` 的全部內容複製，貼入 Apps Script 編輯器（取代預設內容）
4. 點選 **「部署」→「新增部署作業」**
5. 類型選 **「網頁應用程式」**
6. 設定：
   - **執行身分**：我的帳戶
   - **誰可以存取**：任何人
7. 點「部署」，複製產生的 **URL**
8. 將 URL 貼入 PWA 的「Apps Script 網頁應用程式 URL」欄位

> ⚠️ **注意**：若修改 `Code.gs` 後，需在「管理部署作業」中選擇「編輯」並將版本更新為「新版本」，URL 才會套用新版程式碼。

---

### 二、部署到 GitHub Pages

1. 將此資料夾所有檔案推送到 GitHub Repository
2. 進入 Repository → **Settings → Pages**
3. Source 選 **main branch / root 目錄**
4. 儲存後等待幾分鐘，即可透過 `https://<你的帳號>.github.io/<repo名稱>/` 訪問

```bash
git init
git add .
git commit -m "Initial PWA"
git remote add origin https://github.com/<你的帳號>/<你的repo>.git
git push -u origin main
```

> ✅ 必須透過 HTTPS（GitHub Pages）才能安裝 PWA 並啟用推播通知。

---

## 📱 使用方式

1. 開啟 PWA 網址 → 貼上 Apps Script URL
2. 設定**開始日期時間**與**結束日期時間**
3. 設定**間隔**（月/日/小時/分鐘，預設 0月1日0小時0分鐘）
4. 輸入 **C 欄內容**
5. 點「🔍 預覽」確認結果
6. 點「🚀 寫入 Google Sheet」送出

---

## 📌 A 欄格式說明

| 時間範圍 | 格式範例 |
|----------|----------|
| 上午（00:00–11:59） | `2026/5/31 上午 5:00` |
| 下午（12:00–23:59） | `2026/6/30 下午 3:30` |

- B 欄：A 欄有值時自動填入 `O`
- 資料從**第 2 列**開始寫入（第 1 列為標題）
- 若試算表已有資料，自動在最後一筆**空一列**後繼續寫入
- 若預計列數超出限制，PWA 會發出**通知警示**

---

## 🔔 PWA 通知

- 首次使用時瀏覽器會請求通知權限
- 當預覽筆數超過 1000 筆時自動提醒
- 需在 HTTPS 環境（GitHub Pages）下才能使用完整通知功能
