# PLAN

Iteraciones del plan de construcción de Stage 1. Cada iteración lleva un
serial `plan_iteration_{n}`. La más reciente va primero. Una iteración
nunca se edita: los cambios generan una iteración nueva.

---

## plan_iteration_14 — 2026-11-20

Estado: **propuesta.** `plan_iteration_13` sigue vigente hasta que el dueño
apruebe esta.

Etapa 2 (SPEC §7 «Subflows», «Question bank», «Assessment and
certificate»; §8 «Recertification»; commit `00c21c7`). La llamo **fase 10**
porque la etiqueta `phase-9` ya marca el mock (decisión pendiente, abajo).
Ocho cortes; cada uno termina andando, probado y revisado en Chrome.

- **10.1 Subflujos en el visor.** Caja con doble borde y «+»; «Entrar al
  subflujo» obligatorio; el diagrama del subflujo reemplaza al del padre,
  con migas «Padre › Subflujo»; «Volver a «Padre»» sigue desde la caja;
  «Abrir subflujo» en la revisión libre. Sus pasos (y los anidados) cuentan
  para el 100 % del padre; el avance es del padre. Acceso heredado del
  padre. No salen como filas propias en el inicio ni en el reporte.
- **10.2 Subflujos en el editor.** Tipo «Subflujo» con selector de un flujo
  publicado sin área; validaciones al publicar (existe, publicado, no se
  contiene a sí mismo). El padre muestra siempre la última versión del
  subflujo. Datos de prueba inventados solo en las pruebas: ningún flujo
  real usa subflujos.
- **10.3 El generador de preguntas** (sin modelo). Del flujo publicado,
  subflujos expandidos: qué sigue, qué antecede, quién responde, con qué
  herramienta, qué rama lleva a dónde, qué paso lleva tal etiqueta.
  Respuesta correcta por construcción; distractores reales del mismo
  flujo. Cada pregunta guarda los pasos en que se apoya y una huella de
  ellos (para 10.7). Pruebas sobre los dos flujos de referencia.
- **10.4 El banco y la redacción por lotes.** Tablas del banco; botón
  «Generar banco» en el flujo; el navegador pide lote tras lote y muestra
  el avance; cada lote va al modelo, que solo reescribe enunciados y marca
  opciones absurdas (salida estructurada; si toca la respuesta correcta o
  deja menos opciones del mínimo, se descarta su cambio y queda el texto
  del grafo). Sin `ANTHROPIC_API_KEY`: mensaje claro, el resto sigue. En
  las pruebas el modelo es falso: nunca se llama a la API.
- **10.5 Revisión y publicación del banco.** Lista de preguntas sin
  publicar, editar, borrar, publicar el banco. El trozo de diagrama: el
  paso resaltado y la caja de la respuesta vacía. Un flujo sin banco
  publicado dice que aún no tiene evaluación.
- **10.6 La evaluación.** Abre con el flujo Revisado y el banco publicado.
  Mínimo 5, máximo un cuarto de los pasos; sorteo nuevo en cada intento;
  intentos sin límite, todos guardados, cuenta el último. Nota de
  aprobación 90 %, ajustable, un valor para toda la app. Estados del
  inicio: `pendiente de evaluación`, `certificado`. Reporte: nota del
  último intento con su hora, y certificado sí/no.
- **10.7 Certificado y versiones.** Página del certificado (persona, flujo,
  versión, fecha, nota) con hoja de impresión; «Descargar PDF» abre el
  diálogo de imprimir. Acceso a los certificados vigentes desde el inicio.
  Una versión mayor (del flujo o de un subflujo que contiene) los invalida:
  «recertificación requerida». Toda versión nueva regenera solo las
  preguntas cuyos pasos cambiaron, y esas vuelven a sin publicar.
- **10.8 Recorrido de recertificación.** Solo los pasos cambiados, cada
  uno con el resumen del anterior; resumen inicial de los pasos quitados;
  sin tiempo mínimo. Su evaluación sortea solo de las preguntas que se
  apoyan en pasos cambiados.

