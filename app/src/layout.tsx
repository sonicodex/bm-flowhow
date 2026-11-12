import { jsxRenderer } from "hono/jsx-renderer";

declare module "hono" {
  interface ContextRenderer {
    (content: string | Promise<string>, props: { title: string }): Response | Promise<Response>;
  }
}

// Base page. theme.css brings Google Sans (Google Fonts) and iBrand (fonts/).
export const renderer = jsxRenderer(({ children, title }) => (
  <html lang="es-CO">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{`${title} · FlowHow`}</title>
      <link rel="stylesheet" href="/theme.css" />
      <link rel="stylesheet" href="/app.css" />
    </head>
    <body>
      <header class="site-header">
        <a href="/" class="site-logo">
          <img src="/flowhow_logotype.svg" alt="FlowHow" />
        </a>
      </header>
      <main class="site-main">{children}</main>
    </body>
  </html>
));
