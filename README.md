# 小狗騎天鵝 🐶🦢

黃金獵犬騎著天鵝，一路收集愛心、躲開烏雲，每抵達一站就解鎖一段回憶，最後打開一封信。
純靜態網頁（HTML / CSS / JS），不需要後端或資料庫，手機直接開就能玩。

## 道具
- 加速（橘色閃電）：世界變快 5 秒，愛心來得快，但也更難躲。
- 緩速（藍色沙漏）：世界變慢 6 秒，比較好操作。
- 無敵（金色星星）：6 秒內直接撞散烏雲。
- 骨頭：回復一條命。

## 天氣（隨機出現，各 5～8 秒，結束後恢復正常）
- 下雨：翅膀變重，每次拍翅膀的力道變小、下墜較快，有雨聲。
- 起霧：烏雲要靠近才看得清楚，愛心會發光。
- 彩虹：這段時間每顆愛心算兩顆；雨停後常常會接著出現彩虹。

## 換成你們自己的內容
只需要改 `memories.js`：
- `herName`：標題畫面「給 ○○」
- `memories`：每一站的標題、日期、文字、照片
- `finale`：最後的信
- 照片放在 `photos/`，在 `photo` 欄位填 `"photos/01.jpg"`（建議先壓縮到 200KB 以內）

## 本機試玩
直接雙擊 `index.html` 即可。

## 發佈到 GitHub Pages（SourceTree）
1. 到 github.com 建立新 repository（例如 `dog-and-swan`），先不要勾選任何初始化檔案。
2. SourceTree → 新增 → **Clone / 或 Add 本機資料夾**：選 `D:\Projects\DogandSwan`，建立本機儲存庫。
3. 在「檔案狀態」把所有檔案 **暫存** → 填寫提交訊息 → **提交**。
4. 儲存庫 → 儲存庫設定 → 遠端 → 新增：貼上 GitHub repo 網址。
5. 按 **推送**，分支選 `main`。
6. GitHub repo → Settings → Pages → Source 選 **Deploy from a branch** → `main` / `/ (root)` → Save。
7. 約 1 分鐘後網址就是 `https://<你的帳號>.github.io/dog-and-swan/`，傳給她即可。

> 提醒：公開 repo 裡的照片和文字任何人都看得到。

## 之後想加資料庫？
可在 Azure 加 Functions + Table Storage，做「每日一句話」或共用留言板；連線資訊只放後端，不要寫進前端程式碼。