Decisiones que necesito del dueño: ver la respuesta en el chat del
2026-11-20; se anotan en la iteración que las apruebe.

---

## plan_iteration_13 — 2026-11-20

Estado: **aprobada. Esta es la iteración vigente.**

Es `plan_iteration_12` tal cual, con los cortes 9.1 a 9.4 aprobados para
construirse seguidos. Respuestas del dueño (SPEC actualizado en el mismo
cambio):

1. **El mock** es `reference/ui-mockup_v1.pdf`: artboard 1 el login, 2 la
   cabecera de la Junta, 3 el panorama, 4 el recorrido.
2. **El Líder conserva la banda** con «Reportes». La banda nunca es un menú
   que solo contiene la pantalla donde ya estás.
3. **El objetivo del flujo** va en el panel del panorama, entre las dos
   líneas y el número de pasos, y en ninguna otra parte.
4. **`--shadow-panel` y `--step-button-disabled-opacity`** están en
   `theme.css`.

## plan_iteration_12 — 2026-11-20

Estado: **propuesta.** `plan_iteration_11` sigue vigente hasta que el dueño
apruebe esta.

Fase 9: el visor y la cabecera como el mock (SPEC §7 y §9 reescritos,
commit `4ec5e11`; artboards 2, 3 y 4 del PDF). Cuatro cortes; cada uno
termina andando, probado y revisado en Chrome a 1366, 1280, 390 y 320 px
contra el artboard que le toca.

- **9.1 Cabecera.**
  - Barra blanca de `--header-height` (56): logotipo a la izquierda; a la
    derecha el nombre y `icons/exit.svg` en `currentColor` como botón de
    salir, con «Salir» como nombre accesible y como `title`. La palabra
    no se ve.
  - Banda oscura de `--nav-height` (30) solo para quien tiene secciones.
    Un Empleado ve la barra blanca sola. Se va el «Flujos» que llevaba a
    Inicio para quien no edita (revierte lo aprobado en 8.1, con la
    entrada de DECISIONS tachada y anotada).
  - Service worker `shell-6` con `exit.svg`, `step_prev.svg` y
    `step_next.svg`.
- **9.2 El marco del visor.**
  - Una línea de título: punto, nombre y estado a la izquierda; «Flujo» y
    su selector en el extremo derecho. En celular el selector baja a su
    propia línea.
  - Una tarjeta exterior a `--viewer-gutter` (32) de la ventana, con la
    fila de avance (`--viewer-progress-height`, 48) y la de convenciones
    (`--viewer-legend-height`, 44), cada una cerrada por un filete de
    ancho completo, y el diagrama debajo.
  - El panel del paso es una tarjeta dentro de ella, a la derecha, de un
    tercio del ancho, con borde y sombra suave. En el panorama se ajusta a
    su contenido.
  - La tarjeta mide lo que queda de pantalla; el diagrama y el panel
    scrollean por dentro, y la página no. Reemplaza la disposición de
    `38ca7ef`, que separaba las dos tarjetas.
  - El repaso libre usa el mismo marco.
  - En celular el panel va arriba del diagrama, dentro de la misma
    tarjeta.
- **9.3 El contenido del panel.**
  - Recorrido: el tipo en versalitas grises, el título en la tipografía
    display y la descripción. Después, una línea por categoría: el nombre
    en gris a la izquierda y los valores a la derecha, como chips con la
    convención de la categoría (la del nodo en el diagrama). Al final,
    «Próximo paso:» en negrita y el paso siguiente en un chip ancho con el
    tinte de paso visitado. Si hay varias salidas, un chip por salida. En
    una decisión van las ramas, como hoy.
  - Panorama: «PANORAMA», el título «El flujo completo», «Míralo de arriba
    abajo para ubicarte.», «Después lo recorrerás un paso a la vez.», el
    número de pasos, y abajo a la derecha «Iniciar recorrido» (o
    «Continuar», «Repetir»), con «Empezar de nuevo» y «Repaso libre» en la
    misma esquina.
