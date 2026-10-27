# Spec FEAT-001a: Cuenta, Saldo, Alta y Lista de Movimientos

| Field | Value |
|-------|-------|
| Ticket | FEAT-001a |
| PRD | docs/daw/prd/prd-FEAT-001a.md |
| Tier | FEATURE |
| Date | 2026-10-25 |
| Spec loops | 1 |

## Summary

Se construye la primera versión de MiBalance sobre React 19 + Vite y Supabase, sin backend propio.
En la base de datos se crean las tablas de cuentas, categorías y movimientos; un trigger sobre
`auth.users` crea la cuenta "Mi Cuenta" y las dos categorías por defecto en la misma transacción del
registro; el alta de un movimiento es una única función SQL atómica (`BASP_AGREGAR_MOVIMIENTO`)
llamada por RPC, y los usuarios solo pueden **leer** sus datos (RLS de solo lectura, sin permisos de
escritura directa). Los montos y el saldo viajan al navegador como texto y se formatean como cadenas
(ADR-001). En el frontend, la sesión anónima queda aislada en `src/sesion/`, la sección Cuenta vive
en `/` y los formularios de alta son pantallas propias (`/gasto/nuevo`, `/ingreso/nuevo`).

Decisiones de diseño acordadas en PLAN:
- D1 — Montos como texto en el navegador, sin `Number` (`docs/adr/adr-001-montos-como-texto.md`).
- D2 — Formularios de alta como pantallas propias con react-router.
- D3 — Falla simulada para probar la atomicidad mediante `pruebas.BAT_FALLAS_SIMULADAS`, escribible
  solo con la service role (`docs/adr/adr-002-falla-simulada-en-funciones.md`).

Terminología: se usan los términos del PRD y del glosario de `AGENTS.md` — movimiento, ingreso,
gasto, cuenta, saldo, categoría, "Pago Realizado", "Pago Ingresado". Nunca "egreso".

## Coverage: PRD → blocks

| Requirement | Covered by |
|---|---|
| FR-01 | Block 4 |
| FR-02 | Block 4 |
| FR-03 | Block 4 (supabase-js con `persistSession`), Block 7 (prueba en navegador) |
| FR-04 | Block 2 |
| FR-05 | Block 2 |
| FR-06 | Block 5 |
| FR-07 | Block 3 (formato), Block 5 |
| FR-08 | Block 3 (signo del saldo), Block 5 |
| FR-09 | Block 2, Block 6 |
| FR-10 | Block 2, Block 6 |
| FR-11 | Block 2, Block 6 |
| FR-12 | Block 6 |
| FR-13 | Block 6 |
| FR-14 | Block 6 |
| FR-15 | Block 6 |
| FR-16 | Block 6 |
| FR-17 | Block 3 (orden), Block 6 |
| FR-18 | Block 6 |
| FR-19 | Block 6 |
| FR-20 | Block 3 (fecha local), Block 6 |
| FR-21 | Block 6 |
| FR-22 | Block 2, Block 6 |
| FR-23 | Block 2, Block 6 |
| FR-24 | Block 3 (validación), Block 6 |
| FR-25 | Block 3 (validación), Block 6 |
| FR-26 | Block 3 (filtro), Block 6 |
| FR-27 | Block 3 (filtro), Block 6 |
| FR-28 | Block 3 (formato), Block 6 |
| FR-29 | Block 2 |
| FR-30 | Block 6 |
| FR-31 | Block 6 |
| FR-32 | Block 6 |
| FR-33 | Block 6 |
| FR-34 | Block 2 (orden de la vista e índice), Block 5 |
| FR-35 | Block 3 (agrupado), Block 5 |
| FR-36 | Block 3 (formato), Block 5 |
| FR-37 | Block 5 |
| FR-38 | Block 5 |
| FR-39 | Block 5 |
| FR-40 | Block 5 |
| FR-41 | Block 5 |
| FR-42 | Block 6 |
| FR-43 | Block 4 |
| FR-44 | Block 4, Block 6 |
| FR-45 | Block 5 |
| FR-46 | Block 6 |
| FR-47 | Block 3 (agrupado por página), Block 5 |
| FR-48 | Block 6 |
| FR-49 | Block 2 |
| FR-50 | Block 2 |
| NFR-01 | Estrategia: una sola llamada RPC por alta (una transacción, sin idas y vueltas), índice `BAIX_MOVIMIENTOS_CUENTA_FECHA` que cubre el orden de la lista, recarga de solo 50 filas (página 1) y del saldo. Medido en Block 7 (AC-50) |
| NFR-02 | Estrategia: RLS con políticas solo de SELECT para el propietario, `REVOKE ALL` + `GRANT SELECT` en tablas y vistas, vistas con `security_invoker`, funciones `SECURITY DEFINER` que resuelven la cuenta desde `auth.uid()` y FK compuesta que impide categorías ajenas. Probado en Block 2 |
| NFR-03 | Estrategia: `numeric(14,2)` en montos y `numeric` sin precisión en el saldo; los valores viajan como texto (`round(saldo, 2)::text`, `monto::text`) y se formatean como cadenas (ADR-001). Block 2 y Block 3 |
| NFR-04 | Estrategia: alta en una sola función SQL (todo o nada), sin permisos de escritura directa en tablas, falla simulada entre el INSERT y el UPDATE (ADR-002). Block 2 |
| NFR-05 | Estrategia: CSS con unidades relativas, contenedor de ancho máximo, filas de la lista con `flex-wrap` y montos con `overflow-wrap: anywhere`; sin anchos fijos mayores a 320px. Medido en Block 7 (AC-59) |
| NFR-06 | Estrategia: todos los mensajes de error son textos fijos definidos en `src/mensajes/textos.js`; los servicios nunca muestran el mensaje de Supabase, solo devuelven un resultado `{ ok: false }`. Block 4, 5, 6 y Block 7 |
| NFR-07 | Estrategia: HTML semántico (`button`, `label`, `select`), react-day-picker (navegable con teclado), estilo `:focus-visible` global con contorno de 3px, foco gestionado al abrir y cerrar mensajes, `aria-label` en íconos. Medido en Block 7 (AC-61) |
| NFR-08 | Estrategia: paleta con contraste verificado (texto `#1a1a1a` sobre `#ffffff`, verde `#1b6e3a`, rojo `#b3261e`, ambos ≥ 4,5:1), definida como variables en `src/estilos.css`. Medido con axe-core en Block 7 (AC-62) |

## Dependencies between blocks

- Block 1 (andamiaje) va primero: todos los demás dependen de él.
- Block 2 (base de datos) depende de Block 1. Es independiente de Block 3.
- Block 3 (utilidades puras) depende de Block 1. Es independiente de Block 2.
- Block 4 (sesión y mensajes) depende de Block 1.
- Block 5 (sección Cuenta) depende de Blocks 2, 3 y 4.
- Block 6 (formulario de alta) depende de Blocks 2, 3, 4 y 5.
- Block 7 (pruebas en navegador) depende de todos los anteriores.

Orden de ejecución: 1 → 2 → 3 → 4 → 5 → 6 → 7.

## Block 1 — Andamiaje del proyecto

