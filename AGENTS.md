# AGENTS.md — project context

> **DAW template.** Fill in the `[...]` with what is true of YOUR project and delete what does not
> apply. This file describes **the project**; **the process** is DAW's job (phases, gates, when to
> test, when to commit). Do not mix the two: process rules written here compete with the pipeline's.
>
> It is **tool-agnostic on purpose**: Claude Code reads it through the import in `CLAUDE.md`, Codex
> CLI, Copilot CLI, Cursor and OpenCode read it directly, and Gemini CLI gets it through
> `GEMINI.md`. The same file serves whichever tool you open the repo with — which is the point:
> porting the pipeline to another tool must not mean rewriting what your project is.

---

## Language

**Always respond in the language the user writes in.** Write every artifact you produce — PRDs,
specs, ADRs, reports, commit messages, status lines — in that same language, regardless of the
language these instructions are written in.

If this project has a fixed working language, state it here and use it instead:

> Working language: `[e.g. Spanish — write all artifacts in Spanish]`

---

## What this project is

[One or two sentences: what the app does and who for. Take it from the PRD, do not reinvent it.]

**Reference PRD:** `docs/daw/prd/PRD.md`

---

## Stack

**This is the only place the stack lives.** DAW reads it from here and generates no derived file.
Fill it in even if the repo is empty: without a stack there is nothing to plan or implement against.

If the repo already has code and this section is empty, DAW will detect the stack from your config
files and **propose the text for you to paste here**. You always confirm it.

- React 19 + Vite 8, Node 22.12+
- Supabase (cliente JS directo, sin backend propio) + PostgreSQL
- Autenticación: Google OAuth (vía Supabase Auth)
  - Temporal: mientras se construye la feature central se usa el inicio de sesión anónimo de Supabase. Aislar ese código para reemplazarlo por Google OAuth (RF-22, RF-23) sin tocar la lógica de movimientos.
  - Si falla el inicio de sesión anónimo, mostrar un mensaje de error de RF-105 (en español, tratando de usted, sin detalles técnicos) con el botón "Aceptar" para reintentar. Es un requisito provisorio: cuando se incorpore Google se reemplaza por RF-24.
  - Requiere en Supabase: Authentication → Sign In / Providers → "Allow anonymous sign-ins" activado.
- Librerías: react-router; react-day-picker + date-fns (calendario); ESLint.
- Herramientas de prueba:
  - Vitest + Testing Library + jsdom: pruebas unitarias y de integración, incluido el doble clic en "Guardar" / "Confirmar" de RF-106 (AC-129, AC-130) y el rechazo desde la API de RF-107 (AC-131).
  - Playwright + axe-core: pruebas en un navegador real para el rendimiento de RNF-01 y RNF-02 (AC-114, AC-115: Chrome con la CPU ralentizada 4× y 100 mediciones por operación) y para el uso solo con teclado, el foco visible y el texto alternativo de los íconos de RNF-08 (AC-133).
- Dependencias: usar siempre la última versión estable al incorporarlas. Las versiones exactas quedan en `package.json`.

### Cómo correr

```bash
npm install
npm run dev
npm test
```

- Requiere `.env.local` (ver `.env.example`) y las migraciones de `supabase/migrations/` ejecutadas en orden.
- Los tests de `pruebas/` corren contra Supabase y crean usuarios anónimos por corrida, marcados con `es_prueba = true`. Borrarlos con `supabase/scripts/limpiar_usuarios_prueba.sql`. Supabase limita los inicios de sesión anónimos (~30 por hora por IP).



---

## Architecture conventions

- Sin backend propio: el frontend habla directo con Supabase mediante supabase-js. La lógica que debe ser atómica (alta, edición y eliminación de movimientos que actualizan el saldo) va en funciones SQL llamadas por RPC.
- Supabase solo expone por RPC funciones (`CREATE FUNCTION`), no `CREATE PROCEDURE`. Por eso los "stored procedures" con prefijo `BASP_` se definen como funciones.
- Los usuarios viven en `auth.users` de Supabase. No se crea una tabla `BAT_USUARIOS` salvo que haga falta guardar datos propios del usuario.
- El código del inicio de sesión temporal (anónimo) queda aislado para poder reemplazarlo por Google OAuth sin tocar la lógica de movimientos.