- **9.4 Los botones redondos.**
  - «Anterior» y «Siguiente» como `step_prev.svg` y `step_next.svg` tal
    cual, de `--step-button-size` (44), con `--shadow-step-button`, uno al
    lado del otro abajo a la derecha. Nombre accesible «Anterior» y
    «Siguiente». «Anterior» se atenúa cuando no hay adónde volver.
  - «Entrar al subflujo», «Volver a «…»» y «Terminar recorrido» conservan
    sus palabras en esa misma esquina, y el aviso de «muy rápido» queda
    junto a ellos.

## plan_iteration_11 — 2026-11-20

Estado: **aprobada. Esta es la iteración vigente.**

Es `plan_iteration_10` tal cual, con los cortes 8.1 a 8.5 aprobados para
construirse seguidos, sin pausa entre cortes. Respuestas del dueño:

1. **«Flujos» para quien no edita:** lleva a Inicio.
2. **El resumen del reporte** respeta área y flujo, no el filtro
   «Revisado», y la pantalla lo dice, para que nadie piense que lo ignora
   por error.
3. **El flujo importado** queda como borrador.

La medición de `POST /users/import` en el Worker desplegado queda para
después (DEPLOY §5).

## plan_iteration_10 — 2026-11-20

Estado: **propuesta.** `plan_iteration_9` sigue vigente hasta que el dueño
apruebe esta.

Fase 8, rediseño a partir del mock del dueño (SPEC §7 y §9 reescritos,
commit `8c084a8`). Cinco cortes; cada uno termina andando, probado y
revisado en Chrome a 1280, 390 y 320 px.

- **8.1 Cabecera, navegación y aterrizaje.**
  - Barra blanca (`--color-header-surface`, `--header-height`): logotipo a
    la izquierda, nombre del usuario y «Salir» a la derecha.
  - Banda oscura (`--color-nav-surface`, `--nav-height`) con la navegación
    alineada a la derecha: Flujos, Áreas, Usuarios, Reportes. El enlace de
    la sección actual va en `--color-nav-current`. Cada enlace solo para
    quien puede usarlo, como hoy.
  - En celular la banda no se parte en dos líneas: si no caben los
    enlaces, se desplaza de lado dentro de la banda, sin barra horizontal
    en la página.
  - Categorías sale de la navegación y queda como enlace en la pantalla de
    flujos.
  - Configuración inicial sale de la navegación y también de la oferta en
    Inicio. Sigue en `/setup`, y nada la enlaza.
  - La Junta aterriza en `/report`: después de entrar, en `/` con sesión y
    al pulsar el logotipo.
- **8.2 Login.**
  - La imagen llena la pantalla, con una tarjeta blanca centrada encima:
    - el logotipo, «Iniciar sesión», los dos campos y «Acceder»;
    - una línea que dice que la contraseña la restablece el administrador;
    - al pie, pequeño, el logotipo del fabricante.
  - La imagen va como fondo CSS con `image-set` (webp, y jpg detrás). La
    tarjeta tiene su propio fondo y se lee antes de que llegue la imagen.
  - Los tres archivos se quedan en `public/brand/` y se agregan:
    - a la lista de archivos del dueño que no se editan en CLAUDE.md;
    - a la lista del service worker (`shell-5`).
- **8.3 Importar un flujo desde «Flujos».**
  - Botón «Importar flujo», como los de áreas y usuarios.
  - El formulario pide el nombre del flujo y el contenido (pegar desde
    Excel o subir un .xlsx), con el mismo lector.
  - La revisión usa las mismas reglas que la importación del editor.
  - Al aceptar se crea el flujo con eso como borrador, sin publicar, y se
    abre en el editor.
  - El editor conserva su propia importación, que reemplaza el borrador.
- **8.4 Resumen del reporte.**
  - Arriba de las filas, en la misma pantalla: por cada flujo, cuántos de
    los que lo tienen asignado lo han revisado, en porcentaje y en cuenta.
  - Sale de las mismas filas ya recortadas por alcance (la Junta todo, el
    líder sus áreas) y por los filtros, así que no puede contradecirlas.
