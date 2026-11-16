import type { Child } from "hono/jsx";

// The administration pattern (SPEC §9 Administration screens; phase 4.4),
// the shape of the Django admin: a list that is a real table, with the
// page's action above it on the right and each row's actions at its end;
// and a form with the way back at the top and the save at the bottom left.
// Areas, users and flows all use these two, so learning one screen teaches
// the others.

export type Column = { label: string; numeric?: boolean };

export function AdminList(props: {
  title: string;
  action?: { href: string; label: string };
  columns: Column[];
  // Each a <tr> whose cells follow `columns`, then one cell of actions.
  rows: Child[];
  // Said instead of the table when it has no rows: what it is for, and how
  // to add the first one.
  empty: { purpose: string; howToAdd: string };
  error?: string;
}) {
  return (
    <>
      <div class="admin-head">
        <h1 class="page-title">{props.title}</h1>
        {props.action && (
          <a class="button-primary" href={props.action.href}>
            {props.action.label}
          </a>
        )}
      </div>
      <Messages error={props.error} />
      {props.rows.length ? (
        <div class="table-frame">
          <div class="table-scroll" data-table-scroll>
            <table class="admin-table">
              <thead>
                <tr>
                  {props.columns.map((c) => (
                    <th scope="col" class={c.numeric ? "num" : undefined}>
                      {c.label}
                    </th>
                  ))}
                  <th scope="col" class="admin-actions">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>{props.rows}</tbody>
            </table>
          </div>
          <script type="module" src="/js/table-scroll.js"></script>
        </div>
      ) : (
        <div class="card admin-empty">
          <p>{props.empty.purpose}</p>
          <p class="muted">{props.empty.howToAdd}</p>
        </div>
      )}
    </>
  );
}

// The last cell of a row: links and one-button forms, side by side.
export function RowActions({ children }: { children: Child }) {
  return <td class="admin-actions">{children}</td>;
}

export function Messages({ error, notice, warning }: { error?: string; notice?: string; warning?: string | null }) {
  return (
    <>
      {error && (
        <p class="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {warning && (
        <p class="form-warning" role="status">
          {warning}
        </p>
      )}
    </>
  );
}

export function AdminForm(props: {
  back: { href: string; label: string };
  title: Child;
  // A line under the title: what the record is, beyond its name.
  subtitle?: Child;
  error?: string;
  notice?: string;
  warning?: string | null;
  action: string;
  submit: string;
  children: Child;
  // What sits below the form: actions on the record that are not saving it.
  after?: Child;
}) {
  return (
    <>
      <p class="admin-back">
        <a href={props.back.href}>← {props.back.label}</a>
      </p>
      <h1 class="page-title">{props.title}</h1>
      {props.subtitle && <p class="muted admin-subtitle">{props.subtitle}</p>}
      <Messages error={props.error} notice={props.notice} warning={props.warning} />
      <form method="post" action={props.action} class="stacked-form admin-form">
        {props.children}
        <div class="admin-submit">
          <button type="submit" class="button-primary">
            {props.submit}
          </button>
        </div>
      </form>
      {props.after}
    </>
  );
}

// "Sí" or "No" for a yes/no column: a word, never a colour or a mark alone.
export const yesNo = (v: boolean) => (v ? "Sí" : "No");