---

## Code conventions

Todo el código propio va en español. Solo se exceptúan los nombres que imponen las herramientas (`main.jsx`, `App.jsx`, `vite.config.js`, `index.html`, variables `VITE_*`) y los nombres propios (Supabase, Google).

Tono de la interfaz: todos los textos y mensajes al usuario tratan de **usted** ("Vuelva a ingresar", "¿Está seguro que desea…?"), como el PRD.

Mayúsculas en la interfaz:
- Títulos, subtítulos, botones, pestañas, etiquetas de campos, encabezados de tablas y nombres de categorías y cuentas creados por la app: **mayúscula inicial en cada palabra** ("Añadir Gasto", "Pago Realizado", "Mi Cuenta", "Gastos por Categoría"). Los artículos, preposiciones y conjunciones (de, del, la, el, por, para, con, en, a, y, o) van en minúscula salvo que sean la primera palabra.
- Párrafos, mensajes de error, confirmaciones, textos de ayuda y placeholders: solo la primera letra de la oración en mayúscula ("Todavía no registró movimientos.").
- Los nombres que escribe el usuario (categorías propias) se guardan y muestran tal como los escribió.


### JavaScript / React

- Funciones y métodos: PascalCase en español, con verbo al inicio. Ej.: `AgregarIngreso`, `AgregarGasto`, `EditarMovimiento`, `EliminarMovimiento`, `ObtenerSaldo`.
- Componentes React: PascalCase en español. Ej.: `FormularioMovimiento`, `ListaMovimientos`.
- Estado de React: el setter de `useState` también es una función en español: `const [saldo, EstablecerSaldo] = useState(0)`. Los manejadores de eventos empiezan con `Manejar` (`ManejarEnvio`) y las props de callback con `al` (`alGuardar`, `alCancelar`).
- Hooks de React: `use` + PascalCase en español, porque React exige el prefijo `use` para reconocerlos. Ej.: `useSesion`, `useMensajes`.
- Clases CSS: kebab-case en español (`lista-movimientos`, `mensaje-error`).
- Variables y parámetros: camelCase en español. Ej.: `saldoActual`, `idCategoria`. Los identificadores llevan `id` al inicio.
- Archivos: los de componentes, igual que el componente (`FormularioMovimiento.jsx`); el resto, en camelCase (`clienteSupabase.js`, `movimientos.test.js`).

### Base de datos (PostgreSQL / Supabase)

Prefijo `BA` (Balance App) + tipo de objeto + nombre en español, en mayúsculas y con guiones bajos:

| Objeto | Prefijo | Ejemplo |
|---|---|---|
| Tabla | `BAT_` | `BAT_CUENTAS`, `BAT_CATEGORIAS`, `BAT_MOVIMIENTOS` |
| Trigger | `BATR_` | `BATR_CREAR_CUENTA_USUARIO` |
| Función de trigger | `BATF_` | `BATF_CREAR_CUENTA_USUARIO` |
| Stored procedure (función llamada vía RPC) | `BASP_` | `BASP_AGREGAR_MOVIMIENTO` |
| Vista | `BAV_` | `BAV_GASTOS_POR_CATEGORIA` |
| Índice | `BAIX_` | `BAIX_MOVIMIENTOS_CUENTA_FECHA` |
| Política RLS | `BAPOL_` | `BAPOL_MOVIMIENTOS_PROPIETARIO` |
| Clave primaria | `BAPK_` | `BAPK_MOVIMIENTOS` |
| Clave foránea | `BAFK_` | `BAFK_MOVIMIENTOS_CUENTA` |
| Restricción única | `BAUQ_` | `BAUQ_CUENTAS_USUARIO` |
| Restricción check | `BACK_` | `BACK_MOVIMIENTOS_MONTO_POSITIVO` |