- **8.5 Panel del recorrido y convenciones.**
  - «Anterior» y la acción principal pasan del rincón del diagrama al pie
    del panel del paso, igual que el aviso de «muy rápido». Se quita el
    relleno inferior que el diagrama dejaba para los botones.
  - En el panorama, el panel es una tarjeta: el nombre del flujo, qué está
    viendo el lector, cuántos pasos tiene, y «Iniciar recorrido».
  - En la revisión libre, «Abrir subflujo» va al mismo pie.
  - En celular, el panel mínimo de arriba lleva los botones.
  - Las convenciones suman «Paso actual» y «Paso visitado», con los mismos
    estilos de nodo del diagrama.

Al terminar, la etiqueta `phase-8` se pone en el último commit.

## plan_iteration_9 — 2026-11-20

Estado: **aprobada. Esta es la iteración vigente.**

Es `plan_iteration_8` tal cual, con los cortes 7.1, 7.2 y 7.3 aprobados
para construirse seguidos, sin pausa entre cortes. Respuestas del dueño:

1. **Asistente:** enlace «Configuración inicial» en la navegación de
   administración.
2. **Lista de contraseñas:**
   - en pantalla y con «Descargar .xlsx»;
   - el archivo dice arriba que son contraseñas temporales, que hay que
     cambiarlas en el primer ingreso y que el archivo se borra cuando se
     hayan repartido.
3. **Área desconocida en el archivo de usuarios:** error de fila. Las
   áreas se crean con su importador.
4. **El importador de usuarios solo crea.** Un usuario existente es error
   de fila.
5. **Estado del asistente:** se deduce de los datos, sin tabla nueva.

Al terminar, la etiqueta `phase-7` se pone en el último commit.

## plan_iteration_8 — 2026-11-20

Estado: **propuesta.** `plan_iteration_7` sigue vigente hasta que el dueño
apruebe esta.

Fase 7, montar una empresa (SPEC §4 «Importing areas, users and flows» y
«First-use wizard», §11). Tres cortes; cada uno termina andando y probado.

- **7.1 Importador de áreas.**
  - Desde «Áreas», con su mismo permiso (`can_edit`): «Importar áreas».
  - Entrada como la de flujos: pegar desde Excel o subir un .xlsx, leídos
    en el navegador con el mismo `xlsx.js`. Hay una plantilla .xlsx con una
    hoja «Áreas» y una columna «Área».
  - La revisión tiene la estructura y el estilo de la de flujos:
    - primero los errores por fila (fila vacía, nombre repetido dentro del
      archivo);
    - después lo que entra, en dos grupos: las áreas nuevas y las que ya
      existen y solo se emparejan (sin distinguir mayúsculas ni tildes,
      como hoy).
    - Nada se escribe hasta «Aceptar».
  - La revisión queda como componente compartido para 7.2.
- **7.2 Importador de usuarios.**
  - Desde «Usuarios», con `can_manage_users`.
  - Columnas: Usuario, Nombre completo, Rol (Estándar, Líder, Junta
    directiva) y Áreas, separadas por coma en una celda.
  - Errores por fila:
    - usuario vacío, repetido en el archivo o ya existente;
    - nombre vacío;
    - rol desconocido;
    - un área que no existe;
    - un Estándar sin área (SPEC §4).
  - Los permisos salen del rol, como en el formulario de hoy.
  - Al aceptar:
    - se crean las cuentas, cada una con su contraseña temporal;
    - el cambio obligado en el primer ingreso ya existe desde 4.4;
    - la lista de contraseñas se muestra una sola vez y no se guarda. Para
      volver a ver una, se restablece esa contraseña.
    - El aviso de «Estándar sin flujos en sus áreas» sale por cuenta, como
      hoy.
