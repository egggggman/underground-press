import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PagesBoard from './pages-board';

const mocks = vi.hoisted(() => ({ issue: {} as any, run: vi.fn() }));
vi.mock('@/lib/press', () => ({
  usePress: () => ({
    issue: mocks.issue, run: mocks.run, pending: false, canWrite: true,
    auth: { roles: [], user: { id: 'TEST-ONLY-contributor' } },
    readiness: { pageChecks: [], blockers: [] },
  }),
  fmt: (v: string) => v,
}));
vi.mock('@/components/page-production', () => ({ PageProduction: () => null }));
vi.mock('@/components/source-intake', () => ({ SourceIntake: () => null }));
afterEach(cleanup);
beforeEach(() => {
  window.history.replaceState({}, '', '/pages?page=2');
  mocks.run.mockReset();
  mocks.issue = {
    revision: 2, puzzles: [], assets: [], pageSnapshots: [],
    pages: Array.from({ length: 10 }, (_, n) => ({
      number: n + 1, title: `TEST-ONLY Page ${n + 1}`, section: 'TEST',
      copy: 'TEST-ONLY saved copy', sourceIdentity: 'TEST-ONLY source',
      provenance: 'working_draft', status: 'draft', locked: n === 0,
      editorialApproval: null, artApproval: null, printApproval: null,
    })),
  };
});

it('retains text typed while an earlier explicit save is pending', async () => {
  let complete!: (value: boolean) => void;
  mocks.run.mockImplementation(() => new Promise<boolean>(resolve => { complete = resolve; }));
  const view = render(<PagesBoard />);
  const copy = screen.getByTestId('input-page-copy');
  fireEvent.change(copy, { target: { value: 'TEST-ONLY first pending save' } });
  fireEvent.click(screen.getByRole('button', { name: /Save page/i }));
  expect(mocks.run).toHaveBeenCalledWith(expect.objectContaining({ copy: 'TEST-ONLY first pending save' }), 'Page saved', 2);
  fireEvent.change(copy, { target: { value: 'TEST-ONLY later unsaved edit' } });
  mocks.issue = { ...mocks.issue, revision: 3, pages: mocks.issue.pages.map((p: any) => p.number === 2 ? { ...p, copy: 'TEST-ONLY first pending save' } : p) };
  await act(async () => { complete(true); });
  view.rerender(<PagesBoard />);
  // Another page's save/poll can arrive after this response. It must not erase
  // the edit made while our request was pending, nor silently rebase it.
  mocks.issue = { ...mocks.issue, revision: 4 };
  view.rerender(<PagesBoard />);
  expect((screen.getByTestId('input-page-copy') as HTMLTextAreaElement).value).toBe('TEST-ONLY later unsaved edit');
  fireEvent.click(screen.getByRole('button', { name: /Save page/i }));
  expect(mocks.run).toHaveBeenLastCalledWith(expect.objectContaining({ copy: 'TEST-ONLY later unsaved edit' }), 'Page saved', 3);
});

it('keeps unsaved input after a rejected or stale save without inventing a revision', async () => {
  mocks.run.mockResolvedValue(false);
  render(<PagesBoard />);
  fireEvent.change(screen.getByTestId('input-page-copy'), { target: { value: 'TEST-ONLY retained after failure' } });
  fireEvent.click(screen.getByRole('button', { name: /Save page/i }));
  await act(async () => {});
  expect((screen.getByTestId('input-page-copy') as HTMLTextAreaElement).value).toBe('TEST-ONLY retained after failure');
  fireEvent.click(screen.getByRole('button', { name: /Save page/i }));
  expect(mocks.run).toHaveBeenLastCalledWith(expect.objectContaining({ copy: 'TEST-ONLY retained after failure' }), 'Page saved', 2);
});
