import { copyFor, quantityText, precisionText } from '../i18n.mjs';

export function recipeReport(value, language = 'zh-Hant') {
  const copy = copyFor(language);
  return [
    copy.reportTitle,
    `${copy.servings}: ${value.originalServings} → ${value.targetServings}`,
    [copy.name, copy.original, copy.scaled, copy.unit, copy.precision].join('\t'),
    ...value.rows.map(row => [row.name, quantityText(row, 'originalText', language),
      quantityText(row, 'scaledText', language), row.unit, precisionText(row, language)].join('\t')),
    '', copy.rounding
  ].join('\n');
}
