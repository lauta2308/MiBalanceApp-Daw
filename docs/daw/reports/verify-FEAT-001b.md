# Verificación — FEAT-001b: Edición de Movimientos

## Ronda 1 — 2026-10-27 — PASSED

- **Rama:** `feat/FEAT-001b-edicion-movimientos` (f201857..032392a)
- **PRD:** `docs/daw/prd/prd-FEAT-001b.md` · **Spec:** `docs/daw/specs/spec-FEAT-001b.md` ·
  **Threat model:** `docs/daw/security/threat-FEAT-001b.md`
- **Verificación cruzada:** agente `daw-module-verifier`, que no escribió el código.
- **Resultado:** 0 FAIL, 7 WARNING.

### Pruebas y cobertura

| Suite | Resultado |
|---|---|
| Vitest `unitarias` + `supabase` | 29 archivos, 339 pruebas ✅ (corrida del cierre de CODE) |
| Playwright + axe-core | 22/22 ✅ (AC-22 p95 985 ms, AC-50 p95 1057 ms, AC-27, AC-28 ×4, AC-29) |
| ESLint | sin errores ✅ |
| Build | compila ✅ |
| `npm audit` | 0 vulnerabilidades ✅ |

Cobertura del código de `src/` cambiado en la rama (`App.jsx`, `ListaMovimientos.jsx`,
`MenuMovimiento.jsx`, `SelectorTipo.jsx`, `textos.js`, `FormularioMovimiento.jsx`,
`SeccionCuenta.jsx`, `src/servicios/*.js`), con `@vitest/coverage-v8` instalado con `--no-save`
y `--testTimeout=30000`: **líneas 99,27 %, ramas 96,59 %, funciones 100 %**. El archivo más bajo
es `FormularioMovimiento.jsx` (97,77 / 93,61 / 100). El SQL no se instrumenta:
`BASP_EDITAR_MOVIMIENTO` queda cubierta por `pruebas/edicion.test.js` y `pruebas/seguridad.test.js`.

### Reglas §5

| Regla | Resultado |
|---|---|
| F-VER-01 Cada AC tiene una prueba que pasa | ✅ 33/33 (AC-01 a AC-33); ninguna prueba se limita a un código de estado |
| F-VER-02 Tareas de la spec implementadas | ✅ 5/5 bloques, con el desvío aceptado del Block 4 (abajo) |
| F-VER-03 Cobertura ≥ 80 % | ✅ 99,27 / 96,59 / 100 |
| F-VER-04 Sad paths | ✅ RPC, `ObtenerMovimiento`, `EditarMovimiento`, validaciones del formulario y `MenuMovimiento`; ⚠️ W-5, W-7 |
| F-VER-05 Lint | ✅ |
| F-VER-06 Pruebas listadas en la spec | ✅ 61/61 (Block 1: 4, Block 2: 15, Block 3: 8, Block 4: 28, Block 5: 6) |
| W-VER-01 Código muerto | ✅ sin hallazgos |
| W-VER-02 Lógica de negocio entre 80 y 90 % | ✅ no aplica (toda por encima de 90 %) |
| W-VER-03 Pruebas frágiles | ⚠️ W-2, W-3, W-4 |

### Mitigaciones del threat model

R1 a R8, R12 y R13 tienen prueba. R9 se verificó por inspección y SAST. R10 y R11 son mitigaciones
de diseño sin prueba. R3: la concurrencia se resuelve con `FOR UPDATE` y no tiene prueba propia
(el threat model no la promete). R14: ver W-6.

### Desvío del spec aceptado por el usuario

- **Block 4, clic afuera del menú de la fila.** El spec decía que el foco vuelve siempre a la
  fila. Se implementó que, si el clic cae sobre un control enfocable, el foco queda en ese control;
  en una zona no enfocable o deshabilitada vuelve a la fila. Motivo: quien hace clic en un botón
  quiere ir ahí, y devolver el foco a la fila lo obligaría a buscarlo de nuevo con el teclado.
  Aceptado por el usuario el 2026-10-27. Ver W-1: la variante del control enfocable no tiene una
  prueba que compruebe dónde queda el foco.

### WARNING

- **W-1:** el desvío del Block 4 no tiene prueba del foco sobre el control enfocable. La única
  prueba de navegador del clic afuera usa una zona no enfocable
  (`pruebas-navegador/accesibilidad.spec.js:310`), y la unitaria
  (`src/componentes/MenuMovimiento.test.jsx:98`) solo comprueba que el `mousedown` no se cancela y
  que se llama a `alCerrar`. Se recomienda agregar la prueba en FEAT-001c, que vuelve a tocar el
  menú de la fila.
- **W-2 (W-VER-03):** `pruebas-navegador/anchos.spec.js:203` (AC-28, 320 px) falló una vez porque
  "Cargando…" tardó más de 5 s mientras corría en paralelo con `rendimiento.spec.js`; pasó al
  reintentar y en la corrida del cierre. Mismo patrón que AC-59 de FEAT-001a.
- **W-3 (W-VER-03):** `pruebas-navegador/rendimiento.spec.js:115` (AC-22) arranca del estado que
  deja la prueba de AC-50 del mismo archivo. Lo tolera porque lee el saldo real, pero depende del
  orden.
- **W-4 (W-VER-03, leve):** `pruebas/edicion.test.js` comparte el usuario A y un `contexto` creado
  una sola vez. Cada prueba reinicia la cuenta con `ReiniciarCuenta`, así que no depende del orden,
  pero el archivo no puede correr sus pruebas en paralelo.
- **W-5 (F-VER-04, leve):** `SelectorTipo` no tiene prueba con `tipo` nulo, que es su estado
  mientras carga el formulario.
- **W-6:** `supabase/scripts/revertir_edicion_movimientos.sql` (R14) no tiene prueba automática.
  Revisado leyéndolo: `BEGIN`/`COMMIT`, borra antes las filas de `EDITAR_MOVIMIENTO`, recrea la
  vista con `security_invoker` y repite `REVOKE` + `GRANT`.
- **W-7 (leve):** no hay prueba en la base para `p_tipo` inválido (BA400) ni para un monto NaN en
  `BASP_EDITAR_MOVIMIENTO`. Las mismas validaciones del alta sí están probadas en FEAT-001a.

### Observaciones que no bloquean

- **Evidencia TDD:** el verificador la pidió, pero no es una regla de §5. Se revisaba en CODE,
  sobre el informe del implementador de cada bloque (`code.instructions.md`). Esos informes
  quedaron en la sesión anterior y no se guardan en el repo.
- **`/daw-validate-arch`:** su resultado al inicio de CODE no quedó registrado. Cada bloque pasó
  por `daw-arch-auditor`, y ESLint y el SAST del cierre dieron limpio.
- **AC-27:** la prueba de Playwright no usa la tecla Espacio; la cubre la prueba unitaria.
- **Cierre de CODE:** la primera corrida falló por el DNS de WSL (la resolución IPv6 tardaba
  10 s y vencía el `hookTimeout` de `pruebas/`). Se corrigió el entorno, no el código.
- **Pendiente para un ticket propio:** la lista de Cuenta se rompe si la base devuelve un monto
  con formato inesperado (`FormatearMontoConSigno` lanza y cae toda la sección). El formulario de
  edición ya lo trata como error de carga.
