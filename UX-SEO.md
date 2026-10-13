# 介面、雙語文案與 SEO：食譜份量換算

狀態：SPEC_ONLY；SEO/HTTP 尚未建置或實測。

## 產品介面

Product App / Operate。主要工作表就是份數和食材列，結果貼近輸入；品牌標頭安靜，不使用抽象廚房插圖或假營養圖表。

桌面：名稱/說明/語言；原份數與目標份數；食材列（名稱、原數量、單位、適量切換、移除）；新增列/清除/載入示例/計算；結果清單原量→新量、舍入提示和複製。手機改單欄卡片式列，每列欄位不橫向擠壓；主按鈕和結果可見。320px 不發生頁面橫向捲動，必要時只讓食材表局部捲動。

標籤直接可見；錯誤綁定欄位，焦點移到首錯。數量提示「最多 3 位小數；不換算單位」。適量選項旁說明不縮放。結果用文字區分準確/近似和小於最小顯示量，不只依賴顏色。

## 中文搜尋文案

Title：食譜份量換算：按人數調整食材用量 | GlossQuote
Description：輸入食譜原份數與目標份數，在瀏覽器本機按比例換算各項食材。保留單位文字，支援適量項目，不做單位或烹調時間推測。
H1：食譜份量換算
Intro：把食譜調整到需要的人數，逐項計算新的食材用量。

## English search copy

Title: Recipe Scaler: Adjust Ingredient Quantities by Servings | GlossQuote
Description: Scale recipe ingredient amounts locally by changing the original and target servings. Keep unit labels and leave “to taste” ingredients unchanged; no unit or cooking-time conversion.
H1: Recipe scaler
Intro: Change the serving count and recalculate each ingredient amount for your recipe.

## FAQ 內容

兩種語言都至少顯示五題：可以換算單位嗎？不行，單位原樣保留；「適量」怎處理？原樣保留、不縮放；小數如何舍入？以精確比例計算並最多顯示三位小數、half-up；烹調時間或溫度會一起換算嗎？不會；資料會保存嗎？目前頁面記憶體中計算，離開即清除。

## SEO 發布界線

本機 preview 為 noindex,nofollow，robots 禁止索引。production 只在 M2 使用固定 https://recipe.glossquote.com/index.html 和 /en/index.html；self canonical、zh-Hant/en reciprocal hreflang、x-default 指繁中；語言、title、description、Open Graph URL 一致。準確的 WebApplication JSON-LD 可描述實際工具，不承諾評價、rich result、排名或營養結果。真實 robots/sitemap/404/headers 依 docs/RELEASE.md，未經 HTTP 測試不宣稱已符合。
