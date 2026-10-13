import { copyFor, quantityText, precisionText } from './i18n.mjs';

export function setToTaste(amountInput, enabled) {
  amountInput.value = '';
  amountInput.disabled = enabled;
}

function textElement(document, tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

export function renderResultRows(document, tbody, value, language) {
  const copy = copyFor(language);
  const rows = value.rows.map(row => {
    const tr = document.createElement('tr');
    const name = textElement(document, 'th', row.name);
    name.scope = 'row';
    tr.append(name);
    const cells = [
      [copy.original, quantityText(row, 'originalText', language), 'quantity'],
      [copy.scaled, quantityText(row, 'scaledText', language), 'quantity scaled-quantity'],
      [copy.unit, row.unit || '—', 'unit'],
      [copy.precision, precisionText(row, language), row.approximate ? 'precision approximate' : 'precision']
    ];
    for (const [label, text, className] of cells) {
      const cell = document.createElement('td');
      const labelElement = textElement(document, 'span', label, 'cell-label');
      labelElement.setAttribute('aria-hidden', 'true');
      cell.append(labelElement, textElement(document, 'span', text, className));
      tr.append(cell);
    }
    return tr;
  });
  tbody.replaceChildren(...rows);
}