**Files**
- `package.json` (new) — scripts `dev`, `build`, `lint`, `test` (Vitest, proyectos `unitarias` y `supabase`), `test:navegador` (Playwright). Dependencias en su última versión estable: react, react-dom, react-router, @supabase/supabase-js, react-day-picker, date-fns; de desarrollo: vite, @vitejs/plugin-react, vitest, jsdom, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, @playwright/test, @axe-core/playwright, eslint y sus plugins de React.
- `package-lock.json` (new) — generado por `npm install`, se commitea.
- `vite.config.js` (new) — plugin de React; Vitest con `test.projects`: `unitarias` (jsdom, `src/**/*.test.{js,jsx}`, `setupFiles: src/pruebas/configuracion.js`, `env.TZ = 'America/Argentina/Buenos_Aires'`) y `supabase` (node, `pruebas/**/*.test.js`); `exclude: ['pruebas-navegador/**', 'node_modules/**']`; lee `.env.local` y `.env.pruebas.local` con `loadEnv(mode, process.cwd(), '')`.
- `playwright.config.js` (new) — `testDir: 'pruebas-navegador'`, `webServer` con `npm run dev`, Chromium, lectura de `.env.pruebas.local` con `loadEnv`, `globalSetup: './pruebas-navegador/configuracionGlobal.js'`.
- `eslint.config.js` (new) — configuración plana con reglas de React y React Hooks, y `react/no-danger` en error (mitigación R6 del threat model).
- `index.html` (new) — `lang="es"`, título "MiBalance", monta `src/main.jsx`.
- `src/main.jsx` (new) — monta `App` dentro de `BrowserRouter`.
- `src/App.jsx` (new) — esqueleto con las rutas `/`, `/gasto/nuevo`, `/ingreso/nuevo` (las páginas se completan en Blocks 5 y 6).
- `src/estilos.css` (new) — variables de color (NFR-08), `:focus-visible`, contenedor responsive.
- `src/servicios/clienteSupabase.js` (new) — `createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: true } })`.
- `src/pruebas/reglasLint.test.js` (new) — verifica que la regla `react/no-danger` esté activa.
- `src/pruebas/configuracion.js` (new) — importa `@testing-library/jest-dom/vitest` y ejecuta `cleanup` después de cada prueba.
- `.env.example` (new) — `VITE_SUPABASE_URL=`, `VITE_SUPABASE_ANON_KEY=` y, comentado, que `SUPABASE_SERVICE_ROLE_KEY=` va solo en `.env.pruebas.local`.
- `.gitignore` (modified) — fuera del bloque `# BEGIN DAW … # END DAW`: `node_modules/`, `dist/`, `.env*.local`, `test-results/`, `playwright-report/`, `__pycache__/`.

**Logic**
Deja un proyecto que instala, compila, pasa el lint y ejecuta una prueba trivial en cada proyecto de
Vitest. La clave de service role nunca lleva prefijo `VITE_`, así que Vite no la incluye en el
código del navegador.

**Error handling**
- Faltan `VITE_SUPABASE_URL` o `VITE_SUPABASE_ANON_KEY` al arrancar: `clienteSupabase.js` lanza un error con el texto "Faltan variables de entorno de Supabase. Revise .env.local." (solo visible para quien desarrolla, en la consola; la interfaz muestra el error de FR-02 porque la sesión no se puede iniciar).
- Un componente usa `dangerouslySetInnerHTML` → `npm run lint` falla por `react/no-danger` (R6).

**Required tests**
- [ ] `src/servicios/clienteSupabase.test.js` — crea el cliente con las variables definidas.
- [ ] `src/servicios/clienteSupabase.test.js` (error) — sin `VITE_SUPABASE_URL` lanza el error "Faltan variables de entorno de Supabase. Revise .env.local.".
- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] (error R6) `src/pruebas/reglasLint.test.js` (new) — con la API de ESLint, un componente de ejemplo con `dangerouslySetInnerHTML` produce un error de `react/no-danger`.

**Completion criterion**
`npm install`, `npm run lint`, `npm run build` y `npx vitest run --project unitarias` terminan sin
errores, y `git status` no muestra `.env.local`, `.env.pruebas.local`, `node_modules/` ni
`__pycache__/`.

## Block 2 — Base de datos, permisos y pruebas contra Supabase

**Files**
- `supabase/migrations/20261025000100_cuentas_y_movimientos.sql` (new) — esquema, permisos, trigger, función y vistas.
- `supabase/scripts/limpiar_usuarios_prueba.sql` (new) — borra los usuarios de prueba.
- `supabase/scripts/revertir_cuentas_y_movimientos.sql` (new) — elimina en orden inverso todo lo que crea la migración (rollback).
- `pruebas/utilidades/clientesPrueba.js` (new) — `CrearUsuarioPrueba()` (inicio anónimo y luego, con la service role, `auth.admin.updateUserById(id, { app_metadata: { es_prueba: true } })` — `app_metadata` solo lo escribe la service role, mitigación R12; reutilizado dentro de la corrida por el límite de ~30 inicios por hora), `CrearClienteAdministrador()` (service role), `CargarCategoria(idCuenta, nombre, tipo)`, `ActivarFallaSimulada(idUsuario, punto)`, `DesactivarFallaSimulada(idUsuario)`.
- `pruebas/registro.test.js` (new) — trigger de registro.
- `pruebas/movimientos.test.js` (new) — `BASP_AGREGAR_MOVIMIENTO`.
- `pruebas/seguridad.test.js` (new) — RLS y permisos.

**Data model**

Todos los nombres en MAYÚSCULAS y sin comillas (PostgreSQL los guarda en minúsculas).

- `public.BAT_CUENTAS`
  - `id` uuid NOT NULL DEFAULT `gen_random_uuid()` — `BAPK_CUENTAS`.
  - `id_usuario` uuid NOT NULL — `BAFK_CUENTAS_USUARIO` → `auth.users(id)` ON DELETE CASCADE; `BAUQ_CUENTAS_USUARIO` UNIQUE (una sola cuenta por usuario, AC-08).
  - `nombre` text NOT NULL DEFAULT 'Mi Cuenta' — `BACK_CUENTAS_NOMBRE` CHECK (`length(btrim(nombre)) BETWEEN 1 AND 30 AND nombre = btrim(nombre)`).
  - `moneda` text NOT NULL DEFAULT 'USD' — `BACK_CUENTAS_MONEDA` CHECK (`moneda ~ '^[A-Z]{3}$'`).
  - `saldo` numeric NOT NULL DEFAULT 0.00 (sin precisión: sin tope de dígitos enteros, NFR-03) — `BACK_CUENTAS_SALDO_ESCALA` CHECK (`scale(saldo) <= 2`).
  - `creado_en` timestamptz NOT NULL DEFAULT `now()`.
- `public.BAT_CATEGORIAS`
  - `id` uuid NOT NULL DEFAULT `gen_random_uuid()` — `BAPK_CATEGORIAS`.
  - `id_cuenta` uuid NOT NULL — `BAFK_CATEGORIAS_CUENTA` → `BAT_CUENTAS(id)` ON DELETE CASCADE.
  - `nombre` text NOT NULL — `BACK_CATEGORIAS_NOMBRE` CHECK (`length(btrim(nombre)) BETWEEN 1 AND 30`).
  - `tipo` text NOT NULL — `BACK_CATEGORIAS_TIPO` CHECK (`tipo IN ('INGRESO', 'GASTO')`).
  - `es_por_defecto` boolean NOT NULL DEFAULT false.
  - `creado_en` timestamptz NOT NULL DEFAULT `now()`.
  - `BAUQ_CATEGORIAS_ID_CUENTA_TIPO` UNIQUE (`id`, `id_cuenta`, `tipo`) — destino de la FK compuesta.
  - Índices: `BAIX_CATEGORIAS_CUENTA` (`id_cuenta`, `tipo`); `BAIX_CATEGORIAS_DEFECTO` UNIQUE (`id_cuenta`, `tipo`) WHERE `es_por_defecto` (una sola por defecto por tipo).