- Columnas: snake_case en español, en minúsculas. Ej.: `id`, `id_usuario`, `id_cuenta`, `id_categoria`, `monto`, `saldo`, `fecha`, `tipo`. Las claves foráneas llevan `id_` al inicio (`id_usuario`, nunca `usuario_id`).
- Variables y parámetros en funciones SQL: snake_case en español, con prefijo `v_` para variables locales y `p_` para parámetros, respetando `id` al inicio. Ej.: `v_id_cuenta`, `p_monto`, `p_id_categoria`.
- Los nombres se escriben en MAYÚSCULAS y sin comillas en el SQL. PostgreSQL los guarda en minúsculas (`bat_movimientos`), así que desde supabase-js se referencian en minúsculas: `clienteSupabase.from('bat_movimientos')`, `clienteSupabase.rpc('basp_agregar_movimiento')`.



---

## What NOT to do in this project

This section is worth its weight in gold: it is where the scars go, the things that already went
wrong once.

- No crear múltiples cuentas por usuario ni transferencias entre cuentas (fuera de alcance del PRD).
- No agregar soporte multi-idioma ni librerías de internacionalización: la interfaz es solo en español (fuera de alcance del PRD).
- No permitir que un movimiento quede sin categoría: usar siempre las categorías por defecto "Pago Realizado" / "Pago Ingresado" si el usuario no eligió una (RF-35, RF-36).
- No implementar autenticación con contraseña propia ni almacenar credenciales en la aplicación (fuera de alcance del PRD).
- No usar float para montos: usar tipo decimal/numeric con al menos dos decimales (RNF-04).
- No permitir acceso a cuentas, categorías o movimientos de otro usuario (RNF-03).
- No dejar el saldo inconsistente ante operaciones parciales de alta/edición/borrado de movimientos (RNF-05).
- No convertir la fecha de un movimiento a UTC: es un día calendario (`date` en SQL, `"AAAA-MM-DD"` en JS), el que el usuario elige. "Hoy" se calcula con la fecha local del dispositivo; no usar `toISOString()` para obtenerla ni `new Date("AAAA-MM-DD")` para leerla, porque ambos corren el día. Única excepción: el servidor rechaza fechas posteriores a mañana en UTC (RF-107), porque no conoce la zona del usuario; esa validación no modifica la fecha guardada.
- No usar "egreso" en ningún lado (código, SQL, textos de la interfaz): el término es "gasto".
- No fijar versiones viejas de dependencias: al incorporar una, usar su última versión estable.

---

## Domain glossary

The terms specific to your product, so the agent uses them correctly instead of inventing synonyms.

- **Movimiento:** cada registro de dinero de la cuenta; es un ingreso o un gasto, siempre con monto, fecha y categoría.
- **Ingreso:** movimiento que suma al saldo. En la base de datos, `tipo = 'INGRESO'`.
- **Gasto:** movimiento que resta del saldo. En la base de datos, `tipo = 'GASTO'`. Nunca llamarlo "egreso".
- **Cuenta:** la cuenta de balance única de cada usuario (una sola por usuario).
- **Saldo:** suma de los ingresos menos la suma de los gastos de la cuenta.
- **Categoría:** clasificación de un movimiento. Puede ser una por defecto o una creada por el usuario.
- **Pago Realizado:** categoría por defecto de un gasto.
- **Pago Ingresado:** categoría por defecto de un ingreso.
- **Gasto hormiga:** gastos chicos y frecuentes que los reportes por categoría ayudan a detectar.

---

> ℹ️ **What does NOT belong in this file, because DAW provides it:** the order work happens in, when
> the spec gets written, when tests run, when to commit, what it takes to move between phases. All
> of that lives in `.daw/` and applies on its own.

<!-- BEGIN DAW (managed by DAW — do not edit by hand) -->
# DAW — Dilux Agentic Workflow

This repo uses **DAW**: an agent-driven development pipeline with the phases
`CLASSIFY → DEFINE → PLAN → CODE → VERIFY → RELEASE`.

Before answering, read `.daw/orchestrator.md` and run its Boot Sequence. It is a strict state
machine: it decides what you are allowed to do based on the phase recorded in `.daw-state.json`.

The project's own context — stack, architecture, domain — is elsewhere in this file. It lives here,
in `AGENTS.md`, and not in any one tool's file, on purpose: it is tool-agnostic and comes along
unchanged when the pipeline is ported to another agent.
<!-- END DAW -->
