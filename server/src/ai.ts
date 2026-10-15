// Infinite questions from AI. Cloudflare Workers AI is preferred when configured.
// Also accepts GEMINI_API_KEY or AI_API_KEY (+ AI_BASE_URL) for OpenAI-compatible services.
// No key, or any failure -> the built-in question bank is used, so a game never breaks.
import {RULES, type ModeId} from '../../shared/src/config';
import {buildItems, itemsFromRaw, type Item, type RawQ} from '../../shared/src/engine';

export type AiCfg = {provider: 'cloudflare' | 'gemini' | 'openai'; key: string; model: string; base: string};
export function aiConfig(env: Record<string, string | undefined> = process.env): AiCfg | null {
  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) return {
    provider: 'cloudflare', key: env.CLOUDFLARE_API_TOKEN,
    model: env.CLOUDFLARE_AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    base: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run`
  };
  if (env.GEMINI_API_KEY) return {provider: 'gemini', key: env.GEMINI_API_KEY, model: env.AI_MODEL || 'gemini-3.8-flash', base: 'https://generativelanguage.googleapis.com/v1beta'};
  if (env.AI_API_KEY) return {provider: 'openai', key: env.AI_API_KEY, model: env.AI_MODEL || 'llama-3.3-70b-versatile', base: env.AI_BASE_URL || 'https://api.groq.com/openai/v1'};
  return null;
}

const clean = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const TOPICS = 'geography, science, history, film and TV, music, sport, food and drink, nature and animals, technology, art and literature, language, general knowledge';

export function buildPrompt(mode: ModeId, n: number, avoid: string[]): string {
  const no = avoid.length ? `\nDo NOT repeat or closely paraphrase any of these: ${avoid.map(a => `"${a}"`).join('; ')}.` : '';
  if (mode === 'lingo') return `Return JSON {"words":["..."]} with ${n} different common English 5-letter words (nouns, verbs or adjectives, uppercase A-Z only, no proper nouns, plurals or slang).${no}`;
  if (mode === 'wheel') return `Return JSON {"puzzles":[{"hint":"...","phrase":"..."}]} with ${n} Wheel-of-Fortune style puzzles. hint is a short uppercase category (PHRASE, MOVIE, FOOD, PLACE, PROVERB, THING). phrase is 2-4 well-known words, uppercase letters and single spaces only, no punctuation or digits.${no}`;
  const shape = `Return JSON {"questions":[{"cat":"...","q":"...","answer":"...","wrong":["...","...","..."]}]} with ${n} items.`;
  const order = mode === 'mill' ? ' Order these 15 questions from warm-up easy to genuinely difficult. Increase the challenge steadily; never use obscure trick wording.'
    : mode === 'pct' ? ' These are logic and common-sense puzzles, not general-knowledge trivia. Use clear patterns, wordplay, counting, and deduction. Make the first item very approachable and the final item unusually challenging, with one unambiguous answer.'
    : mode === 'jeo' ? ' Vary topics across clues and keep the category informative. Write each prompt as a concise clue rather than a direct question; the response should be a person, place, or thing.'
    : mode === 'chase' ? ' Write quick, unambiguous general-knowledge questions suitable for a fast head-to-head quiz.'
    : ' Mix categories and difficulty, with mostly medium-level questions.';
  return `${shape} Multiple-choice trivia. Facts must be certain and verifiable, with exactly one correct answer, never time-sensitive (nothing "current" or "latest"). Wrong options must be plausible but definitely wrong. q under 140 chars, options under 40 chars. Mix topics: ${TOPICS}.${order}${no}`;
}

function cloudflareSchema(mode: ModeId, n: number) {
  const string = {type: 'string'};
  const list = (items: unknown, count: number) => ({type: 'array', items, minItems: count, maxItems: count});
  if (mode === 'lingo') return {
    type: 'object', properties: {words: list(string, n)}, required: ['words'], additionalProperties: false
  };
  if (mode === 'wheel') return {
    type: 'object', properties: {puzzles: list({
      type: 'object', properties: {hint: string, phrase: string}, required: ['hint', 'phrase'], additionalProperties: false
    }, n)}, required: ['puzzles'], additionalProperties: false
  };
  return {
    type: 'object', properties: {questions: list({
      type: 'object', properties: {cat: string, q: string, answer: string, wrong: list(string, 3)},
      required: ['cat', 'q', 'answer', 'wrong'], additionalProperties: false
    }, n)}, required: ['questions'], additionalProperties: false
  };
}

async function callLLM(cfg: AiCfg, text: string, mode: ModeId, count: number): Promise<any> {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), RULES.ai.timeoutMs);
  try {
    let out = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (cfg.provider === 'cloudflare') {
          const r = await fetch(`${cfg.base}/${cfg.model}`, {method: 'POST', signal: ctrl.signal,
            headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key},
            body: JSON.stringify({
              messages: [
                {role: 'system', content: 'Generate trivia data for a game. Follow the requested schema exactly. Return no commentary or markdown.'},
                {role: 'user', content: text}
              ],
              response_format: {type: 'json_schema', json_schema: cloudflareSchema(mode, count)},
              max_tokens: 4096,
              temperature: 0.4
            })});
          if (!r.ok) throw new Error('AI HTTP ' + r.status);
          const j: any = await r.json();
          if (j.success === false) throw new Error('AI provider rejected the request');
          const response = j.result?.response;
          out = typeof response === 'string' ? response : JSON.stringify(response ?? '');
        } else if (cfg.provider === 'gemini') {
          const r = await fetch(`${cfg.base}/models/${cfg.model}:generateContent`, {method: 'POST', signal: ctrl.signal,
            headers: {'Content-Type': 'application/json', 'x-goog-api-key': cfg.key},
            body: JSON.stringify({contents: [{parts: [{text}]}], generationConfig: {responseMimeType: 'application/json', temperature: 1}})});
          if (!r.ok) throw new Error('AI HTTP ' + r.status);
          const j: any = await r.json();
          out = (j.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text || '').join('');
        } else {
          const r = await fetch(`${cfg.base}/chat/completions`, {method: 'POST', signal: ctrl.signal,
            headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key},
            body: JSON.stringify({model: cfg.model, messages: [{role: 'user', content: text}], response_format: {type: 'json_object'}, temperature: 1})});
          if (!r.ok) throw new Error('AI HTTP ' + r.status);
          const j: any = await r.json();
          out = j.choices?.[0]?.message?.content ?? '';
        }
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const retryable = /AI HTTP (408|425|429|5\d\d)/.test(message) || error instanceof TypeError;
        if (!retryable || attempt === 2 || ctrl.signal.aborted) throw error;
        const delay = 300 * (2 ** attempt) + Math.floor(Math.random() * 250);
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, delay);
          ctrl.signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('AI request timed out')); }, {once: true});
        });
      }
    }
    const unfenced = out.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const start = unfenced.indexOf('{'), end = unfenced.lastIndexOf('}');
    const parsed = JSON.parse(start >= 0 && end > start ? unfenced.slice(start, end + 1) : unfenced);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.response && typeof parsed.response === 'object') return parsed.response;
    return parsed;
  } finally { clearTimeout(t); }
}

function validMcq(x: any): RawQ | null {
  const q = clean(x?.q, 200), answer = clean(x?.answer, 60), wrong: string[] = Array.isArray(x?.wrong) ? x.wrong.map((v: unknown) => clean(v, 60)) : [];
  if (!q || !answer || wrong.length < 3 || new Set([answer, ...wrong.slice(0, 3)].map(v => v.toLowerCase())).size < 4 || wrong.slice(0, 3).some(w => !w)) return null;
  return {cat: clean(x.cat, 24) || 'General', q, answer, wrong: wrong.slice(0, 3)};
}

export class QuestionSource {
  private lastFailure: string | null = null;
  constructor(private cfg: AiCfg | null = aiConfig()) {}
  get enabled() { return !!this.cfg; }
  get note() {
    if (!this.cfg) return 'AI is off: configure Cloudflare Workers AI or another server AI provider.';
    return this.lastFailure;
  }

  /** Always resolves: AI items when possible, otherwise the built-in bank. */
  async items(mode: ModeId, seed: number, avoid: string[] = []): Promise<{items: Item[]; ai: boolean}> {
    const n = RULES.count[mode];
    this.lastFailure = null;
    if (this.cfg) try {
      const j = await callLLM(this.cfg, buildPrompt(mode, n + RULES.ai.extra, avoid), mode, n + RULES.ai.extra);
      const skip = new Set(avoid.map(a => a.toLowerCase()));
      if (mode === 'lingo') {
        const words = [...new Set<string>((Array.isArray(j.words) ? j.words : []).map((w: unknown) => clean(w, 5).toUpperCase()).filter((w: string) => /^[A-Z]{5}$/.test(w) && !skip.has(w.toLowerCase())))];
        if (words.length >= n) return {items: words.slice(0, n).map(word => ({kind: 'lingo' as const, word})), ai: true};
      } else if (mode === 'wheel') {
        const ps = (Array.isArray(j.puzzles) ? j.puzzles : []).map((p: any) => ({hint: clean(p?.hint, 14).toUpperCase() || 'PHRASE', phrase: clean(p?.phrase, 30).toUpperCase()}))
          .filter((p: any) => /^[A-Z]+( [A-Z]+){1,3}$/.test(p.phrase) && !skip.has(p.phrase.toLowerCase()));
        const uniq = [...new Map(ps.map((p: any) => [p.phrase, p])).values()] as {hint: string; phrase: string}[];
        if (uniq.length >= n) return {items: uniq.slice(0, n).map(p => ({kind: 'wheel' as const, ...p})), ai: true};
      } else {
        const seen = new Set<string>(), raw: RawQ[] = [];
        for (const x of Array.isArray(j.questions) ? j.questions : []) {
          const v = validMcq(x), k = v?.q.toLowerCase();
          if (v && k && !seen.has(k) && !skip.has(k)) { seen.add(k); raw.push(v); }
        }
        if (raw.length >= n) return {items: itemsFromRaw(mode, seed, raw.slice(0, n)), ai: true};
      }
      this.lastFailure = `AI returned too few valid ${mode} items; using the built-in bank.`;
      console.warn(this.lastFailure);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      this.lastFailure = `AI generation failed (${detail}); using the built-in bank.`;
      console.warn('AI generation failed; using the built-in bank:', detail);
    }
    return {items: buildItems(mode, seed, avoid), ai: false};
  }
}