- `public.BAT_MOVIMIENTOS`
  - `id` uuid NOT NULL DEFAULT `gen_random_uuid()` — `BAPK_MOVIMIENTOS`.
  - `id_cuenta` uuid NOT NULL — `BAFK_MOVIMIENTOS_CUENTA` → `BAT_CUENTAS(id)` ON DELETE CASCADE.
  - `id_categoria` uuid NOT NULL.
  - `tipo` text NOT NULL — `BACK_MOVIMIENTOS_TIPO` CHECK (`tipo IN ('INGRESO', 'GASTO')`).
  - `monto` numeric(14,2) NOT NULL — `BACK_MOVIMIENTOS_MONTO_POSITIVO` CHECK (`monto > 0`), `BACK_MOVIMIENTOS_MONTO_MAXIMO` CHECK (`monto <= 999999999999.99`).
  - `fecha` date NOT NULL.
  - `creado_en` timestamptz NOT NULL DEFAULT `clock_timestamp()` (momento del alta; no cambia al editar, FR-34).
  - `BAFK_MOVIMIENTOS_CATEGORIA` FOREIGN KEY (`id_categoria`, `id_cuenta`, `tipo`) → `BAT_CATEGORIAS(id, id_cuenta, tipo)` MATCH FULL ON DELETE NO ACTION — impide una categoría de otra cuenta o de otro tipo (AC-16, AC-53).
  - Índice `BAIX_MOVIMIENTOS_CUENTA_FECHA` (`id_cuenta`, `fecha` DESC, `creado_en` DESC, `id` DESC).
- `pruebas.BAT_FALLAS_SIMULADAS` (esquema `pruebas`, no expuesto por la API de Supabase; ADR-002)
  - `id_usuario` uuid NOT NULL — `BAPK_FALLAS_SIMULADAS`; `BAFK_FALLAS_SIMULADAS_USUARIO` → `auth.users(id)` ON DELETE CASCADE.
  - `punto` text NOT NULL — `BACK_FALLAS_SIMULADAS_PUNTO` CHECK (`punto IN ('AGREGAR_MOVIMIENTO')`).
- Vistas (`WITH (security_invoker = true)`, respetan RLS):
  - `public.BAV_CUENTA`: `id`, `nombre`, `moneda`, `round(saldo, 2)::text AS saldo`.
  - `public.BAV_MOVIMIENTOS`: `m.id`, `m.id_cuenta`, `m.fecha`, `m.tipo`, `m.monto::text AS monto`, `c.nombre AS nombre_categoria`, `m.creado_en` (JOIN con `BAT_CATEGORIAS`).

**Permisos**
- RLS habilitada en `BAT_CUENTAS`, `BAT_CATEGORIAS`, `BAT_MOVIMIENTOS` y `pruebas.BAT_FALLAS_SIMULADAS`.
- `REVOKE ALL` sobre las tres tablas y las dos vistas `FROM anon, authenticated`; `GRANT SELECT ... TO authenticated`. Ningún `GRANT` de INSERT, UPDATE ni DELETE (FR-49, FR-50, AC-54).
- Políticas `FOR SELECT TO authenticated`:
  - `BAPOL_CUENTAS_PROPIETARIO`: `id_usuario = (SELECT auth.uid())`.
  - `BAPOL_CATEGORIAS_PROPIETARIO` y `BAPOL_MOVIMIENTOS_PROPIETARIO`: `id_cuenta IN (SELECT id FROM public.BAT_CUENTAS WHERE id_usuario = (SELECT auth.uid()))`.
- `pruebas.BAT_FALLAS_SIMULADAS`: `REVOKE ALL FROM PUBLIC, anon, authenticated`; sin políticas. El esquema `pruebas` tiene `REVOKE USAGE FROM PUBLIC, anon, authenticated`.
- `REVOKE EXECUTE` de las dos funciones `FROM PUBLIC, anon, authenticated`; `GRANT EXECUTE ON FUNCTION public.BASP_AGREGAR_MOVIMIENTO(text, numeric, uuid, date) TO authenticated`.

**Logic**
- `public.BATF_CREAR_CUENTA_USUARIO()` — función de trigger, `SECURITY DEFINER`, `SET search_path = ''`, dueña `postgres`, todo calificado por esquema. Inserta la cuenta (`'Mi Cuenta'`, `'USD'`, `0.00`) para `NEW.id` y las categorías "Pago Realizado" (`GASTO`, `es_por_defecto = true`) y "Pago Ingresado" (`INGRESO`, `es_por_defecto = true`). `BATR_CREAR_CUENTA_USUARIO` AFTER INSERT ON `auth.users` FOR EACH ROW: corre en la transacción del registro, así que si falla, falla el registro (FR-02) y nunca queda un usuario sin cuenta.
- `public.BASP_AGREGAR_MOVIMIENTO(p_tipo text, p_monto numeric, p_id_categoria uuid, p_fecha date) RETURNS uuid` — `SECURITY DEFINER`, `SET search_path = ''`, dueña `postgres`, todo calificado. En orden:
  1. `v_id_usuario := auth.uid()`; si es NULL → error `BA401`.
  2. `v_id_cuenta` se obtiene de `public.BAT_CUENTAS` con `id_usuario = v_id_usuario` y `FOR UPDATE` (bloquea la fila del saldo); nunca de un parámetro. Si no existe → `BA404`.
  3. Validaciones (antes de escribir nada): `p_tipo`, `p_monto`, `p_id_categoria` o `p_fecha` NULL → `BA400`; `p_tipo` fuera de `('INGRESO','GASTO')` → `BA400`; `p_monto = 'NaN'`, `p_monto <= 0`, `p_monto > 999999999999.99` o `p_monto <> round(p_monto, 2)` → `BA422` (el tercer decimal se rechaza antes de que `numeric(14,2)` redondee; 'Infinity' cae en el máximo); `p_fecha > (now() AT TIME ZONE 'utc')::date + 1` → `BA423`; la categoría no existe con `id = p_id_categoria AND id_cuenta = v_id_cuenta AND tipo = p_tipo` → `BA424` (SECURITY DEFINER se salta RLS, por eso se valida la cuenta explícitamente).
  4. INSERT en `public.BAT_MOVIMIENTOS`.
  5. Si existe `pruebas.BAT_FALLAS_SIMULADAS` con `id_usuario = v_id_usuario AND punto = 'AGREGAR_MOVIMIENTO'` → error `BA500` (ADR-002).
  6. UPDATE de `public.BAT_CUENTAS.saldo` = `saldo + p_monto` (ingreso) o `saldo - p_monto` (gasto). Sin piso: el saldo puede quedar negativo (FR-11).
  7. Devuelve el `id` del movimiento.
  Toda la función corre en una transacción: un error en cualquier paso deshace el INSERT (NFR-04, AC-57).
- `limpiar_usuarios_prueba.sql`: `DELETE FROM auth.users WHERE is_anonymous = true AND raw_app_meta_data->>'es_prueba' = 'true'` (el cascade borra cuentas, categorías, movimientos y fallas simuladas).

**API contract**
- `POST /rest/v1/rpc/basp_agregar_movimiento` (supabase-js: `clienteSupabase.rpc('basp_agregar_movimiento', {...})`)
  - Request (JSON): `p_tipo` string (`'INGRESO'` | `'GASTO'`), `p_monto` string decimal con punto y hasta 2 decimales (ej. `"1500.50"`), `p_id_categoria` string uuid, `p_fecha` string `"AAAA-MM-DD"`.
  - Response 200: string uuid del movimiento creado.
  - Error codes: `BA400` (dato faltante o tipo inválido), `BA401` (sin sesión), `BA404` (usuario sin cuenta), `BA422` (monto inválido), `BA423` (fecha posterior a mañana en UTC), `BA424` (categoría ajena, inexistente o de otro tipo), `BA500` (falla simulada); PostgREST los devuelve como HTTP 400 con `code` igual al SQLSTATE. Sin JWT o con rol `anon`: HTTP 401/403 por falta de permiso de ejecución.
  - Auth: JWT de un usuario autenticado (rol `authenticated`); la cuenta sale de `auth.uid()`.
