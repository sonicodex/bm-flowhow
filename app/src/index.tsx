import { Hono } from "hono";
import { renderer } from "./layout";

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

export default app;
