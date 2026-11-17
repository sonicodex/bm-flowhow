import Core, { type Exit, type Flow, type Grid } from "../public/js/core.js";

// The flow document stored in drafts, save points and releases. Tags are
// stored by id, so renaming a tag does not break past releases; `ref` is the
// target flow's id. Name, objective, colour and areas live on the flow row.
export type DocStep = {
  id: string;
  type: string;
  title: string;
  description: string;
  ref: number | null;
  tags: number[];
  exits: Exit[];
};

export type FlowDocument = { steps: DocStep[] };

export const EMPTY_DOCUMENT: FlowDocument = { steps: [] };

export type TagIndex = {
  categories: { id: number; name: string; key: string }[];
  tags: { id: number; categoryId: number; name: string; key: string }[];
};

export async function loadTagIndex(db: D1Database): Promise<TagIndex> {
  const [cats, tags] = await db.batch<Record<string, unknown>>([
    db.prepare("SELECT id, name, name_key FROM tag_categories ORDER BY position, id"),
    db.prepare("SELECT id, category_id, name, name_key FROM tags ORDER BY id"),
  ]);
  return {
    categories: cats.results.map((c) => ({ id: c.id as number, name: c.name as string, key: c.name_key as string })),
    tags: tags.results.map((t) => ({
      id: t.id as number,
      categoryId: t.category_id as number,
      name: t.name as string,
      key: t.name_key as string,
    })),
  };
}

// The compiled flow of a stored document, for validate() and the viewer.
export function documentToFlow(name: string, objective: string, doc: FlowDocument, index: TagIndex): Flow {
  const tagById = new Map(index.tags.map((t) => [t.id, t]));
  const categories = index.categories.map((c) => c.name);
  return {
    name,
    objective,
    categories,
    steps: doc.steps.map((s) => {
      const tags: Record<string, string[]> = Object.fromEntries(categories.map((c) => [c, [] as string[]]));
      for (const id of s.tags) {
        const tag = tagById.get(id);
        const cat = tag && index.categories.find((c) => c.id === tag.categoryId);
        if (tag && cat) tags[cat.name]!.push(tag.name);
      }
      return { id: s.id, type: s.type, title: s.title, description: s.description, tags, exits: s.exits, ref: s.ref };
    }),
  };
}

// The grid of a stored document (phase 5.2): what the editor shows and what
// saving it sends back, the same shape an import produces. Every category is
// a column, in its order; a cell holds the step's values of that category,
// comma-separated. `flowName` turns a link's target id into the name the
// grid carries. "Depende de" stays empty: exits are the one source.
export function documentToGrid(doc: FlowDocument, index: TagIndex, flowName: (id: number) => string | null): Grid {
  const categories = index.categories.map((c) => c.name);
  const tagById = new Map(index.tags.map((t) => [t.id, t]));
  return {
    categories,
    rows: doc.steps.map((s) => {
      const tags: Record<string, string> = {};
      for (const cat of index.categories) {
        tags[cat.name] = s.tags
          .map((id) => tagById.get(id))
          .filter((t) => t?.categoryId === cat.id)
          .map((t) => t!.name)
          .join(", ");
      }
      return {
        id: s.id,
        type: s.type,
        ref: s.ref === null ? "" : (flowName(s.ref) ?? ""),
        title: s.title,
        description: s.description,
        tags,
        exits: Core.formatExits(s.exits),
        depends_on: "",
      };
    }),
  };
}