- **7.3 Asistente de primer uso.**
  - **Pantalla:** «Configuración inicial» muestra los tres pasos con lo que
    ya hay: N áreas, N usuarios, N flujos.
    - Cada paso abre su importador y tiene «Saltar».
    - Al terminar un importador abierto desde aquí, se vuelve al
      asistente.
  - **A quién y cuándo:** a quien tiene `can_edit` y `can_manage_users`,
    desde Inicio, mientras no haya ningún flujo.
  - **Paso de flujos:** no existe un importador sin flujo, así que el paso
    crea el flujo por su nombre y abre su editor con «Importar». Puede
    repetirse para varios flujos.
  - **Retomable sin guardar nada:** el asistente abre en el primer paso
    que no tiene datos.
  - Las categorías de etiquetas no tienen paso propio: salen del
    importador de flujos.

Preguntas abiertas:

1. **Dónde vive el asistente cuando ya hay flujos.** En SPEC, «capa de
   administración» es la de la etapa 3 (notas, marcas de falla, métricas),
   que no está construida. Propuesta: un enlace «Configuración inicial» en
   la navegación de administración, para quien tenga los dos permisos.
2. **La lista de contraseñas.** Propuesta: en pantalla, y con un botón
   «Descargar .xlsx» que arma el archivo en el navegador desde esa misma
   página. El servidor no la guarda ni la vuelve a dar. ¿O solo pantalla?
3. **Áreas desconocidas en el archivo de usuarios.** Propuesta: error de
   fila, para importar primero las áreas. No se crean desde aquí.
4. **El importador de usuarios solo crea.** Un usuario que ya existe es un
   error de fila; no se actualizan cuentas desde un archivo.
5. **Estado del asistente.** Propuesta: se deduce de los datos, sin tabla
   nueva. Saltar no se recuerda: al volver, abre en el primer paso vacío.

## plan_iteration_7 — 2026-11-19

Estado: **aprobada. Esta es la iteración vigente.**

Es `plan_iteration_6` tal cual, con 6.20 aprobado como se propuso y las
respuestas del dueño:

1. **Ramas gemelas:** un solo objetivo, que toma la primera rama pendiente
   y se nombra «Rama «Sí» o «No»». La decisión es paralela, así que da
   igual cuál se tome.
2. **Orden:** 6.21 primero; luego 6.20.

Al terminar, la etiqueta `phase-6` se mueve al último commit.

## plan_iteration_6 — 2026-11-19

Estado: **propuesta.** `plan_iteration_5` sigue vigente hasta que el dueño
apruebe esta.

Es `plan_iteration_5` con los cortes que pidió el dueño después de probar
la fase 6. 6.17 a 6.19 ya están construidos; 6.20 se propone aquí y espera
aprobación; 6.21 viene después.

- **6.17** (hecho): el aviso de vuelta es un tooltip sobre la decisión, que
  nombra las ramas que faltan; un solo tooltip para la app.
- **6.18** (hecho): una rama que vuelve a su propia decisión es un
  reintento; una rama retenida no se marca y dice qué recorrer primero.
- **6.19** (hecho): el tooltip sale en toda decisión no paralela con
  alguna rama recorrida y otras pendientes, venga de donde venga.
- **6.20** (propuesto): la rama se elige en el diagrama (SPEC §7).
  - Cuando el paso actual es una decisión, también una dejada atrás con
    «Anterior», cada paso al que lleva una rama se vuelve objetivo:
    - un botón dentro del SVG, con `role="button"` y `tabindex="0"`;
    - su nombre accesible es «Rama «Sí»: Confirmar el pago en el grupo de
      WhatsApp», con «, ya recorrida» si lo está.
    - En reposo, el objetivo lleva el contorno de «se puede tocar» del
      repaso libre, para que se note que es para elegir.
  - Al pasar el mouse o llegar con Tab se encienden la flecha de esa rama
    y su etiqueta, con los mismos tokens del trazo recorrido.
  - Clic, Enter o Espacio toman la rama. La acción, el registro y el
    servidor no cambian.
  - Una rama retenida (6.18) no envía nada, y su nota sale como tooltip
    sobre ese objetivo, donde se eligió.
  - El panel lateral conserva el contenido del paso. Debajo lista las
    ramas sin botones: etiqueta, a dónde lleva y su estado («Ya
    recorrida» o «Falta»), bajo «Elige la rama en el diagrama».
    - «Ir a lo que falta por visitar» sigue siendo un botón del panel,
      porque no es una rama.
  - Al llegar a una decisión, el foco va al primer objetivo pendiente.
  - En celular se toca el objetivo; no hay hover.
  - Pruebas:
    - del renderer: objetivos, nombres y atributos, en las decisiones
      reales;
    - verificación en Chrome con mouse, teclado y celular.
