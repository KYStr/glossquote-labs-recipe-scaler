# 技術規格：食譜份量換算

狀態：SPEC_ONLY。這是實作與測試的數值 oracle。

## 輸入與範圍

servings 欄位為最多 4 ASCII digits 的字串，正規表示式為 ^[0-9]{1,4}$，允許前導零但解析值須 1..1000。原份數和目標份數各自驗證。表格需有 1..50 列，不可因空白列跳過後續列。

每列 exact schema 為 {name, amount, unit, toTaste}。name、amount、unit、toTaste 欄位全都存在；name/amount/unit 為字串，toTaste 為 boolean；拒絕額外欄位。先以原始 UTF-16 code units 檢查 name 最多 256、unit 最多 128，超過直接回 NAME_RAW_TOO_LONG/UNIT_RAW_TOO_LONG，避免對任意長空白執行 trim。再分別 trim；名稱必填且最多 80 UTF-16 code units，單位可為空且最多 24。trim 後名稱/單位拒絕 C0/C1 control characters。單位保留大小寫、符號及語言，不換算。

amount 不論 toTaste 值都必須是字串，原始長度最多 16 UTF-16 code units。若 toTaste=true，amount 必須恰為空字串；殘留任何字符回 TO_TASTE_AMOUNT_NOT_EMPTY，絕不可忽略隱藏的任意長值。若 toTaste=false，空值回 ROW_INCOMPLETE；非空值必須為 1..16 ASCII 字元，符合 ^[0-9]+(?:\.[0-9]{1,3})?$。允許前導零與尾端小數零；負號、正號、逗號、空白、科學記號、Unicode 數字與只有小數點均拒絕。解析值須 0..1000000，0 合法。原文字使用輸入 trim 後的形式呈現。toTaste=true 時輸出原量和新量為固定文字「適量」。UI 切換適量時同步清空量欄，且不得保留或提交隱藏草稿。

## 核心 API 與結果

scaleRecipe(request) 接受 plain object（prototype 恰為 Object.prototype 或 null）且 Reflect.ownKeys(request) 恰為 originalServings,targetServings,rows。每個 request 欄位必須是 own enumerable data property，不接受 getter/setter。rows 必須是 prototype 恰為 Array.prototype 的 dense Array；Reflect.ownKeys 除 length 外只有從 0 到 length-1 的連續 index，且每個 index 是 own enumerable data property；hole、subclass/custom prototype、symbol key、非列舉額外 key 或自訂額外屬性都回 INVALID_REQUEST。每個 row 必須是 plain object（prototype Object.prototype 或 null），Reflect.ownKeys 恰為 name,amount,unit,toTaste；每欄必須是 own enumerable data property，拒絕 symbol/non-enumerable/未知鍵與 accessors。回傳 {ok:true,value:{originalServings,targetServings,rows,summary}} 或 {ok:false,error:{code,row,field}}，ok 為 boolean。成功的份數、rowCount、scaledCount、toTasteCount 為整數 Number；rows 是 dense Array，順序與輸入完全一致，每列精確為 {name,originalText,scaledText,unit,toTaste,approximate}，四個文字欄位為 string，toTaste/approximate 為 boolean。失敗時 error.code 為固定錯誤碼字串，row 為 1-based 正整數 Number/null，field 為固定欄位字串/null。錯誤不 echo 使用者輸入。

固定錯誤碼：INVALID_REQUEST、INVALID_SERVINGS、TOO_FEW_ROWS、TOO_MANY_ROWS、ROW_INCOMPLETE、NAME_RAW_TOO_LONG、NAME_TOO_LONG、UNIT_RAW_TOO_LONG、UNIT_TOO_LONG、AMOUNT_TOO_LONG、TO_TASTE_AMOUNT_NOT_EMPTY、CONTROL_CHARACTER、INVALID_QUANTITY、QUANTITY_TOO_LARGE。field 為 servings-original、servings-target、name、amount、unit、rows 或 null；row 為 1-based 列號或 null。驗證順序為 request schema（含 dense rows / row schema）、原份數、目標份數、列數、逐列欄位從上到下；每列先 raw name/unit/amount 長度，再 trim 後的 name/unit required/control/length，再驗 toTaste/amount 空值規則及數量 grammar/range。回傳首個錯誤，沒有部分結果。

## 精確縮放與顯示

將 ASCII 小數逐字元解析成 BigInt milliUnits（最大小數三位），整數形式乘 1000；帶小數時以 BigInt 右補到三位。servings 驗證後也轉 BigInt。令 m 為非負 BigInt milliUnits，O 為 BigInt original servings，T 為 BigInt target servings。精確分子 n=m*T，分母 O。整個乘法、除法、half-up 比較與格式前的結果都維持 BigInt；不得轉 Number 參與縮放或舍入。輸出 milliUnits r=floor((2*n+O)/(2*O))，即非負整數的 half-up 到最接近千分位。

格式化 r：整數顯示整數；否則顯示三位小數並移除尾端零。若 n>0 且 r=0，顯示固定文字「小於 0.001」/ “< 0.001”，approximate=true。其他情況，approximate 在 n 除以 O 有餘數時為 true，否則 false。UI 標示這些小數是近似值，最多精確到三位小數；不宣稱更多精度。

固定 oracle：4→6，300 g=450 g；1.2 L=1.8 L；適量保持適量。1→3，0.001=0.003。3→1，0.001 的真值低於 0.001，顯示小於 0.001。2→3，0.0015 不符合輸入格式，拒絕，而非用四捨五入接受。2→1，0.001 的精確結果是 0.0005，half-up 正好 tie，顯示 0.001 並標 approximate。3→1，0.001 不到此 tie，顯示小於 0.001。

## UI state / copy

只有按「計算份量」且整體 request 合法後才呈現完整結果。任一 input/change、行增刪、toTaste 切換或份數改變都遞增 revision、清除結果、清除舊文字報告並停用 copy。驗證錯誤後焦點移到第一個錯誤欄位。Copy 只在使用者按鈕事件觸發；promise callback 必須同時檢查 revision 與最新 copy request id。缺少/拒絕 clipboard 時顯示 readonly 可選文字，不下載。清除/pagehide/reload 不保存草稿、不保存輸出。
