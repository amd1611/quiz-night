// Infinite questions from a free AI. Set GEMINI_API_KEY (free at aistudio.google.com/apikey)
// or AI_API_KEY (+ AI_BASE_URL, AI_MODEL) for any OpenAI-compatible service such as Groq.
// No key, or any failure -> the built-in question bank is used, so a game never breaks.
import {RULES, type ModeId} from '../../shared/src/config';
import {buildItems, itemsFromRaw, type Item, type RawQ} from '../../shared/src/engine';

export type AiCfg = {provider: 'gemini' | 'openai'; key: string; model: string; base: string};
export function aiConfig(env: Record<string, string | undefined> = process.env): AiCfg | null {
  if (env.GEMINI_API_KEY) return {provider: 'gemini', key: env.GEMINI_API_KEY, model: env.AI_MODEL || 'gemini-flash-latest', base: 'https://generativelanguage.googleapis.com/v1beta'};
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
  const order = mode === 'mill' ? ' Order from easiest to hardest, rising steadily (item 1 trivial, last item very hard).'
    : mode === 'pct' ? ' Order by difficulty from very easy (about 90% of adults know it) down to extremely hard (about 1% know it).'
    : mode === 'jeo' ? ' Vary the topics widely; phrase each as a Jeopardy-style clue.' : ' Mixed difficulty, mostly medium.';
  return `${shape} Multiple-choice trivia. Facts must be certain and verifiable, with exactly one correct answer, never time-sensitive (nothing "current" or "latest"). Wrong options must be plausible but definitely wrong. q under 140 chars, options under 40 chars. Mix topics: ${TOPICS}.${order}${no}`;
}

async function callLLM(cfg: AiCfg, text: string): Promise<any> {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), RULES.ai.timeoutMs);
  try {
    let out: string;
    if (cfg.provider === 'gemini') {
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
    return JSON.parse(out.replace(/^```(?:json)?|```$/gm, '').trim());
  } finally { clearTimeout(t); }
}

function validMcq(x: any): RawQ | null {
  const q = clean(x?.q, 200), answer = clean(x?.answer, 60), wrong: string[] = Array.isArray(x?.wrong) ? x.wrong.map((v: unknown) => clean(v, 60)) : [];
  if (!q || !answer || wrong.length < 3 || new Set([answer, ...wrong.slice(0, 3)].map(v => v.toLowerCase())).size < 4 || wrong.slice(0, 3).some(w => !w)) return null;
  return {cat: clean(x.cat, 24) || 'General', q, answer, wrong: wrong.slice(0, 3)};
}

export class QuestionSource {
  constructor(private cfg: AiCfg | null = aiConfig()) {}
  get enabled() { return !!this.cfg; }

  /** Always resolves: AI items when possible, otherwise the built-in bank. */
  async items(mode: ModeId, seed: number, avoid: string[] = []): Promise<{items: Item[]; ai: boolean}> {
    const n = RULES.count[mode];
    if (this.cfg) try {
      const j = await callLLM(this.cfg, buildPrompt(mode, n + RULES.ai.extra, avoid));
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
      console.warn(`AI returned too few valid ${mode} items; using the built-in bank`);
    } catch (e) { console.warn('AI generation failed; using the built-in bank:', String(e)); }
    return {items: buildItems(mode, seed), ai: false};
  }
}
