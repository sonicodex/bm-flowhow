# PLAN

Iteraciones del plan de construcción de Stage 1. Cada iteración lleva un
serial `plan_iteration_{n}`. La más reciente va primero. Una iteración
nunca se edita: los cambios generan una iteración nueva.

---

## plan_iteration_1 — 2026-11-12

Estado: **aprobada. Esta es la iteración vigente.**

Hubo una implementación anterior en Django sobre Python Workers, con su propio
plan. Se descartó entera el 12 de noviembre de 2026 y no quedó rastro de ella,
por decisión del dueño. El motivo, que conviene no olvidar: las reglas del
recorrido y de la validación existían dos veces, en `core.js` para el
navegador y en Python para el servidor, y tenían que coincidir para siempre.
En TypeScript son un solo módulo.

El producto nunca cambió. Lo que valía de aquel trabajo era el diseño, y el
diseño vive en `SPEC.md`.

### Lo que sobrevive del repositorio

`SPEC.md`, `PLAN.md`, `DECISIONS.md`, `theme.css`, `assets/` y `reference/`
completo. Se borra `app/` entero.

`reference/core.js` deja de ser material de referencia: es el módulo de reglas
del proyecto. `reference/*.grid.json` son los datos de desarrollo y entran
desde la primera fase.

### Decisiones anteriores que siguen vigentes

Son del diseño, no del lenguaje, y no se vuelven a discutir:

- La forma del grid:
  `{categories, rows:[{id, type, ref, title, description, tags, exits, depends_on}]}`.
- El registro de recorrido guarda **paso + índice de la salida tomada**, con
  la ruta por delante para pasos anidados (`P6>S3#1`).
- El borrador es una fila propia; los puntos guardados solo se agregan.
- Un release menor conserva "Revisado"; uno mayor lo devuelve a pendiente.
- Etiquetas de rol en pantalla: **Empleado**, **Líder**, **Junta directiva**.
  En código: `standard`, `leader`, `board`.
- Los subflujos quedan fuera de la etapa 1: ninguno de los dos flujos reales
  usa uno. El tipo existe en el modelo y en el formato, sin comportamiento.
  Los pasos `Enlace` sí se construyen, y se prueban con Apertura de OT
  apuntando a Instalaciones.
- Queda sin resolver, para la etapa 2: si un paso `Subflujo` se resuelve
  siempre al último release del hijo, el release del padre deja de ser
  inmutable. Es una decisión real y no hay que tomarla hasta que los
  subflujos existan.

### La regla que sobrevive a la implementación anterior

Una sola, y vale la pena entender de dónde salió. Una falla pasó 62 tests
unitarios en verde y reventó en el servidor, porque los tests corrían sobre
SQLite y el servidor sobre D1. **Los tests corren contra la misma base que el
servidor, siempre.** En esta implementación eso es estructural: Vitest con
`@cloudflare/vitest-pool-workers` ejecuta dentro del runtime de Workers
contra un D1 real, así que la divergencia no puede volver a ocurrir.

### Las fases

El orden está en SPEC §11. El detalle de cada fase se propone al empezarla y
se aprueba antes de construir. Aquí solo las dos primeras.

#### Fase 0 — Esqueleto

- Worker en TypeScript con Hono. `wrangler dev` sirve una página con
  `theme.css`, Google Sans, iBrand y el logo en el header.
- D1 con el esquema en `.sql` versionado, aplicado con
  `wrangler d1 migrations`. Las seis tablas más el documento por versión.
- `core.js` entra al proyecto como el módulo de reglas compartido, con sus
  tests. Sin reescribirlo: se mueve, se tipa si hace falta y se conserva cada
  caso de prueba.
- Vitest con `@cloudflare/vitest-pool-workers` corriendo con un comando.
- `CLAUDE.md` reescrito: los comandos nuevos, ninguno de los viejos.
- `.gitignore` reescrito para un proyecto de JS.

Termina cuando `wrangler dev` sirve la página, las migraciones aplican sobre
el D1 local y los tests de `core` pasan dentro del runtime.

#### Fase 1 — Importación

- El contrato del grid: una función de validación y una de aplicación,
  compartidas por la pantalla de importación y por la carga de desarrollo.
- Pegado desde Excel y lectura de `.xlsx`, ambos en el navegador, a la misma
  forma de grid.
- Los dos flujos de `reference/*.grid.json` cargados y publicados en 1.0, de
  forma idempotente.
- Validaciones de estructura de SPEC §6, en el servidor, compartidas con la
  publicación.
- El script que convierte `.xlsx` a `.grid.json` se commitea en `tools/`.
  Los JSON de referencia existen pero su generador nunca se guardó, y los
  archivos van a cambiar cuando el dueño resuelva las hojas "Dudas": 30
  preguntas abiertas entre los dos flujos.

Termina cuando los dos flujos reales están en el D1 local en 1.0 y recargarlos
no crea versiones nuevas.

**Después de la fase 1 viene el deployment check**, antes de seguir.
