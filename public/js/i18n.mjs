const zh = {
  ingredient: index => `食材 ${index}`,
  remove: index => `移除食材 ${index}`,
  name: '食材名稱', amount: '原數量', unit: '單位', toTaste: '適量', noScale: '保持適量，不縮放',
  exact: '準確', approximate: '近似', unchanged: '不縮放', original: '原量', scaled: '換算後', precision: '精度',
  reportTitle: '食譜份量換算', servings: '份數',
  rounding: '最多 3 位小數；採 half-up 四捨五入。近似值已標示；單位不換算。',
  example: '已載入示例：4 份改為 6 份。按「計算份量」查看結果。',
  changed: '輸入已變更，請重新計算份量。', cleared: '已清除。輸入食材或載入示例。',
  added: '已新增食材列。', removed: '已移除食材列，請重新計算。',
  ready: value => `已換算 ${value.originalServings} 份至 ${value.targetServings} 份，共 ${value.summary.rowCount} 項食材。`,
  copying: '正在複製完整清單…', copied: '✓ 已複製完整清單。',
  fallback: '無法存取剪貼簿。請選取下方完整文字，再自行複製。',
  errorAt: (error, message) => `${error.row === null ? '' : `食材 ${error.row}：`}${message}`,
  errors: {
    INVALID_REQUEST: '輸入格式不完整，請清除後重新輸入。',
    INVALID_SERVINGS: '份數請填 1–1000 的正整數，最多 4 位半形數字。',
    TOO_FEW_ROWS: '請新增至少一項食材。', TOO_MANY_ROWS: '最多 50 項食材，請移除多出的列。',
    ROW_INCOMPLETE: '請填食材名稱及原數量；適量項目請勾選「適量」。',
    NAME_RAW_TOO_LONG: '名稱輸入過長，請縮短到 80 字元以內。', NAME_TOO_LONG: '食材名稱最多 80 字元。',
    UNIT_RAW_TOO_LONG: '單位輸入過長，請縮短到 24 字元以內。', UNIT_TOO_LONG: '單位最多 24 字元。',
    AMOUNT_TOO_LONG: '原數量最多 16 字元，並且最多 3 位小數。',
    TO_TASTE_AMOUNT_NOT_EMPTY: '適量項目不能同時填數量，請重新切換「適量」。',
    CONTROL_CHARACTER: '名稱或單位不能含控制字元，請移除換行或特殊控制字元。',
    INVALID_QUANTITY: '請填半形十進位數字，最多 3 位小數；不接受分數、符號或空白。',
    QUANTITY_TOO_LARGE: '原數量請填 0–1000000。'
  }
};
const en = {
  ingredient: index => `Ingredient ${index}`,
  remove: index => `Remove ingredient ${index}`,
  name: 'Ingredient name', amount: 'Original amount', unit: 'Unit', toTaste: 'To taste', noScale: 'Leave unchanged; do not scale',
  exact: 'Exact', approximate: 'Approximate', unchanged: 'Unchanged', original: 'Original', scaled: 'Scaled', precision: 'Precision',
  reportTitle: 'Recipe scaler', servings: 'Servings',
  rounding: 'Up to 3 decimal places; half-up rounding. Approximate values are marked; units are not converted.',
  example: 'Example loaded: 4 servings to 6. Choose “Calculate quantities” to see the result.',
  changed: 'Inputs changed. Calculate quantities again.', cleared: 'Cleared. Enter ingredients or load the example.',
  added: 'Ingredient row added.', removed: 'Ingredient row removed. Calculate again.',
  ready: value => `Scaled ${value.originalServings} servings to ${value.targetServings}, with ${value.summary.rowCount} ingredients.`,
  copying: 'Copying the complete list…', copied: '✓ Complete list copied.',
  fallback: 'Clipboard access is unavailable. Select the complete text below and copy it yourself.',
  errorAt: (error, message) => `${error.row === null ? '' : `Ingredient ${error.row}: `}${message}`,
  errors: {
    INVALID_REQUEST: 'The input structure is incomplete. Clear it and enter the ingredients again.',
    INVALID_SERVINGS: 'Enter a whole number from 1 to 1000, using at most 4 ASCII digits.',
    TOO_FEW_ROWS: 'Add at least one ingredient.', TOO_MANY_ROWS: 'Use at most 50 ingredients. Remove the extra rows.',
    ROW_INCOMPLETE: 'Enter an ingredient name and original amount, or choose “To taste” for the amount.',
    NAME_RAW_TOO_LONG: 'The name input is too long. Shorten it to 80 characters or fewer.', NAME_TOO_LONG: 'Ingredient names can use at most 80 characters.',
    UNIT_RAW_TOO_LONG: 'The unit input is too long. Shorten it to 24 characters or fewer.', UNIT_TOO_LONG: 'Units can use at most 24 characters.',
    AMOUNT_TOO_LONG: 'Use at most 16 characters and 3 decimal places for the original amount.',
    TO_TASTE_AMOUNT_NOT_EMPTY: 'A to-taste ingredient cannot also have an amount. Toggle “To taste” again.',
    CONTROL_CHARACTER: 'Remove line breaks or control characters from the name or unit.',
    INVALID_QUANTITY: 'Use ASCII decimal digits with up to 3 decimal places, without fractions, signs, or spaces.',
    QUANTITY_TOO_LARGE: 'Enter an original amount from 0 to 1000000.'
  }
};

export function copyFor(language) { return language === 'en' ? en : zh; }
export function quantityText(row, key, language) {
  if (row.toTaste) return copyFor(language).toTaste;
  return language === 'en' && row[key] === '小於 0.001' ? '< 0.001' : row[key];
}
export function precisionText(row, language) {
  const copy = copyFor(language);
  return row.toTaste ? copy.unchanged : row.approximate ? copy.approximate : copy.exact;
}
