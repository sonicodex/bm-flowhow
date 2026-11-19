// The two Vite features the tests use (test/pwa.test.ts), declared here:
// vite is vitest's dependency, not this project's, so its own client types
// are not relied on.
declare module "*?raw" {
  const text: string;
  export default text;
}

interface ImportMeta {
  glob(pattern: string): Record<string, () => Promise<unknown>>;
}