- `GET /rest/v1/bav_cuenta?select=id,nombre,moneda,saldo` — Response 200: arreglo con 0 o 1 objeto `{ id: uuid, nombre: string, moneda: string, saldo: string "N.NN" }`. Auth: `authenticated`; RLS filtra al propietario.
- `GET /rest/v1/bav_movimientos?select=id,fecha,tipo,monto,nombre_categoria,creado_en&order=fecha.desc,creado_en.desc,id.desc` con cabecera `Range: 0-49` y `Prefer: count=exact` — Response 200/206: arreglo de `{ id: uuid, fecha: "AAAA-MM-DD", tipo: string, monto: string "N.NN", nombre_categoria: string, creado_en: string }` y `Content-Range` con el total. Auth: `authenticated`; RLS filtra al propietario.
- `GET /rest/v1/bat_categorias?select=id,nombre,tipo,es_por_defecto&tipo=eq.GASTO` — Response 200: arreglo de categorías del propietario. Auth: `authenticated`.
- Cualquier `POST`, `PATCH` o `DELETE` directo sobre `bat_cuentas`, `bat_categorias` o `bat_movimientos`: HTTP 401/403 (sin permiso) — FR-49, FR-50.

**Input validation**
- `p_tipo`: text, obligatorio, valores permitidos `'INGRESO'`, `'GASTO'`.
- `p_monto`: numeric, obligatorio, `> 0`, `<= 999999999999.99`, como máximo 2 decimales, distinto de NaN/Infinity.
- `p_id_categoria`: uuid, obligatorio, de la cuenta del usuario y del mismo tipo.
- `p_fecha`: date (`AAAA-MM-DD`), obligatoria, `<= (now() AT TIME ZONE 'utc')::date + 1`, sin fecha mínima (FR-23).

**Error handling**
- E2-1 — Dato faltante o tipo inválido → `BA400`, sin escribir nada.
- E2-2 — Llamada sin sesión → `BA401` o rechazo por permisos.
- E2-3 — Usuario sin cuenta → `BA404`.
- E2-4 — Monto inválido (≤ 0, > máximo, 3 decimales, NaN) → `BA422`.
- E2-5 — Fecha posterior a mañana en UTC → `BA423`.
- E2-6 — Categoría ajena, inexistente o de otro tipo → `BA424`.
- E2-7 — Falla simulada entre el INSERT y el UPDATE → `BA500`, se deshace el INSERT.
- E2-8 — Escritura directa (INSERT/UPDATE/DELETE) en tablas, incluida otra cuenta propia o cambios de nombre, moneda o saldo → rechazo por permisos (42501).
- E2-9 — Lectura de datos de otro usuario → RLS devuelve 0 filas.
- E2-10 — Falla del trigger de registro → falla el registro completo (el usuario no se crea).

**Required tests**

`pruebas/registro.test.js`
- [ ] crea exactamente 1 cuenta "Mi Cuenta", USD, saldo "0.00" y exactamente 2 categorías ("Pago Realizado" GASTO y "Pago Ingresado" INGRESO, por defecto) para un usuario nuevo — validates AC-07.
- [ ] (error E2-8) rechaza crear una segunda cuenta para el mismo usuario desde la API y sigue habiendo 1 — validates AC-08.
- [ ] (error E2-8) rechaza renombrar, cambiar el tipo o eliminar "Pago Realizado" y "Pago Ingresado" desde la API — validates AC-09.
- [ ] (error E2-8) rechaza crear "Viajes", renombrar "Mercado" a "Otra" y eliminar "Mercado" desde la API — validates AC-68.
- [ ] (error E2-8) rechaza cambiar el nombre de la cuenta a "", la moneda a "ARS" y el saldo a 1000000; la cuenta sigue "Mi Cuenta", USD, "0.00" — validates AC-69.
- [ ] (error E2-10) `BATR_CREAR_CUENTA_USUARIO` está definido como AFTER INSERT FOR EACH ROW, no diferido, sobre `auth.users` (consulta a `pg_trigger` con service role), de modo que un error de `BATF_CREAR_CUENTA_USUARIO` aborta el registro; y ningún usuario de prueba creado en la corrida queda sin cuenta (`auth.users` LEFT JOIN `bat_cuentas`).

`pruebas/movimientos.test.js`
- [ ] un ingreso de 1000 sobre saldo 10000.00 deja "11000.00"; un gasto de 1500 deja "8500.00" — validates FR-09, FR-10 (base de AC-12, AC-13).
- [ ] un gasto de 2000 sobre saldo 1000.00 deja "-1000.00" — validates AC-27 (FR-11).
- [ ] (error E2-4) rechaza gastos con monto 0, -50, 1000000000000.00, 10.555 y 'NaN' y el saldo sigue en "10000.00" — validates AC-16.
- [ ] (error E2-6) rechaza un gasto con la categoría de ingresos "Sueldo" — validates AC-16.
- [ ] (error E2-1) rechaza un gasto sin monto, sin categoría, sin fecha y con tipo "OTRO" — validates AC-16.
- [ ] (error E2-5) rechaza un gasto con fecha dos días posterior a la fecha actual en UTC — validates AC-28.
- [ ] acepta un gasto de 100 con la fecha de mañana en UTC y la guarda igual — validates AC-29.
- [ ] acepta un gasto con fecha 1990-03-15 — validates FR-23 (base de AC-30).
- [ ] dos ingresos de 0.10 y 0.20 dejan "0.30" y las columnas `monto` y `saldo` son de tipo numeric (`information_schema.columns`) — validates AC-55.
- [ ] dos ingresos de 999999999999.99 dejan "1999999999999.98" — validates AC-56.
- [ ] (error E2-7) con la falla simulada activa, un gasto de 1000 sobre saldo 10000.00 devuelve `BA500`, no queda ningún movimiento nuevo y el saldo sigue "10000.00" — validates AC-57.
- [ ] una secuencia fija de 20 altas intercaladas de ingresos y gastos mantiene, después de cada alta, saldo = Σ ingresos − Σ gastos — validates AC-58.
- [ ] (error E2-3) un usuario cuya cuenta se borró con service role recibe `BA404`.
- [ ] (error E2-2) la llamada con la anon key y sin sesión es rechazada.
- [ ] `bav_movimientos` devuelve el orden fecha desc, creado_en desc, id desc — validates FR-34.
- [ ] `limpiar_usuarios_prueba.sql` borra un usuario de prueba con movimientos sin errores de FK.
- [ ] (error E2-8, R12) un usuario que se marca `es_prueba` en su propio `user_metadata` con `updateUser` no es borrado por `limpiar_usuarios_prueba.sql`, y no puede escribir su `app_metadata`.

`pruebas/seguridad.test.js`
- [ ] (error E2-9) A consulta `bav_cuenta`, `bat_categorias` y `bav_movimientos` filtrando por los id de B y recibe 0 filas en cada una — validates AC-51.
- [ ] (error E2-8) A intenta editar y eliminar la cuenta, una categoría y un movimiento de B; todo se rechaza y los datos de B quedan iguales — validates AC-52.
- [ ] (error E2-6) A intenta crear un movimiento con la categoría de B (en su cuenta) y un INSERT directo en la cuenta de B; ambos se rechazan y los saldos de A y B no cambian — validates AC-53.
- [ ] (error E2-8) A intenta `UPDATE` del saldo de su cuenta e `INSERT`/`UPDATE`/`DELETE` directos en `bat_movimientos`; todo se rechaza y saldo = Σ ingresos − Σ gastos — validates AC-54.
- [ ] (error E2-8) A no puede leer ni escribir `pruebas.bat_fallas_simuladas` ni ejecutar `batf_crear_cuenta_usuario`.

**Completion criterion**
La migración se aplica sin errores sobre un proyecto vacío, `npx vitest run --project supabase` pasa
todas las pruebas de `pruebas/` y el script de reversión deja la base sin ningún objeto `BA*`.

## Block 3 — Utilidades puras (montos, fechas, categorías, lista)

