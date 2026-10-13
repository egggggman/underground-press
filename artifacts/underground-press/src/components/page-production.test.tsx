import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PageProduction } from './page-production';

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  useListVersions: vi.fn(() => ({ data: [] })),
}));

vi.mock('@workspace/api-client-react', () => ({
  useListVersions: mocks.useListVersions,
  useGetVersion: vi.fn(),
  getListVersionsQueryKey: vi.fn(() => ['versions']),
  getGetVersionQueryKey: vi.fn(() => ['version']),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  mocks.run.mockReset();
});

it('returns focus to the page print-attestation action after a sign-off is recorded', async () => {
  mocks.run.mockResolvedValue(true);
  const page = {
    number: 2,
    title: 'TEST-ONLY page',
    locked: false,
    artworkSlots: [],
    printApproval: null,
    editorialApproval: null,
    artApproval: null,
  };

  render(
    <PageProduction
      issue={{ revision: 7, assets: [], pageSnapshots: [] } as any}
      readiness={{ pageChecks: [], blockers: [] } as any}
      page={page as any}
      locked={false}
      p1={false}
      run={mocks.run}
      pending={false}
      canWrite
      canMyrtle
      accountName="TEST-ONLY editor"
      dirty={false}
    />,
  );

  const opener = screen.getByTestId('button-check-print');
  opener.focus();
  fireEvent.click(opener);
  expect(screen.getByRole('dialog', { name: 'Print layout attestation, page 2' })).toBeTruthy();

  fireEvent.change(screen.getByTestId('input-reviewer'), {
    target: { value: 'TEST-ONLY editor' },
  });
  fireEvent.change(screen.getByTestId('input-notes'), {
    target: { value: 'TEST-ONLY reviewed the printed layout' },
  });
  fireEvent.click(screen.getByTestId('checkbox-ack'));
  fireEvent.click(screen.getByTestId('button-confirm'));

  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Print layout attestation, page 2' })).toBeNull());
  expect(mocks.run).toHaveBeenCalledWith(
    {
      action: 'check_page_print',
      page: 2,
      reviewer: 'TEST-ONLY editor',
      notes: 'TEST-ONLY reviewed the printed layout',
      checked: true,
    },
    'Print layout attested',
    7,
  );
  expect(document.activeElement).toBe(opener);
});