- **6.21:** el zoom del recorrido viene activo en todas las pantallas y
  encuadra el paso actual con un par de pasos atrás y un par adelante
  (las ramas, si es una decisión).

Preguntas abiertas para 6.20:

1. **Ramas gemelas** (Apertura P34: «Sí» y «No» llevan a P35): hay un
   solo paso de destino, así que habría un solo objetivo. Propuesta: toma
   la primera rama pendiente y su nombre dice «Rama «Sí» o «No»». Como la
   decisión es paralela, el resultado es el mismo con cualquiera.
2. **Orden:** 6.21 no depende de 6.20, y con el zoom activo los objetivos
   quedan siempre a la vista. Propuesta: construir 6.21 primero, mientras
   6.20 espera aprobación.

## plan_iteration_5 — 2026-11-19

Estado: **aprobada. Esta es la iteración vigente.**

Es `plan_iteration_4` tal cual, con los cortes 6.11 a 6.16 aprobados por el
dueño y sus respuestas. SPEC §7 y §9 recogen las que cambian el texto
(`df6620b`).

1. **Una rama directa al punto de encuentro cuenta como «un paso».** Cero
   pasos es menos que uno: tampoco hay nada que decidir (Instalaciones P11,
   Apertura P34).
2. **El aviso fijo sale en toda vuelta a una decisión,** con el texto
   «Faltan ramas por recorrer en esta decisión. Elige una para seguir.».
3. **El Enlace en el panorama lleva al panorama del otro flujo,** no a su
   recorrido. El tooltip sale con acceso y sin él; tocarlo, solo con acceso.
4. **El reporte es la cuarta pantalla con JavaScript propio** (SPEC §9) y
   sigue funcionando sin él.

Al terminar, la etiqueta `phase-6` se mueve al último commit de estos cortes.

Orden de trabajo: se empieza por 6.11.

---

## plan_iteration_4 — 2026-11-19

Estado: **propuesta, pendiente de aprobación.** Hasta que se apruebe, la
vigente sigue siendo `plan_iteration_3`.

Agrega a la iteración 3 seis cortes de corrección de la fase 6, por las
pruebas del dueño y su cambio a SPEC §7 (`63e82bc`). Lo demás no cambia.

**Lo que hace hoy el motor (punto 4 del dueño).** No refleja la regla
nueva. Decide por las ramas que *faltan*, así que el resultado depende del
orden en que el usuario elige. En los flujos reales cambian tres
decisiones, todas con una rama directa al punto de encuentro y otra larga:
Apertura P31, Instalaciones P9 y P17. Hoy, si se elige primero la larga, el
recorrido entra al punto de encuentro sin volver; con la regla nueva vuelve
a la decisión. Las pruebas aleatorias (400 y 2000 grafos) solo comprueban
que el recorrido termina y que el avance no retrocede: no miran la regla.

**6.11 — La regla de las ramas seguidas, por la forma** (SPEC §7)
- El motor recorre seguidas las ramas solo cuando todas las de la decisión
  llegan al mismo punto de encuentro en un paso. En cualquier otro caso
  vuelve a la decisión.
- Las pruebas que fijaban el comportamiento por orden se reescriben.
- Una prueba aleatoria nueva comprueba la regla misma: en cada decisión,
  vuelve o no vuelve según su forma, elija el usuario en el orden que elija.

**6.12 — Ramas paralelas en el diagrama** (SPEC §7, Layout)
- Una flecha de doble punta une entre sí los pasos de las ramas que se
  recorren seguidas. Sale en todas partes donde se dibuja el diagrama.