**Files**
- `src/utilidades/montos.js` (new) — funciones sobre cadenas, nunca `Number` ni `parseFloat`:
  - `FormatearMonto(textoApi)`: `"1500.5"`/`"1500.50"` → `"1.500,50"`; `"-1000.00"` → `"-1.000,00"`.
  - `FormatearMontoConSigno(textoApi, tipo)`: `"-1.500,00"` (GASTO) / `"+1.000,00"` (INGRESO).
  - `FormatearSaldo(textoApi, moneda)`: `"USD 10.000,00"`.
  - `ObtenerSignoSaldo(textoApi)`: `'positivo' | 'negativo' | 'cero'`.
  - `FiltrarEntradaMonto(textoCampo)`: conserva dígitos y la primera coma, como máximo 2 decimales, agrega separador de miles (`"1500000"` → `"1.500.000"`, `"1,5,0"` → `"1,50"`, `"$ 1.500,50"` → `"1.500,50"`, `"abc"` → `""`, `"-50"` → `"50"`, `"10,555"` → `"10,55"`).
  - `ConvertirMontoParaApi(textoCampo)`: `"1.500,50"` → `"1500.50"`.
  - `ValidarMonto(textoCampo)`: `{ valido: true }` o `{ valido: false, mensaje: 'El monto debe ser mayor a 0.' | 'El monto máximo es 999.999.999.999,99.' }`, comparando largo de la parte entera y dígitos, sin `Number`.
- `src/utilidades/fechas.js` (new) — `ObtenerFechaHoyLocal()` (`"AAAA-MM-DD"` con `getFullYear`/`getMonth`/`getDate`), `FormatearFecha("AAAA-MM-DD")` → `"DD/MM/AAAA"` por partición de la cadena, `ConvertirTextoAFecha("AAAA-MM-DD")` → `new Date(año, mes - 1, día)`, `ConvertirFechaATexto(fecha)` → `format(fecha, 'yyyy-MM-dd')` de date-fns. Prohibidos `toISOString()` y `new Date("AAAA-MM-DD")`.
- `src/utilidades/categorias.js` (new) — `OrdenarCategorias(lista)`: por defecto primero, luego `localeCompare(otro, 'es', { sensitivity: 'base' })`.
- `src/utilidades/listaMovimientos.js` (new) — `AgruparPorFecha(movimientosDeLaPagina)`: arreglo de `{ fecha, movimientos }` en el orden recibido; como se aplica a cada página por separado, cada página empieza con su encabezado (FR-47).
- `src/utilidades/montos.test.js`, `src/utilidades/fechas.test.js`, `src/utilidades/categorias.test.js`, `src/utilidades/listaMovimientos.test.js` (new).

**Logic**
Funciones puras sin dependencias de React ni de Supabase. Los montos llegan de la API como
`"N.NN"` (ADR-001) y salen a la API como `"N.NN"`.

**Input validation**
- `FiltrarEntradaMonto`: entrada string de cualquier largo (tecla o pegado); salida solo `[0-9.]` y como máximo una `,` seguida de hasta 2 dígitos; la parte entera se limita a 13 dígitos para no aceptar escritura absurda (el máximo válido tiene 12, así que el decimotercero dispara el mensaje de FR-25).
- `ValidarMonto`: entrada en formato de campo (`"1.500,50"`); vacío, `"0"`, `"0,00"` o `","` → monto inválido.

**Error handling**
- E3-1 — Monto vacío o igual a 0 → `ValidarMonto` devuelve "El monto debe ser mayor a 0.".
- E3-2 — Monto mayor al máximo → "El monto máximo es 999.999.999.999,99.".
- E3-3 — Texto pegado sin ningún carácter válido → `FiltrarEntradaMonto` devuelve el valor anterior sin cambios (el componente conserva lo que había, AC-66).
- E3-4 — Fecha con formato inválido en `FormatearFecha`/`ConvertirTextoAFecha` → lanzan `Error('Fecha inválida')` (no debería ocurrir: las fechas vienen de la base o del calendario).

**Required tests**
- [ ] `FormatearMonto` da "1.500,00", "520,50", "1.000,00", "999.999.999.999,99", "1.999.999.999.999,98" y "12.345.678.901.234.567,89" (más de 15 dígitos sin pérdida) — validates AC-38, AC-56 (formato).
- [ ] `FormatearMontoConSigno` da "-1.500,00" para GASTO y "+1.000,00" para INGRESO — validates FR-36.
- [ ] `FormatearSaldo("10000.00", "USD")` da "USD 10.000,00" y `"-1000.00"` da "USD -1.000,00" — validates AC-10, FR-07.
- [ ] `ObtenerSignoSaldo` da positivo, negativo y cero para "8500.00", "-1000.00" y "0.00" — validates FR-08 (base de AC-11).
- [ ] `FiltrarEntradaMonto`: "10,555" → "10,55" — validates AC-17.
- [ ] `FiltrarEntradaMonto`: "-50" → "50" y "abc50" → "50" — validates AC-18.
- [ ] `FiltrarEntradaMonto`: "1500000" → "1.500.000" y "1500,50" → "1.500,50" — validates AC-19.
- [ ] `FiltrarEntradaMonto`: "1,5,0" → "1,50" — validates AC-65.
- [ ] (error E3-3) `FiltrarEntradaMonto`: pegar "$ 1.500,50" en vacío → "1.500,50"; pegar "abc" sobre "1.500,50" → "1.500,50" — validates AC-66.
- [ ] `ConvertirMontoParaApi("1.500,50")` → "1500.50" y `("1.000")` → "1000.00".
- [ ] (error E3-1) `ValidarMonto` rechaza "", "0" y "0,00" con "El monto debe ser mayor a 0." — validates FR-24.
- [ ] (error E3-2) `ValidarMonto` rechaza "1.000.000.000.000,00" y acepta "999.999.999.999,99" — validates FR-25.
- [ ] `ObtenerFechaHoyLocal` con el reloj simulado en 2026-10-03T23:30-03:00 devuelve "2026-10-03" — validates FR-20 (base de AC-31).
- [ ] `FormatearFecha("2026-09-17")` → "17/09/2026" y `ConvertirTextoAFecha`/`ConvertirFechaATexto` ida y vuelta conservan el día con TZ UTC-3 y UTC+13.
- [ ] (error E3-4) `FormatearFecha("17/09/2026")` lanza "Fecha inválida".
- [ ] `OrdenarCategorias` con "Transporte", "café", "Mercado" y "Pago Realizado" da "Pago Realizado", "café", "Mercado", "Transporte" — validates AC-26 (orden).
- [ ] `AgruparPorFecha` sobre las filas 51–55 del ejemplo de AC-63 devuelve un primer grupo "2026-10-01" — validates AC-63 (agrupado), FR-35.

**Completion criterion**
`npx vitest run --project unitarias src/utilidades` pasa todas las pruebas y una búsqueda de
`toISOString`, `parseFloat`, `Number(` y `new Date("` en `src/utilidades/` no encuentra nada.

## Block 4 — Sesión anónima y mensajes

**Files**
- `src/sesion/sesionAnonima.js` (new) — única implementación del inicio provisorio: `IniciarSesion()` (devuelve la sesión actual de supabase-js si existe — FR-03 — o llama a `signInAnonymously()`), `ObtenerSesionActual()`. Devuelve `{ ok: true, sesion }` o `{ ok: false }`. Sin `es_prueba`.
- `src/sesion/ProveedorSesion.jsx` (new) — contexto de sesión; depende solo de `IniciarSesion`/`ObtenerSesionActual`. Mientras inicia muestra "Cargando…"; si falla renderiza `ErrorSesionAnonima`; con sesión renderiza los hijos.
- `src/sesion/ErrorSesionAnonima.jsx` (new) — muestra el error de FR-02 con `MensajeError` y "Aceptar" que llama a `alReintentar`. Provisorio: se reemplaza por RF-24 al incorporar Google.
- `src/mensajes/textos.js` (new) — todos los textos de mensajes: éxito ("Gasto registrado con éxito.", "Ingreso registrado con éxito."), validación ("El monto debe ser mayor a 0.", "El monto máximo es 999.999.999.999,99.") y errores ("No se pudo iniciar la sesión. Vuelva a intentarlo.", "No se pudieron cargar sus movimientos. Vuelva a intentarlo.", "No se pudo guardar el movimiento. Vuelva a intentarlo.").
- `src/mensajes/ProveedorMensajes.jsx` (new) — `MostrarExito(texto)` reemplaza el mensaje actual y reinicia el temporizador de 3 s; `MostrarError(texto, { alAceptar, elementoFoco })` muestra el error hasta "Aceptar" y devuelve el foco a `elementoFoco` (FR-44).
- `src/mensajes/MensajeExito.jsx` (new) — `role="status"`, ícono de tic verde con texto alternativo "Éxito", sin botón.
- `src/mensajes/MensajeError.jsx` (new) — `role="alertdialog"`, ícono de cruz roja con texto alternativo "Error", botón "Aceptar" con foco inicial.
- `src/App.jsx` (modified) — envuelve las rutas con `ProveedorSesion` y `ProveedorMensajes`.
- `src/sesion/ProveedorSesion.test.jsx`, `src/mensajes/ProveedorMensajes.test.jsx` (new).

