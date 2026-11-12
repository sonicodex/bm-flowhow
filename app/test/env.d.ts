declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
    XLSX_FIXTURES: Record<string, string>;
    CSS_FILES: Record<string, string>;
    ICON_FILES: Record<string, string>;
  }
}