- La condición es una sola función de `core.js`, compartida con el motor.

**6.13 — Aviso fijo al volver a una decisión** (SPEC §7)
- Un aviso sobre el diagrama dice que faltan ramas por recorrer. Se queda
  hasta que se elige una rama.

**6.14 — Convenciones y etiquetas dentro del lienzo** (SPEC §7)
- La leyenda «Convenciones» encima del diagrama, en el recorrido y en el
  repaso libre, donde salen las etiquetas. Un flujo sin categorías no la
  muestra.
- El lienzo se agranda lo necesario para que ninguna etiqueta quede cortada.

**6.15 — Enlaces clickeables en el panorama** (SPEC §7)
- Con acceso, el paso Enlace del panorama lleva al otro flujo, con un
  tooltip que dice a dónde.

**6.16 — Filtro en vivo en el reporte**
- Sin botón «Filtrar»: la tabla se actualiza al cambiar un filtro, sin
  recargar la página y sin mover el foco. Sin JavaScript, el botón vuelve.

Preguntas abiertas: ver el mensaje al dueño del 2026-11-19 tras `63e82bc`.

---

## plan_iteration_3 — 2026-11-19

Estado: **aprobada. Esta es la iteración vigente.**

Es `plan_iteration_2` tal cual, con los cortes 6.1 a 6.10 aprobados por el
dueño y sus respuestas a las cinco preguntas abiertas. SPEC §5 y §7 las
recogen (`c395a40`).

1. **El contacto en la parrilla** va en columna propia, justo después de
   Flujo. La parrilla ya tiene su scroll horizontal.
2. **Un contacto en un tipo que no lo lleva** se ignora con un aviso, igual
   que `FLUJO` (SPEC §5).
3. **«Ir a «X»» con un recorrido abierto en X** lo continúa donde iba. Llegar
   nunca borra avance; «Empezar de nuevo» lo elige el usuario (SPEC §7).
4. **En el archivo de referencia,** `CONTACTO` va después de `FLUJO`, como
   en la plantilla. El archivo de referencia y la plantilla no pueden
   divergir.
5. **El zoom del recorrido** («Ver todo» / «Acercar») entra en el corte 6.8.

Orden de trabajo: se empieza por 6.1.

---

## plan_iteration_2 — 2026-11-19

Estado: **propuesta, pendiente de aprobación.** Hasta que se apruebe, la
vigente sigue siendo `plan_iteration_1`.

Agrega a la iteración 1 los cortes de la **fase 6, Cierre** (SPEC §11):
revisión libre, móvil, pasos `link`, selector de flujos, reporte de avance y
PWA. Incluye el contacto de los enlaces que el dueño agregó a SPEC §5, §6 y
§7 el 2026-11-19 (`2e01096`). Lo demás de la iteración 1 no cambia.

### Fase 6 — Cierre

Primero los datos, porque el contacto viaja en el documento de cada versión
y todo lo demás lo lee. Después el visor, y al final lo que no depende de
nada.

**6.1 — El contacto en los datos, la plantilla, la importación y la
exportación**

- `core.js`: campo `contact` en la fila del grid y en el paso, texto libre,
  opcional.
- Se lee de la columna `CONTACTO` (también `Contact`).
- En un paso que no es `link` ni `subflow` se ignora, con un aviso que no
  bloquea, igual que hoy con `FLUJO`.
- Sin migración SQL: el paso vive en el documento JSON de cada versión. Los
  documentos ya guardados no lo traen y se leen como vacío.
- Plantilla y exportación con la columna `CONTACTO` justo después de
  `FLUJO`. El round trip de `xlsx-write.test.js` la cubre.
- Es contenido del paso: cambiarlo va al borrador y se publica como
  cualquier otro cambio.
- Casos nuevos en `core.test.js`, sin quitar ninguno.

**6.2 — El contacto en el editor**

- Solo en filas Enlace y Subflujo, junto al selector de Flujo (SPEC §6).
  En las demás filas, vacío y sin editar, como Flujo.
