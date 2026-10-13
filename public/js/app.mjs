import { RecipeSession } from './core/session.mjs';
import { RecipeEditor } from './core/editor.mjs';
import { copyFor } from './i18n.mjs';
import { renderResultRows, setToTaste } from './view.mjs';

const language = document.documentElement.lang === 'en' ? 'en' : 'zh-Hant';
const copy = copyFor(language);
const byId = id => document.getElementById(id);
const form = byId('recipe-form');
const ingredients = byId('ingredients');
const originalInput = byId('servings-original');
const targetInput = byId('servings-target');
const status = byId('status');
const errorSummary = byId('error-summary');
const copyButton = byId('copy');
const fallback = byId('copy-fallback');
const fallbackText = byId('report-text');
let renderedValue = null;

function renderOutput(snapshot) {
  copyButton.disabled = snapshot.copyDisabled;
  copyButton.setAttribute('aria-busy', String(snapshot.copyState === 'copying'));
  byId('result-content').hidden = snapshot.value === null;
  byId('empty-result').hidden = snapshot.value !== null;
  fallback.hidden = snapshot.copyState !== 'fallback';
  fallbackText.value = snapshot.copyState === 'fallback' ? snapshot.report : '';
  if (snapshot.value !== renderedValue) {
    renderedValue = snapshot.value;
    if (snapshot.value) renderResultRows(document, byId('result-rows'), snapshot.value, language);
    else byId('result-rows').replaceChildren();
  }
  if (snapshot.value) {
    status.textContent = snapshot.copyState === 'idle' ? copy.ready(snapshot.value) : copy[snapshot.copyState];
    byId('result-servings').textContent = `${snapshot.value.originalServings} → ${snapshot.value.targetServings}`;
  } else {
    byId('result-servings').textContent = '';
  }
}

const session = new RecipeSession({ language, onChange: renderOutput });
const editor = new RecipeEditor(session);

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function field(row, fieldName, labelText, options = {}) {
  const wrapper = element('div', undefined, `field ${fieldName}-field`);
  const id = `ingredient-${row.key}-${fieldName}`;
  const label = element('label', labelText);
  label.htmlFor = id;
  // One-row textarea retains pasted line breaks for validation instead of
  // silently joining an invalid numeric draft into a different valid number.
  const input = element('textarea');
  input.id = id;
  input.rows = 1;
  input.value = row[fieldName];
  input.dataset.field = fieldName;
  input.autocomplete = 'off';
  input.spellcheck = false;
  if (options.inputMode) input.inputMode = options.inputMode;
  if (fieldName === 'amount') input.disabled = row.toTaste;
  const error = element('span', '', 'field-error');
  error.id = `${id}-error`;
  input.setAttribute('aria-describedby', `${fieldName === 'amount' ? 'quantity-help ' : ''}${error.id}`);
  wrapper.append(label, input, error);
  return wrapper;
}

function renderInputs() {
  const request = editor.request();
  originalInput.value = request.originalServings;
  targetInput.value = request.targetServings;
  const rows = editor.viewRows();
  ingredients.replaceChildren(...rows.map((row, index) => {
    const fieldset = element('fieldset', undefined, 'ingredient-row');
    fieldset.dataset.key = String(row.key);
    fieldset.append(element('legend', copy.ingredient(index + 1)));
    const grid = element('div', undefined, 'ingredient-grid');
    grid.append(field(row, 'name', copy.name), field(row, 'amount', copy.amount, { inputMode: 'decimal' }),
      field(row, 'unit', copy.unit));
    const taste = element('div', undefined, 'taste-field');
    const label = element('label', undefined, 'checkbox-label');
    const checkbox = element('input');
    checkbox.type = 'checkbox';
    checkbox.id = `ingredient-${row.key}-toTaste`;
    checkbox.checked = row.toTaste;
    checkbox.dataset.field = 'toTaste';
    checkbox.setAttribute('aria-describedby', `${checkbox.id}-help`);
    label.append(checkbox, element('span', copy.toTaste));
    const help = element('span', copy.noScale, 'field-help');
    help.id = `${checkbox.id}-help`;
    taste.append(label, help);
    const remove = element('button', language === 'en' ? 'Remove' : '移除', 'button quiet remove-row');
    remove.type = 'button';
    remove.dataset.remove = String(row.key);
    remove.disabled = rows.length === 1;
    remove.setAttribute('aria-label', copy.remove(index + 1));
    grid.append(taste, remove);
    fieldset.append(grid);
    return fieldset;
  }));
  byId('row-count').textContent = `${rows.length} / 50`;
  byId('add-row').disabled = rows.length >= 50;
}