**Logic**
El resto de la aplicación solo conoce `ProveedorSesion`; cambiar a Google OAuth (RF-22, RF-23)
reemplaza `sesionAnonima.js` y `ErrorSesionAnonima.jsx` sin tocar la lógica de movimientos.

**Error handling**
- E4-1 — Falla `signInAnonymously` (red, límite de Supabase, inicio anónimo desactivado) → "No se pudo iniciar la sesión. Vuelva a intentarlo." con "Aceptar"; no se renderiza la sección Cuenta.
- E4-2 — El reintento vuelve a fallar → se vuelve a mostrar el mismo mensaje.
- E4-3 — Llega un mensaje de éxito con otro en pantalla → reemplaza al anterior y reinicia los 3 s.

**Required tests**
- [ ] con `signInAnonymously` simulado con éxito, muestra los hijos (la sección Cuenta) sin pedir ninguna acción — validates AC-01.
- [ ] con una sesión existente no llama a `signInAnonymously` — validates FR-03.
- [ ] (error E4-1) con `signInAnonymously` simulado con error muestra "No se pudo iniciar la sesión. Vuelva a intentarlo.", el ícono de cruz con texto alternativo "Error" y "Aceptar", y no muestra los hijos — validates AC-02.
- [ ] "Aceptar" reintenta y, con éxito, muestra los hijos — validates AC-03.
- [ ] (error E4-2) si el reintento falla, el mensaje vuelve a mostrarse.
- [ ] `MostrarExito("Gasto registrado con éxito.")` muestra el texto con el ícono de tic (texto alternativo "Éxito"), sin "Aceptar", y lo cierra a los 3 s (timers simulados) — validates AC-45.
- [ ] (E4-3) un segundo `MostrarExito` a los 2 s reemplaza al primero y sigue visible a los 4 s, se cierra a los 5 s — validates AC-46 (reemplazo).
- [ ] `MostrarError` sigue visible a los 10 s y se cierra al presionar "Aceptar", y el foco vuelve al elemento indicado — validates AC-47, FR-44.

**Completion criterion**
`npx vitest run --project unitarias src/sesion src/mensajes` pasa todas las pruebas y
`sesionAnonima.js` es el único archivo de `src/` que llama a `signInAnonymously`.

## Block 5 — Sección Cuenta (encabezado, saldo, lista, paginación)

**Files**
- `src/servicios/cuenta.js` (new) — `ObtenerCuenta()` → `bav_cuenta`; devuelve `{ ok, cuenta }`.
- `src/servicios/movimientos.js` (new) — `ObtenerPaginaMovimientos(numeroPagina)` → `bav_movimientos` con `.order('fecha', { ascending: false }).order('creado_en', { ascending: false }).order('id', { ascending: false }).range(desde, hasta)` y `count: 'exact'`; devuelve `{ ok, movimientos, total }`.
- `src/paginas/SeccionCuenta.jsx` (new) — carga cuenta y página; botones "Añadir Gasto" y "Añadir Ingreso" (navegan a `/gasto/nuevo` y `/ingreso/nuevo`); sin flecha para volver atrás; error de carga con reintento (FR-45).
- `src/componentes/EncabezadoCuenta.jsx` (new) — "Mi Cuenta (USD)" y el saldo con clase `saldo-positivo` / `saldo-negativo` / `saldo-cero`.
- `src/componentes/ListaMovimientos.jsx` (new) — grupos con encabezado `DD/MM/AAAA` y filas "categoría — monto" (`monto-gasto` rojo, `monto-ingreso` verde); "Aquí verá sus movimientos." si el total es 0.
- `src/componentes/Paginacion.jsx` (new) — "Anterior", "Página X de Y", "Siguiente"; solo si el total es mayor a 50.
- `src/App.jsx` (modified) — ruta `/` → `SeccionCuenta`. Al volver de un alta exitosa se navega a `/` con el estado `{ pagina: 1 }`.
- `src/estilos.css` (modified) — clases de saldo, montos y lista responsive.
- `src/paginas/SeccionCuenta.test.jsx`, `src/componentes/ListaMovimientos.test.jsx`, `src/componentes/Paginacion.test.jsx` (new).

**Logic**
La página siempre pide 50 filas al servidor; nunca carga todos los movimientos. El estado de página
vive en `SeccionCuenta` (`const [numeroPagina, EstablecerNumeroPagina] = useState(1)`).

**Error handling**
- E5-1 — Falla `ObtenerCuenta` o `ObtenerPaginaMovimientos` → "No se pudieron cargar sus movimientos. Vuelva a intentarlo." con "Aceptar", que reintenta ambas cargas.
- E5-2 — `bav_cuenta` devuelve 0 filas (usuario sin cuenta) → mismo mensaje que E5-1.

**Required tests**
- [ ] con cuenta "Mi Cuenta"/USD/"0.00" y sin movimientos muestra "Mi Cuenta (USD)", "USD 0,00" y "Aquí verá sus movimientos." — validates AC-05, AC-40.
- [ ] con saldo "10000.00" muestra "USD 10.000,00" — validates AC-10.
- [ ] con saldos "8500.00", "-1000.00" y "0.00" aplica `saldo-positivo`, `saldo-negativo` y `saldo-cero` — validates AC-11.
- [ ] con los tres movimientos de AC-36 muestra el grupo "01/10/2026" (Café, luego Sueldo) y después "17/09/2026" (Mercado) — validates AC-36.
- [ ] la fila de un gasto de "1500.00" en Mercado del 2026-09-17 muestra el encabezado "17/09/2026", "Mercado" a la izquierda y "-1.500,00" a la derecha, sin el tipo — validates AC-37.
- [ ] muestra "-1.500,00", "+520,50" y "+1.000,00" sin código de moneda — validates AC-38.
- [ ] "-1.500,00" tiene `monto-gasto` y "+1.000,00" `monto-ingreso` — validates AC-39.
- [ ] con total 120 en la página 1 muestra 50 filas, "Página 1 de 3" y "Anterior" deshabilitado — validates AC-41.
- [ ] con total 120, dos "Siguiente" piden las páginas 2 y 3, muestran "Página 2 de 3" y "Página 3 de 3" con 20 filas y "Siguiente" deshabilitado — validates AC-42.
- [ ] con total 30 no muestra "Anterior", "Siguiente" ni el indicador — validates AC-43.
- [ ] con total 50 no muestra la paginación; con total 51 muestra "Página 1 de 2" y "Siguiente" habilitado — validates AC-64.
- [ ] la página 2 del ejemplo de AC-63 empieza con el encabezado "01/10/2026" — validates AC-63.
- [ ] la sección Cuenta no muestra la flecha para volver atrás — validates FR-32 (parte de AC-32).
- [ ] (error E5-1) con la carga simulada con error muestra "No se pudieron cargar sus movimientos. Vuelva a intentarlo." y, al presionar "Aceptar" con el servidor respondiendo, muestra saldo y lista — validates AC-48.
- [ ] (error E5-2) sin cuenta muestra el mismo mensaje de carga.
- [ ] `ObtenerPaginaMovimientos(2)` pide el rango 50–99 con el orden fecha, creado_en e id descendentes — validates FR-34, FR-39.

