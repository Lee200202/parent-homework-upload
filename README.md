# 數學家教・家長作業繳交

手機與電腦通用的照片 / PDF 上傳頁，每檔 10 MiB（介面標示 10 MB）。

前台由 GitHub Pages 提供固定入口，嵌入 Google Apps Script 網頁應用程式。家長免登入 Google；程式以部署者身分將檔案寫入指定 Drive 資料夾。Google 存取權杖與可續傳網址留在伺服器。

## 維護

- `apps-script/Code.gs` 的 `SETTINGS.students` 管理名單；每位學生使用穩定、不重複的 `id`。
- `apps-script/Index.html` 是完整的響應式介面。
- 上傳時自動建立「課程＿姓名」子資料夾，以時間、收件碼與原始檔名命名。
- 以 1 MiB 區塊上傳；進度依 Google Drive 實際確認的位元組更新。失敗重試會先向 Drive 查詢進度，避免重傳已收妥的檔案。重新整理後須重新選檔；未完成的 Google 可續傳連線會自行到期。
- 前後端皆檢查檔案大小、副檔名及檔頭；支援 PDF、JPEG、PNG、WebP、HEIC / HEIF，不收影片或 SVG。
- 名單選單是收件分類，不是身分驗證。網站不提供檔案清單、下載或刪除功能。目標 Drive 原有共用設定不會被程式修改。
- 明暗偏好儲存在使用者瀏覽器；檔案、姓名與收件紀錄不寫入瀏覽器永久儲存。

## 更新與驗收

1. `npm run check`
2. `clasp -P .clasp.json push`，建立新版本後更新既有部署；保留相同 `/exec` 網址。
3. GitHub Pages 使用 `main` 分支根目錄的 `index.html`。
4. 用正式網址測試照片與 PDF，核對 Drive 中檔案大小、內容；測試 10 MiB 邊界、超過上限、改副檔名、失敗重試、明暗模式與手機寬度。

Google 配額與 Drive 剩餘空間由部署帳號承擔。首次部署需由帳號持有人授權 Drive 與外部連線。