function clearErrors() {
  errorSummary.hidden = true;
  errorSummary.textContent = '';
  for (const node of form.querySelectorAll('[aria-invalid]')) node.removeAttribute('aria-invalid');
  for (const node of form.querySelectorAll('.field-error')) node.textContent = '';
}

function showError(error) {
  const message = copy.errors[error.code];
  errorSummary.textContent = `! ${copy.errorAt(error, message)}`;
  errorSummary.hidden = false;
  const row = error.row === null ? null : editor.viewRows()[error.row - 1];
  const input = row ? byId(`ingredient-${row.key}-${error.field}`) : byId(error.field);
  if (input) {
    input.setAttribute('aria-invalid', 'true');
    const fieldError = byId(`${input.id}-error`);
    if (fieldError) fieldError.textContent = message;
    (input.disabled && row ? byId(`ingredient-${row.key}-toTaste`) : input).focus();
  } else {
    byId('add-row').focus();
  }
}

function inputEdited(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) return;
  const hadResult = session.snapshot().value !== null;
  if (input === originalInput) editor.setServing('originalServings', input.value);
  else if (input === targetInput) editor.setServing('targetServings', input.value);
  else {
    const row = input.closest('.ingredient-row');
    if (!row) return;
    const key = Number(row.dataset.key);
    if (input.dataset.field === 'toTaste') {
      editor.setToTaste(key, input.checked);
      setToTaste(byId(`ingredient-${key}-amount`), input.checked);
    } else editor.setField(key, input.dataset.field, input.value);
  }
  clearErrors();
  if (hadResult) status.textContent = copy.changed;
}

form.addEventListener('input', inputEdited);
form.addEventListener('change', inputEdited);
form.addEventListener('submit', event => {
  event.preventDefault();
  clearErrors();
  status.textContent = '';
  const result = editor.calculate();
  if (!result.ok) showError(result.error);
});

byId('add-row').addEventListener('click', () => {
  const key = editor.add();
  if (key === null) return;
  clearErrors();
  renderInputs();
  status.textContent = copy.added;
  byId(`ingredient-${key}-name`).focus();
});

ingredients.addEventListener('click', event => {
  const button = event.target.closest('[data-remove]');
  if (!button) return;
  const key = Number(button.dataset.remove);
  const index = editor.viewRows().findIndex(row => row.key === key);
  if (!editor.remove(key)) return;
  clearErrors();
  renderInputs();
  status.textContent = copy.removed;
  const next = editor.viewRows()[Math.min(index, editor.viewRows().length - 1)];
  byId(`ingredient-${next.key}-name`).focus();
});

function resetPage({ focus = false, announce = false, pagehide = false } = {}) {
  if (pagehide) editor.pagehide();
  else editor.clear();
  clearErrors();
  renderInputs();
  status.textContent = announce ? copy.cleared : '';
  if (focus) originalInput.focus();
}

byId('clear').addEventListener('click', () => resetPage({ focus: true, announce: true }));
byId('example').addEventListener('click', () => {
  editor.loadExample(language);
  clearErrors();
  renderInputs();
  status.textContent = copy.example;
});

copyButton.addEventListener('click', () => {
  void session.copy(text => {
    const clipboard = navigator.clipboard;
    if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('CLIPBOARD_UNAVAILABLE');
    return clipboard.writeText(text);
  });
});
byId('select-report').addEventListener('click', () => { fallbackText.focus(); fallbackText.select(); });
window.addEventListener('pagehide', () => resetPage({ pagehide: true }));
window.addEventListener('pageshow', event => { if (event.persisted) resetPage(); });

// Explicitly clear any browser-restored form values on every fresh document.
resetPage();