- La forma, columna propia o dentro de la celda de Flujo, queda a decisión
  del dueño (pregunta 1).

**6.3 — La referencia: contacto en `reference/Flujo_Apertura_OT.xlsx`**

- El paso P13, enlace a Instalaciones, estrena el contacto «Jefe de
  instalación». El dueño autoriza esta edición de `reference/`.
- Edición puntual del XML de la hoja «Flujo», no con nuestro escritor:
  reescribir el archivo perdería las hojas «Dudas» y el formato.
- Se regenera `Flujo_Apertura_OT.grid.json` con `tools/xlsx-to-grid.mjs`, y
  `db:load` publica la versión menor siguiente.

**6.4 — Enlaces navegables en el visor**

- En un paso `link`, el panel lateral nombra el otro flujo y su contacto,
  con acceso o sin él.
- Con acceso, «Ir a «X»» abre el visor de X desde su inicio, como recorrido
  propio, sin migas ni regreso automático.
- Sin acceso, solo el nombre y el contacto. El servidor decide el acceso
  con la misma regla de las rutas, y la respuesta no deja ver nada del otro
  flujo.
- Un enlace con salidas ofrece las dos acciones: «Ir a «X»» en el panel y
  «Siguiente» en la esquina del diagrama.
- El recorrido que se deja queda abierto, como cualquier otro que no se
  termina.

**6.5 — Inicio: el recorrido pendiente dice dónde quedó**

- La tarjeta de un flujo con recorrido abierto dice en qué paso va
  (SPEC §7).

**6.6 — Revisión libre**

- Diagrama completo; clic en cualquier paso abre su panel.
- Resaltar los pasos que llevan una etiqueta.
- Se desbloquea al terminar el recorrido.

**6.7 — Selector de flujos en el visor**

- Con las reglas de SPEC §7: solo con más de un flujo, o para Junta y
  Líderes.

**6.8 — Móvil y zoom del recorrido**

- El panel del paso, en su forma mínima, arriba del diagrama. Los botones
  en la esquina del diagrama.
- «Ver todo» / «Acercar» en todas las pantallas, con «Acercar» por defecto
  en el teléfono (SPEC §9, Layout).

**6.9 — Reporte de avance**

- Solo para Junta y Líderes. Un Líder ve solo a quienes comparten un área
  con él; el filtro lo aplica el servidor.
- Las columnas de revisión de stage 1, ordenable y filtrable.

**6.10 — PWA**

- Manifiesto y service worker que cachea solo el shell de la app.

La fase termina cuando P13 de Apertura de OT muestra su contacto y lleva a
Instalaciones desde su inicio a quien tiene acceso. Además, cada parte de
SPEC §11 fase 6 debe funcionar en el D1 local, con sus pruebas.

### Preguntas abiertas para el dueño

1. **El contacto en la parrilla del editor.**
   - Columna propia después de Flujo: las filas no cambian de alto, pero la
     parrilla crece unos 160px y Salidas sale de la vista a 1280px.
   - Dentro de la celda de Flujo, bajo el selector: el ancho no cambia,
     pero las filas de enlace crecen, contra «solo crecen las filas de
     decisión».
   - Recomendación: columna propia.
2. **Contacto en un tipo que no lo lleva:** ¿se ignora con aviso, como
   `FLUJO`, o es un error que bloquea?
3. **«Ir a «X»» cuando ya hay un recorrido abierto en X:** SPEC dice
   «desde su inicio». ¿Se reinicia ese recorrido, o se abre la vista
   general de X con «Continuar recorrido»?
4. **El archivo de referencia:** ¿`CONTACTO` va al final de la hoja, que
   es la edición más segura porque la lectura es por encabezado, o después
   de `FLUJO`, como en la plantilla, aunque obliga a desplazar las columnas
   siguientes en el XML?
5. **El zoom del recorrido** está en SPEC §9 pero no en la lista de la fase
   6 de §11, y no se construyó en la fase 3. ¿Entra en 6.8?

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
