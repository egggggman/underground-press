import type { Issue, Puzzle, PageSourceInput } from '@workspace/api-client-react';

export const MAX_INTAKE_BYTES = 1024 * 1024;
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function json(text: string): Parsed<unknown> {
  if (new TextEncoder().encode(text).length > MAX_INTAKE_BYTES) return { ok: false, error: 'File is over the 1 MiB limit.' };
  try { return { ok: true, value: JSON.parse(text) }; } catch { return { ok: false, error: 'That is not valid JSON.' }; }
}

export function parseNumberedText(text: string): Parsed<string[]> {
  const out: string[] = [];
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const m = /^\s*(\d+)[.):]\s?(.*)$/.exec(line);
    if (m && Number(m[1]) !== out.length + 1) return { ok: false, error: 'Numbered items must be exactly 1–48, in order, without extra item numbers.' };
    if (m) out.push(m[2]);
    else if (out.length) out[out.length - 1] += '\n' + line;
    else if (line.trim()) return { ok: false, error: 'Numbered text must start at item 1 and run in sequence.' };
  }
  if (out.length !== 48) return { ok: false, error: `Found ${out.length} numbered items; exactly 48 in sequence 1..48 are required. Nothing is padded or mapped.` };
  return { ok: true, value: out };
}

export function parseReported(text: string): Parsed<string[]> {
  if (!/^\s*[[{]/.test(text)) return parseNumberedText(text);
  const j = json(text);
  if (!j.ok) return j;
  let a = j.value;
  if (a && typeof a === 'object' && !Array.isArray(a)) a = (a as { blockers?: unknown }).blockers;
  if (!Array.isArray(a)) return { ok: false, error: 'Input must be a JSON array of exactly 48 strings, or {"blockers":[48 strings]}.' };
  if (a.length !== 48) return { ok: false, error: `Array has ${a.length} items; exactly 48 are required. Nothing is padded or trimmed.` };
  const bad = a.findIndex((x) => typeof x !== 'string');
  if (bad >= 0) return { ok: false, error: `Item ${bad + 1} is not a string. Blank entries must be empty strings.` };
  if (a.some((x: string) => x.length > 10000)) return { ok: false, error: 'An entry is over 10000 characters.' };
  return { ok: true, value: a as string[] };
}

export function parsePageSources(text: string, issue: Issue): Parsed<PageSourceInput[]> {
  const j = json(text);
  if (!j.ok) return j;
  const v = j.value as { pages?: unknown };
  const arr = Array.isArray(v) ? v : v && typeof v === 'object' ? v.pages : null;
  if (!Array.isArray(arr) || arr.length === 0) return { ok: false, error: 'Expected {"pages":[...]} or a bare non-empty array.' };
  if (arr.length > 9) return { ok: false, error: 'At most 9 pages (2-10) per import.' };
  const seen = new Set<number>();
  const out: PageSourceInput[] = [];
  for (let i = 0; i < arr.length; i++) {
    const e = arr[i] as Record<string, unknown>;
    const at = `Entry ${i + 1}`;
    if (!e || typeof e !== 'object') return { ok: false, error: `${at} is not an object.` };
    const n = e.page;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 10) return { ok: false, error: `${at}: page must be an integer.` };
    if (n === 1) return { ok: false, error: `${at}: Page 1 is permanently locked and cannot be imported.` };
    if (seen.has(n)) return { ok: false, error: `${at}: page ${n} appears twice. Duplicates fail the whole import.` };
    seen.add(n);
    const pg = issue.pages.find((p) => p.number === n);
    if (!pg || pg.locked) return { ok: false, error: `${at}: page ${n} is locked.` };
    if (typeof e.copy !== 'string' || !e.copy.trim()) return { ok: false, error: `${at}: copy must be a non-empty string.` };
    if (e.copy.length > 100000) return { ok: false, error: `${at}: copy is over 100000 characters.` };
    if (typeof e.sourceIdentity !== 'string' || !e.sourceIdentity.trim()) return { ok: false, error: `${at}: sourceIdentity is required.` };
    if (e.title !== undefined && (typeof e.title !== 'string' || !e.title.trim())) return { ok: false, error: `${at}: title, if given, must be non-empty.` };
    const item: PageSourceInput = { page: n, copy: e.copy, sourceIdentity: e.sourceIdentity };
    if (typeof e.title === 'string') item.title = e.title;
    out.push(item);
  }
  return { ok: true, value: out };
}

export function parsePuzzles(text: string, issue: Issue): Parsed<Puzzle[]> {
  const j = json(text);
  if (!j.ok) return j;
  const v = j.value as { puzzles?: unknown };
  const arr = Array.isArray(v) ? v : v && typeof v === 'object' ? v.puzzles : null;
  if (!Array.isArray(arr) || arr.length === 0) return { ok: false, error: 'Expected {"puzzles":[...]} or a bare non-empty array.' };
  if (arr.length > 100) return { ok: false, error: 'At most 100 puzzles per import.' };
  const out: Puzzle[] = [];
  for (let i = 0; i < arr.length; i++) {
    const e = arr[i] as Record<string, unknown>;
    const at = `Puzzle ${i + 1}`;
    if (!e || typeof e !== 'object' || Array.isArray(e)) return { ok: false, error: `${at} is not an object.` };
    if (typeof e.title !== 'string' || !e.title.trim()) return { ok: false, error: `${at}: title is required.` };
    for (const k of ['kind', 'source', 'solution', 'artworkId', 'sourceIdentity'] as const) {
      if (e[k] !== undefined && e[k] !== null && typeof e[k] !== 'string') return { ok: false, error: `${at}: ${k} must be a string.` };
    }
    if (e.kind !== undefined && typeof e.kind === 'string' && !e.kind.trim()) return { ok: false, error: `${at}: kind cannot be blank.` };
    if (!Array.isArray(e.pages) || e.pages.length === 0) return { ok: false, error: `${at}: pages must list at least one page from 2-10.` };
    for (const n of e.pages) {
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 2 || n > 10) return { ok: false, error: `${at}: invalid page ${JSON.stringify(n)}.` };
      if (issue.pages.find((p) => p.number === n)?.locked) return { ok: false, error: `${at}: page ${n} is locked; placements there are rejected.` };
    }
    const art = (e.artworkId as string | undefined) ?? '';
    if (art && !issue.assets.some((a) => a.id === art)) return { ok: false, error: `${at}: unknown artworkId "${art}".` };
    const s = (x: unknown) => (typeof x === 'string' ? x : '');
    out.push({
      id: '', title: e.title.trim(), kind: s(e.kind) || 'crossword', source: s(e.source), solution: s(e.solution),
      validation: 'unvalidated', validationNotes: '', reviewer: '', artworkId: art,
      pages: [...new Set(e.pages as number[])].sort((a, b) => a - b), provenance: 'imported_unverified', sourceIdentity: s(e.sourceIdentity),
    });
  }
  return { ok: true, value: out };
}
