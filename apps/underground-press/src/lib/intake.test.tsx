import { describe, expect, it } from 'vitest';
import { parseReported } from './intake';

const items = (n: number, last = 'x') => Array.from({ length: n }, (_, i) => (i === n - 1 ? last : `item ${i + 1}`));

describe('parseReported', () => {
  it('keeps a blank #48 in a JSON array', () => {
    const r = parseReported(JSON.stringify(items(48, '')));
    expect(r.ok && r.value[47]).toBe('');
  });
  it('accepts {blockers:[48]}', () => {
    expect(parseReported(JSON.stringify({ blockers: items(48) })).ok).toBe(true);
  });
  it('rejects length mismatch without padding', () => {
    expect(parseReported(JSON.stringify(items(47))).ok).toBe(false);
    expect(parseReported(JSON.stringify(items(49))).ok).toBe(false);
  });
  it('parses numbered text with blank 48', () => {
    const t = items(47).map((s, i) => `${i + 1}. ${s}`).join('\n') + '\n48.';
    const r = parseReported(t);
    expect(r.ok && r.value.length).toBe(48);
    expect(r.ok && r.value[47]).toBe('');
  });
  it('rejects numbered text with 47 items', () => {
    expect(parseReported(items(47).map((s, i) => `${i + 1}. ${s}`).join('\n')).ok).toBe(false);
  });
  it('rejects extra and out-of-order numbered items instead of silently merging them', () => {
    const text = items(48).map((s, i) => `${i + 1}. ${s}`).join('\n');
    expect(parseReported(text + '\n49. extra').ok).toBe(false);
    expect(parseReported(text.replace('3. item 3', '7. item 3')).ok).toBe(false);
  });
});
