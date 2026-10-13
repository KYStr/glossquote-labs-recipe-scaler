// A raw in-memory draft. Limits are validated on the complete draft, not by
// maxlength truncation. No draft is persisted or retained behind To taste.
export class RecipeEditor {
  #session;
  #originalServings = '1';
  #targetServings = '1';
  #rows = [];
  #nextKey = 0;

  constructor(session) { this.#session = session; this.clear(); }

  #newRow(values = {}) {
    return { key: ++this.#nextKey, name: '', amount: '', unit: '', toTaste: false, ...values };
  }

  viewRows() { return this.#rows.map(row => ({ ...row })); }

  request() {
    return {
      originalServings: this.#originalServings,
      targetServings: this.#targetServings,
      rows: this.#rows.map(({ name, amount, unit, toTaste }) => ({ name, amount, unit, toTaste }))
    };
  }

  setServing(field, value) {
    if (typeof value !== 'string') return;
    if (field === 'originalServings') this.#originalServings = value;
    else if (field === 'targetServings') this.#targetServings = value;
    else return;
    this.#session.invalidate();
  }

  setField(key, field, value) {
    const row = this.#rows.find(item => item.key === key);
    if (!row || !['name', 'amount', 'unit'].includes(field) || typeof value !== 'string') return;
    if (field === 'amount' && row.toTaste) return;
    row[field] = value;
    this.#session.invalidate();
  }

  setToTaste(key, enabled) {
    const row = this.#rows.find(item => item.key === key);
    if (!row || typeof enabled !== 'boolean') return;
    row.toTaste = enabled;
    row.amount = '';
    this.#session.invalidate();
  }

  add() {
    if (this.#rows.length >= 50) return null;
    const row = this.#newRow();
    this.#rows.push(row);
    this.#session.invalidate();
    return row.key;
  }

  remove(key) {
    if (this.#rows.length === 1 || !this.#rows.some(row => row.key === key)) return false;
    this.#rows = this.#rows.filter(row => row.key !== key);
    this.#session.invalidate();
    return true;
  }

  clear() {
    this.#originalServings = '1';
    this.#targetServings = '1';
    this.#rows = [this.#newRow()];
    this.#session.invalidate();
  }

  pagehide() { this.clear(); }

  loadExample(language) {
    const names = language === 'en' ? ['Rice', 'Water', 'Salt'] : ['米', '水', '鹽'];
    this.#originalServings = '4';
    this.#targetServings = '6';
    this.#rows = [
      this.#newRow({ name: names[0], amount: '300', unit: 'g' }),
      this.#newRow({ name: names[1], amount: '1.2', unit: 'L' }),
      this.#newRow({ name: names[2], toTaste: true })
    ];
    this.#session.invalidate();
  }

  calculate() { return this.#session.calculate(this.request()); }
}
