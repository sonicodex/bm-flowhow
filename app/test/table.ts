// Reads an administration table (SPEC §9) the way a person scans it: the
// heading row's column names, and each body row's cells as text.
const text = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const cells = (row: string) => [...row.matchAll(/<t[hd][^>]*>(.*?)<\/t[hd]>/gs)].map((m) => text(m[1]!));

export function tableHead(html: string): string[] {
  const head = html.match(/<thead>(.*?)<\/thead>/s);
  return head ? cells(head[1]!) : [];
}

export function tableRows(html: string): string[][] {
  const body = html.match(/<tbody>(.*?)<\/tbody>/s);
  return body ? [...body[1]!.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)].map((m) => cells(m[1]!)) : [];
}
