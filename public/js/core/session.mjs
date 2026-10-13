import { scaleRecipe } from './recipe.mjs';
import { recipeReport } from './report.mjs';

function immutableValue(value) {
  return Object.freeze({ ...value,
    rows: Object.freeze(value.rows.map(row => Object.freeze({ ...row }))),
    summary: Object.freeze({ ...value.summary })
  });
}

// The page owns inputs; this session owns only the current immutable output.
export class RecipeSession {
  #revision = 0;
  #copyRequestId = 0;
  #value = null;
  #report = '';
  #copyState = 'idle';
  #language;
  #onChange;

  constructor({ language = 'zh-Hant', onChange = () => {} } = {}) {
    this.#language = language;
    this.#onChange = onChange;
  }

  snapshot() {
    return Object.freeze({ revision: this.#revision, copyRequestId: this.#copyRequestId,
      value: this.#value, report: this.#report, copyState: this.#copyState,
      copyDisabled: this.#value === null || this.#copyState === 'copying' });
  }

  #emit() { this.#onChange(this.snapshot()); }

  invalidate() {
    this.#revision += 1;
    this.#copyRequestId += 1;
    this.#value = null;
    this.#report = '';
    this.#copyState = 'idle';
    this.#emit();
  }

  calculate(request) {
    this.invalidate();
    const result = scaleRecipe(request);
    if (!result.ok) return result;
    this.#value = immutableValue(result.value);
    this.#report = recipeReport(this.#value, this.#language);
    this.#emit();
    return { ok: true, value: this.#value };
  }

  async copy(writeText) {
    if (this.#value === null) return 'unavailable';
    const revision = this.#revision;
    const requestId = ++this.#copyRequestId;
    const report = this.#report;
    this.#copyState = 'copying';
    this.#emit();
    let nextState;
    try {
      if (typeof writeText !== 'function') throw new Error('CLIPBOARD_UNAVAILABLE');
      // Called synchronously within the click activation, before the await.
      await writeText(report);
      nextState = 'copied';
    } catch {
      nextState = 'fallback';
    }
    if (revision !== this.#revision || requestId !== this.#copyRequestId) return 'stale';
    this.#copyState = nextState;
    this.#emit();
    return nextState;
  }
}
