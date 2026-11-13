# 三版本國中數學目錄與學期規則

查核日期：2026-11-13。

六冊架構與小節名稱以南一出版的《112 南一國中數學教材簡介本》之六冊架構及各冊速瞄為基準（PDF 第 3、4、6、8、10、12、14 頁）。國二上另與本機提供的 115 上南一《超群新幹線數學自修（3）》目次核對章節編號與主題。

- [南一教材簡介本 PDF](https://storage.googleapis.com/onebook-dev.appspot.com/data/3d90a3de6eded0d8/%E5%9C%8B%E4%B8%AD/03%E6%95%B8%E5%AD%B8/%E7%B0%A1%E4%BB%8B%E6%9C%AC/%E5%8D%97%E4%B8%80%E5%9C%8B%E4%B8%AD%E6%95%B8%E5%AD%B8%E6%95%99%E6%9D%90%E7%B0%A1%E4%BB%8B%E6%9C%AC%28%E5%A3%93%E7%B8%AE%29.pdf)
- [南一官方數位資源入口](https://nanidigi.nani.com.tw/)

依管理者後續指定，改以公開網路目錄持續核對，不再從本機教材 PDF 搜尋。可公開查看的南一線上教材簡介：[南一教材線上翻閱](https://fliphtml5.com/uygal/wdfq/)。[均一類南一版七年級](https://www.junyiacademy.org/topics/n-m7a) 的部分章序與其頁面內引用課本頁碼不一致，因此不將其重排章序覆蓋出版社原章序。

康軒六冊小節名稱直接由[康軒公開數學影音目錄資料](https://digitalmaster.knsh.com.tw/all/video/public/j_math.xml)的「課本解題」類別匯入；[康軒官方數學入口](https://digitalmaster.knsh.com.tw/j/math/)。

翰林六冊名稱直接由官方解題影音網各冊頁面匯入：[國一上](https://mathvideo.hle.com.tw/1A/)、[國一下](https://mathvideo.hle.com.tw/1B/)、[國二上](https://mathvideo.hle.com.tw/2A/)、[國二下](https://mathvideo.hle.com.tw/2B/)、[國三上](https://mathvideo.hle.com.tw/3A/)、[國三下](https://mathvideo.hle.com.tw/3B/)。官方以 CH2／CH5／CH6 表示的整章項目保留原編碼，不虛構小節編號。

這是已核對的三版本各六冊目錄資料，不會自動抓取出版社未來改版。康軒與翰林可用 `python scripts/import-publisher-catalogs.py` 重新匯入公開目錄，再檢查、部署。南一資料位於 `apps-script/Curriculum.gs`。選單只含章節名稱，不複製教材、影片或解答。

## 自動切換

管理者指定以每年 7 月 1 日提前升級，因此這是本網站規則，並非宣稱學校法定開學日。

- 時區固定 Asia/Taipei。
- 7/1～翌年 1/31：當年上學期。
- 2/1～6/30：前一年起算學年度的下學期。
- 學生以 `baseAcademicYear` 與 `baseGrade` 為基準，每逢 7/1 升一年級。
- 黃雲晞基準為西元 2026 學年度國二，因此 2027/2/1 進入國二下，2027/7/1 進入國三上。
- 國三結束後維持國三下並標記國中複習，不憑空升入未提供目錄的高中課程。
- 每次開頁、回到頁面及跨日檢查會向伺服器取最新名單；上傳前伺服器再次核對年級、學期與小節。已開始的分塊上傳使用原收件資料完成。