**Completion criterion**
`npx vitest run --project unitarias src/paginas/SeccionCuenta.test.jsx src/componentes` pasa todas
las pruebas y `npm run dev` muestra la sección Cuenta conectada al proyecto de Supabase.

## Block 6 — Formulario de alta

**Files**
- `src/servicios/categorias.js` (new) — `ObtenerCategorias(tipo)` → `bat_categorias` filtrado por tipo; devuelve `{ ok, categorias }` ordenadas con `OrdenarCategorias`.
- `src/servicios/movimientos.js` (modified) — `AgregarMovimiento({ tipo, monto, idCategoria, fecha })` → `rpc('basp_agregar_movimiento', { p_tipo, p_monto: ConvertirMontoParaApi(monto), p_id_categoria, p_fecha })`; devuelve `{ ok: true }` o `{ ok: false }` (nunca expone el error de Supabase).
- `src/paginas/FormularioMovimiento.jsx` (new) — prop `tipo` (`'GASTO' | 'INGRESO'`); título "Añadir Gasto" / "Añadir Ingreso"; campos "Monto", "Categoría", "Fecha"; botones "Guardar" y "Cancelar"; flecha para volver atrás; estado inicial limpio en cada montaje (FR-14); `ManejarEnvio` valida, deshabilita el formulario con "Guardando…", llama a `AgregarMovimiento`, muestra el éxito y navega a `/` en la página 1.
- `src/componentes/CampoMonto.jsx` (new) — `input type="text" inputMode="decimal"`; aplica `FiltrarEntradaMonto` en `onChange` y en `onPaste`.
- `src/componentes/SelectorCategoria.jsx` (new) — `select` con las categorías del tipo, siempre con una seleccionada (la por defecto al iniciar), sin opción vacía.
- `src/componentes/SelectorFecha.jsx` (new) — campo "Fecha" que muestra `DD/MM/AAAA` y abre react-day-picker con `locale={es}` (date-fns), `weekStartsOn={1}`, `mode="single"`, `required` (no se puede deseleccionar), `disabled={{ after: hoy }}` con `hoy = ConvertirTextoAFecha(ObtenerFechaHoyLocal())`; guarda la fecha como `"AAAA-MM-DD"` con `ConvertirFechaATexto`.
- `src/componentes/FlechaVolver.jsx` (new) — botón con ícono y `aria-label="Volver atrás"`, `alVolver`.
- `src/App.jsx` (modified) — rutas `/gasto/nuevo` y `/ingreso/nuevo` con `key` distinto por visita para que el formulario se monte limpio.
- `src/estilos.css` (modified) — estilos del formulario y del calendario.
- `src/paginas/FormularioMovimiento.test.jsx`, `src/componentes/CampoMonto.test.jsx`, `src/componentes/SelectorFecha.test.jsx` (new).

**Logic**
"Guardar" con 3 interacciones: "Añadir Gasto" → monto → "Guardar" (G-2), porque la categoría y la
fecha vienen preseleccionadas. Mientras `guardando` es verdadero, el formulario está en un
`fieldset disabled`, la flecha y "Cancelar" están deshabilitados, y un segundo envío se ignora
(FR-33).

**Input validation**
- Monto: string del campo, solo `[0-9.,]` (filtrado al escribir y al pegar), como máximo 2 decimales y 13 dígitos enteros; `ValidarMonto` antes de enviar (> 0 y ≤ 999.999.999.999,99).
- Categoría: uuid de una de las categorías del tipo cargadas; siempre una seleccionada.
- Fecha: `"AAAA-MM-DD"`, nunca posterior a hoy (fecha local); sin mínimo.

**Error handling**
- E6-1 — Monto vacío o 0 → "El monto debe ser mayor a 0." (FR-24); al "Aceptar", formulario abierto con los datos y foco en "Monto".
- E6-2 — Monto mayor al máximo → "El monto máximo es 999.999.999.999,99." (FR-25); mismo comportamiento.
- E6-3 — El servidor falla o rechaza el alta (incluidos `BA423` por fecha y `BA500` por falla simulada) → "No se pudo guardar el movimiento. Vuelva a intentarlo."; formulario abierto con los datos; lista y saldo sin cambios (FR-46).
- E6-4 — Falla la carga de categorías → "No se pudieron cargar sus movimientos. Vuelva a intentarlo." con "Aceptar" que reintenta; "Guardar" deshabilitado mientras no haya categorías.
- E6-5 — Doble clic en "Guardar" → el segundo se ignora (FR-33).

**Required tests**
- [ ] para un usuario nuevo, el selector de "Añadir Gasto" tiene solo "Pago Realizado" y el de "Añadir Ingreso" solo "Pago Ingresado" — validates AC-06.
- [ ] gasto de 1500 en "Mercado" con la fecha de hoy: llama a `AgregarMovimiento` con `"1500.00"`, muestra "Gasto registrado con éxito." y navega a Cuenta, que muestra "-1.500,00" bajo hoy y "USD 8.500,00" (servicios simulados) — validates AC-12.
- [ ] ingreso de 1000 en "Sueldo": "Ingreso registrado con éxito.", "+1.000,00" y "USD 11.000,00" — validates AC-13.
- [ ] (error E6-1) con "Mercado" y 01/10/2026, guardar con monto vacío y con 0 no llama a `AgregarMovimiento`, muestra "El monto debe ser mayor a 0." con la cruz y "Aceptar"; después de "Aceptar" el formulario conserva "Mercado" y 01/10/2026 y el foco está en "Monto" — validates AC-14.
- [ ] (error E6-2) 1.000.000.000.000,00 muestra "El monto máximo es 999.999.999.999,99." y no se envía; 999.999.999.999,99 se envía — validates AC-15.
- [ ] en el campo de monto: "10,555" → "10,55"; "-50" y "abc50" → "50"; "1500000" → "1.500.000"; "1500,50" → "1.500,50"; "1,5,0" → "1,50"; pegar "$ 1.500,50" → "1.500,50"; pegar "abc" sobre "1.500,50" → "1.500,50" — validates AC-17, AC-18, AC-19, AC-65, AC-66.
- [ ] "1500,50" con categoría y fecha por defecto envía `"1500.50"` y Cuenta muestra "-1.500,50" y "USD 8.499,50" — validates AC-20.
- [ ] en ambos formularios el calendario selecciona solo fecha, preselecciona hoy y los días posteriores están deshabilitados y no se pueden elegir — validates AC-21.
- [ ] con "Mercado" (gasto) y "Sueldo" (ingreso), el selector de "Añadir Gasto" muestra solo "Pago Realizado" y "Mercado", sin opción vacía — validates AC-22.
- [ ] "Añadir Gasto" preselecciona "Pago Realizado" y "Añadir Ingreso" "Pago Ingresado" — validates AC-23.
- [ ] el calendario no permite deseleccionar la fecha — validates AC-24.
- [ ] después de salir con la flecha, con "Cancelar" o guardando, "Añadir Ingreso" se abre con monto vacío, "Pago Ingresado" y hoy — validates AC-25.
- [ ] el selector muestra "Pago Realizado", "café", "Mercado", "Transporte" en ese orden — validates AC-26.
- [ ] gasto de 2000 con saldo 1000 se envía y Cuenta muestra "USD -1.000,00" — validates AC-27.
- [ ] elegir 15/03/1990 y monto 100 envía `"1990-03-15"` y Cuenta muestra el grupo "15/03/1990" y "USD 9.900,00" — validates AC-30.
- [ ] con 500, "Sueldo" y 01/10/2026, la flecha vuelve a Cuenta sin llamar a `AgregarMovimiento` y Cuenta no tiene flecha — validates AC-32.
- [ ] con 500, "Cancelar" cierra sin llamar a `AgregarMovimiento` — validates AC-33.
- [ ] ambos formularios muestran "Guardar" — validates AC-34.
- [ ] (error E6-5) dos clics seguidos en "Guardar" llaman una sola vez a `AgregarMovimiento`; durante el proceso el botón dice "Guardando…" deshabilitado y no se puede editar, cancelar ni volver — validates AC-35.
- [ ] con 120 movimientos y la página 2 abierta, un alta vuelve a Cuenta en la página 1 con "Página 1 de 3" y el gasto nuevo primero — validates AC-44, FR-42.
- [ ] con el mensaje de éxito en pantalla, "Añadir Gasto" → 500 → "Guardar" registra el segundo gasto en 3 interacciones y el mensaje nuevo reemplaza al anterior — validates AC-46.
- [ ] (error E6-3) con `AgregarMovimiento` simulado con error, muestra "No se pudo guardar el movimiento. Vuelva a intentarlo.", el formulario conserva "1.500", la categoría y la fecha, y Cuenta no cambia — validates AC-49.
- [ ] (error E6-3) con la respuesta `BA500` (falla simulada) muestra el mismo mensaje y conserva el formulario — validates AC-57 (interfaz).
- [ ] (error E6-4) con `ObtenerCategorias` simulado con error muestra "No se pudieron cargar sus movimientos. Vuelva a intentarlo." y "Guardar" deshabilitado.
- [ ] el 03/10/2026 el formulario muestra "Monto", "Categoría" y "Fecha", la fecha "03/10/2026" y el calendario de octubre de 2026 en español con la semana desde el lunes — validates AC-67, FR-48.
- [ ] con fallas simuladas en el inicio de sesión, la carga y el alta, ninguno de los textos mostrados contiene "error", "code", "PGRST", "BA4", "BA5", "Exception" ni trazas — validates AC-60.

