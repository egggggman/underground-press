import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { PressCommand } from '@workspace/api-client-react';
import { SourceIntake } from './source-intake';
import { parseReported } from '@/lib/intake';

afterEach(cleanup);
const entries = Array.from({ length: 48 }, (_, i) => i === 47 ? '' : `Original item ${i + 1} — unit fixture`);
const build = (reportedEntries: string[], sourceIdentity: string, notes: string): Omit<PressCommand, 'revision'> =>
  ({ action: 'record_reported_preflight', reportedEntries, sourceIdentity, notes, checked: true });
const props = {
  id: 'receipt-test', title: 'Original report', help: 'Unit fixture only',
  parse: parseReported, preview: (v: string[]) => <p>{v.length} original descriptions</p>,
  build, okMsg: 'Receipt saved', confirmLabel: 'Confirm receipt', identityLabel: 'Source',
  pending: false, canWrite: true, warning: 'This is a source receipt, not an approval.',
};
function prepare(view: ReturnType<typeof render>) {
  fireEvent.click(view.getByTestId('button-open-receipt-test'));
  fireEvent.change(view.getByTestId('input-json-receipt-test'), { target: { value: JSON.stringify(entries) } });
  fireEvent.click(view.getByTestId('button-preview-receipt-test'));
  fireEvent.change(view.getByTestId('input-identity-receipt-test'), { target: { value: 'Original document/version' } });
  fireEvent.change(view.getByTestId('input-notes-receipt-test'), { target: { value: 'Read the original report. No clearance claimed.' } });
}
it('never writes from a preview and requires explicit acknowledgement before confirmation', () => {
  const run = vi.fn(async () => true);
  const view = render(<SourceIntake {...props} revision={7} run={run} />);
  prepare(view);
  const button = view.getByTestId('button-confirm-receipt-test') as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(run).not.toHaveBeenCalled();
  fireEvent.click(view.getByTestId('checkbox-ack-receipt-test'));
  expect(button.disabled).toBe(false);
  fireEvent.click(button);
  expect(run).toHaveBeenCalledWith(build(entries, 'Original document/version', 'Read the original report. No clearance claimed.'), 'Receipt saved', 7);
});
it('a later issue revision blocks the acknowledged preview rather than automatically rebasing it', () => {
  const run = vi.fn(async () => true);
  const view = render(<SourceIntake {...props} revision={7} run={run} />);
  prepare(view);
  fireEvent.click(view.getByTestId('checkbox-ack-receipt-test'));
  view.rerender(<SourceIntake {...props} revision={8} run={run} />);
  expect((view.getByTestId('button-confirm-receipt-test') as HTMLButtonElement).disabled).toBe(true);
  expect(view.getByTestId('notice-stale-receipt-test')).toBeTruthy();
  fireEvent.click(view.getByTestId('button-confirm-receipt-test'));
  expect(run).not.toHaveBeenCalled();
});
