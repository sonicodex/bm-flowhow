// The JSDoc types of core.js reach TypeScript code. Checked by
// `npm run typecheck` (tsc -p test); each @ts-expect-error must stay an
// error, or the typecheck fails.
import { describe, expect, it } from "vitest";
import C from "../public/js/core.js";
import type { Flow, Grid } from "../public/js/core.js";

describe("core.js types", () => {
  it("types the functions the server uses", () => {
    const grid: Grid = { categories: [], rows: [] };
    const draft = C.gridToDraft(grid, (name: string) => (name ? 1 : null));
    const blocking: boolean[] = draft.errors.map((e) => e.blocking);
    const flow: Flow = C.compile({ name: "x", categories: draft.categories, steps: draft.steps });
    const messages: string[] = C.validate(flow).map((e) => e.message);
    expect([blocking, messages]).toEqual([[], ["El flujo no tiene pasos."]]);

    // @ts-expect-error a grid needs rows
    C.gridToDraft({ categories: [] });
    // @ts-expect-error validate takes a compiled flow, not a draft
    C.validate({ name: "x", steps: [] });
    // @ts-expect-error refs needs a lib
    C.validate(flow, { selfId: 1 });
    // @ts-expect-error a link target is not a step
    C.compile(draft).steps[0]?.ref.label;
  });
});
