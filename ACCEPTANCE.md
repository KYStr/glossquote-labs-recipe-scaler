# 驗收規格：食譜份量換算

狀態：SPEC_ONLY；所有案例 NOT_RUN。A 案例需以 node:test 和固定 expected 檢驗，不得用實作結果當測試 expected。

## A：核心與狀態案例

1. 4→6，米 300 g → 450 g，精確且 approximate=false。
2. 4→6，水 1.2 L → 1.8 L，單位原樣保留。
3. 適量鹽 4→6 仍為適量，toTasteCount=1。
4. 1→3，0.001 → 0.003。
5. 3→1，0.001 的真值低於 0.001，顯示小於 0.001 且 approximate=true。
6. 1→1 任意合法數量保持原量且 exact。
7. 2→1，1.005 的 milliUnits=1005，輸出 0.503（half-up）。
8. 2→1，1.001 輸出 0.501（half-up）。
9. 1→2，0 合法，輸出 0，不因零的除法產生錯誤。
10. 1→2，輸入 1000000 → 2000000，數學可顯示且不因輸出大於輸入上限而截斷。
11. 1000000.001 → QUANTITY_TOO_LARGE。
12. 數字 1000000.000 → 接受；1000000.001 → 拒絕。
13. .5、1.、+1、-1、1,000、1e3、阿拉伯/全形數字 → INVALID_QUANTITY。
14. 0、000.500、1.200 → 接受；格式化規則符合文檔。
15. 1.234 → 接受；1.2345 → INVALID_QUANTITY。
16. amount 空字串且 toTaste=false → ROW_INCOMPLETE。
17. toTaste=true 且 amount 非空 → TO_TASTE_AMOUNT_NOT_EMPTY；不可忽略殘留值。UI 切換時必須清空 amount。
18. name trim 後空 → ROW_INCOMPLETE；空白列不能被跳過。
19. name raw length=256可繼續檢查 trim 後長度；257 → NAME_RAW_TOO_LONG。trim 後 80 接受、81 → NAME_TOO_LONG。
20. unit raw length=128可繼續檢查 trim 後長度；129 → UNIT_RAW_TOO_LONG。trim 後24接受、25 → UNIT_TOO_LONG。
21. amount raw length 16且 toTaste=true 仍因非空→TO_TASTE_AMOUNT_NOT_EMPTY；17→AMOUNT_TOO_LONG；amount 型別非string→INVALID_REQUEST。
22. 名稱或單位含 C0/C1 controls → CONTROL_CHARACTER，無結果。
23. servings 1 和 1000 → 接受；0、1001、空、負數、2.0 → INVALID_SERVINGS。
24. servings 原始 4 ASCII 數字上限與前導零：0001 接受且值為1；5位拒絕。
25. 一列接受；零列 TOO_FEW_ROWS；51列 TOO_MANY_ROWS。
26. 第2列不完整 → ROW_INCOMPLETE,row=2，不產生第1列的部分結果。
27. request/row exact schema 缺鍵、多鍵、錯型別、符號鍵、non-enumerable 鍵、accessor 欄位、非 plain object → INVALID_REQUEST。
28. sparse rows array、非 Array.prototype 陣列、帶額外自訂屬性或 symbol 的 rows array → INVALID_REQUEST，不得略過 hole。
29. 50列每列結果順序與輸入相同，summary rowCount=50。
30. 報告 copy 文字保留名稱、數量、單位順序，換行為 LF，不含 HTML。
31. 輸入更改後立刻清空上一結果與報告，copy disabled。
32. servings 或 toTaste 變更同樣使結果失效。
33. copy promise 過期/逆序 resolve/reject 不得更新新 revision 的提示。
34. clipboard missing/reject → readonly fallback 可選，不自動下載。
35. 清除和 pagehide 清除所有輸入與結果；reload 不恢復草稿。
36. 惡意 HTML 字串當食材名稱 → 純文字渲染，不執行。
37. half-up 用 BigInt 整數公式在大數邊界重複執行保持 byte-identical。
38. 2→1，0.001 的精確縮放值為0.0005，half-up tie 顯示0.001 且 approximate=true；以獨立整數 expected 驗證，不轉 Number。

## B：必要人工瀏覽器流程

- zh-Hant/en 各做一次示例 4→6，確認 300g→450g、1.2L→1.8L、適量保持；截圖與實際輸入記錄不可含私有食譜。
- 兩語各編輯其中一列，確認結果消失、copy disabled，再計算新值。
- 兩語各測不完整空列、非法數量、超份數；錯誤清楚定位且 focus 第一錯誤欄。
- 320px、200%縮放、鍵盤完整新增/刪除/計算/複製，檢查標籤、焦點、局部捲動。
- 使用中文 IME/貼上，確認欄位保留合適字符；clipboard 正常與拒絕/缺失路徑分別觀察。
- Network/Storage 手動檢查無外部資料請求、無儲存、無 beacon；無法取證則 NOT_RUN。
- reload/pagehide 後沒有草稿/結果；讀屏通知不要逐列重複朗讀。

## M1 門檻

所有 A、npm test、npm run check、npm run build 通過；雙語主要 B 流程、窄螢幕和 keyboard 必要路徑通過。人工能力未暴露的項目如實 NOT_RUN。交主代理固定版本獨立檢查後才決定 M1。
