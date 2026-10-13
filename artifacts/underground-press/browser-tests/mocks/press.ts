export function usePress() {
  return {
    run: async () => true,
    pending: false,
    auth: { user: { id: 'browser-test-editor' } },
    canWrite: true,
  };
}