**Completion criterion**
`npx vitest run --project unitarias` pasa todas las pruebas de `src/` y, con `npm run dev` contra el
proyecto de Supabase, se registra un gasto en 3 interacciones y el saldo y la lista se actualizan.

## Block 7 — Pruebas en navegador (Playwright + axe-core)

**Files**
- `pruebas-navegador/configuracionGlobal.js` (new) — `globalSetup`: crea con la service role un usuario de prueba con 5.000 movimientos y saldo consistente (insert masivo de movimientos + saldo calculado = Σ ingresos − Σ gastos), marca con `auth.admin.updateUserById(id, { app_metadata: { es_prueba: true } })` a los usuarios que crea la app, y guarda `storageState` para reutilizar sesiones.
- `pruebas-navegador/utilidades/fixtures.js` (new) — fixture `paginaConUsuario` (sesión reutilizada, marcada `es_prueba`) y ayudantes para cargar categorías y movimientos con service role.
- `pruebas-navegador/sesion.spec.js` (new) — persistencia de la sesión.
- `pruebas-navegador/zonaHoraria.spec.js` (new) — "hoy" local.
- `pruebas-navegador/rendimiento.spec.js` (new) — p95 del alta.
- `pruebas-navegador/accesibilidad.spec.js` (new) — teclado, foco, texto alternativo y axe.
- `pruebas-navegador/anchos.spec.js` (new) — viewports.
- `pruebas/configuracionGlobal.test.js` (new) — prueba en Vitest (proyecto `supabase`) de los errores E7-1 y E7-2 de los ayudantes de `configuracionGlobal.js` y `fixtures.js`.

**Logic**
Pruebas en Chromium real contra `npm run dev` y el proyecto de Supabase. El rendimiento se mide con
la CPU ralentizada 4× (CDP `Emulation.setCPUThrottlingRate`) y 100 mediciones.

**Error handling**
- E7-1 — Falta `SUPABASE_SERVICE_ROLE_KEY` en `.env.pruebas.local` → `configuracionGlobal.js` corta con "Falta SUPABASE_SERVICE_ROLE_KEY en .env.pruebas.local." antes de correr ninguna prueba.
- E7-2 — Supabase rechaza un inicio anónimo por el límite por hora → las pruebas reutilizan el `storageState`; si aun así no hay sesión, la prueba falla con "Límite de inicios anónimos de Supabase alcanzado; reintente más tarde." (no se reporta como falla de la app).

**Required tests**
- [ ] con un usuario con saldo USD 1.500,00 y 3 movimientos, cerrar el contexto persistente y abrirlo de nuevo muestra Cuenta con "USD 1.500,00" y los 3 movimientos, con el mismo `id` de usuario — validates AC-04.
- [ ] con `timezoneId: 'America/Argentina/Buenos_Aires'` y el reloj fijo en 2026-10-03 23:30 local, "Añadir Gasto" preselecciona 03/10/2026 y el gasto de 100 queda bajo "03/10/2026" — validates AC-31.
- [ ] 100 altas sobre la cuenta de 5.000 movimientos, con CPU 4×, desde el clic en "Guardar" hasta ver la lista y el saldo actualizados, tienen p95 < 2 s — validates AC-50.
- [ ] en 320, 768, 1280 y 1920 px se ve el saldo y la lista, se pagina y se registra un gasto y un ingreso, con `document.documentElement.scrollWidth <= innerWidth` — validates AC-59.
- [ ] solo con el teclado se registra un gasto y un ingreso (calendario, selector, paginación, mensajes), el elemento con foco tiene contorno visible en cada paso y los íconos de tic, cruz y flecha exponen "Éxito", "Error" y "Volver atrás" al árbol de accesibilidad — validates AC-61.
- [ ] axe-core sobre Cuenta (saldo positivo, negativo y cero; lista y paginación), "Añadir Gasto" y "Añadir Ingreso" con calendario y selector abiertos, y los mensajes de éxito y error no reporta violaciones de `color-contrast` ni de `non-text-contrast` — validates AC-62.
- [ ] (error E7-1) sin la clave, `configuracionGlobal.js` corta con el mensaje indicado (prueba del propio ayudante en Vitest: `pruebas/configuracionGlobal.test.js`).
- [ ] (error E7-2) con el inicio anónimo simulado con error 429 en el ayudante, la prueba informa "Límite de inicios anónimos de Supabase alcanzado; reintente más tarde.".

**Completion criterion**
`npm run test:navegador` pasa las 5 especificaciones con el proyecto de Supabase configurado y deja
marcados con `es_prueba` a todos los usuarios que creó, de modo que `limpiar_usuarios_prueba.sql`
los borra.

## Rollback

- La migración es aditiva (no modifica objetos existentes). Para revertir: ejecutar
  `supabase/scripts/revertir_cuentas_y_movimientos.sql`, que elimina en este orden: vistas
  `BAV_*`, función `BASP_AGREGAR_MOVIMIENTO`, trigger `BATR_CREAR_CUENTA_USUARIO` y su función,
  tablas `BAT_MOVIMIENTOS`, `BAT_CATEGORIAS`, `BAT_CUENTAS`, `pruebas.BAT_FALLAS_SIMULADAS` y el
  esquema `pruebas`. Los usuarios de `auth.users` no se tocan.
- El frontend se revierte con el revert del commit; no hay datos del lado del navegador salvo la
  sesión de supabase-js en `localStorage`.
- Indicadores para aplicarlo: la migración falla a mitad de camino, o las pruebas de
  `pruebas/seguridad.test.js` fallan en el proyecto real (permisos abiertos).

## Final verification

- `npm run lint`, `npm run build`, `npx vitest run` (proyectos `unitarias` y `supabase`) y
  `npm run test:navegador` pasan.
- Las 69 AC del PRD tienen al menos una prueba en verde (tabla de cobertura de esta spec y listas
  de pruebas de cada bloque).
- Ningún archivo de `src/` contiene `toISOString`, `parseFloat`, `Number(` aplicado a montos,
  `new Date("`, "egreso", `es_prueba`, la service role key, `dangerouslySetInnerHTML`, `innerHTML` ni
  `eval(` (mitigación R6).
- `sesionAnonima.js` es el único punto que llama a `signInAnonymously`.
- Desde la API con la anon key de un usuario autenticado no se puede escribir directamente en
  ninguna tabla `bat_*` (pruebas de Block 2).
- `limpiar_usuarios_prueba.sql` deja el proyecto sin usuarios `es_prueba`.
