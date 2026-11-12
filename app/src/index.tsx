import { Hono } from "hono";
import { areas } from "./areas.tsx";
import { renderer } from "./layout.tsx";

const app = new Hono<{ Bindings: Env }>();

app.use(renderer);

app.get("/", (c) =>
  c.render(
    <>
      <h1 class="page-title">FlowHow</h1>
      <p>Procesos de la empresa, paso a paso.</p>
    </>,
    { title: "Inicio" },
  ),
);

app.route("/areas", areas);

export default app;
