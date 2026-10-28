# Verificación — FEAT-001c: Eliminación de Movimientos

## Ronda 1 — 2026-10-28 — PASSED

- **Rama:** `feat/FEAT-001c-eliminacion-movimientos` (d82dcda..71b3aa6)
- **PRD:** `docs/daw/prd/prd-FEAT-001c.md` · **Spec:** `docs/daw/specs/spec-FEAT-001c.md` ·
  **Threat model:** `docs/daw/security/threat-FEAT-001c.md` · **SAST:**
  `docs/daw/security/sast-FEAT-001c.md`
- **Verificación cruzada:** agente `daw-module-verifier`, que no escribió el código.
- **Resultado:** 0 FAIL, 6 WARNING.

### Pruebas y cobertura

| Suite | Resultado |
|---|---|
| Vitest `src/` + `pruebas/` (Supabase) | 31 archivos, 391 pruebas ✅ |
| Vitest `src/`, 8 corridas seguidas para medir W-1 | 8/8 con 326/326 ✅ |
| Playwright + axe-core | 30/30 ✅ (AC-09 eliminaciones p95 964 ms, AC-22 ediciones p95 961 ms, AC-50 altas p95 1805 ms; AC-13, AC-14 ×4, AC-15, AC-28 ×4, AC-59 ×4, AC-62) |
| ESLint | sin errores ✅ |
| Build | compila ✅ |
| `npm audit` | 0 vulnerabilidades ✅ |

Cobertura del código de `src/` cambiado en la rama, con `@vitest/coverage-v8` instalado con
`--no-save` y `--testTimeout=30000`:

| Archivo | Líneas | Ramas | Funciones |
|---|---|---|---|
| `ConfirmacionEliminarMovimiento.jsx` | 100 % | 100 % | 100 % |
| `ListaMovimientos.jsx` | 100 % | 100 % | 100 % |
| `MenuMovimiento.jsx` | 100 % | 94,73 % | 100 % |
| `SeccionCuenta.jsx` | 100 % | 96 % | 100 % |
| `textos.js` | 100 % | 100 % | 100 % |
| `servicios/movimientos.js` | 100 % | 100 % | 100 % |

Todo `src/`: líneas 99,2 %, ramas 96,03 %, funciones 100 %. El SQL no se instrumenta:
`BASP_ELIMINAR_MOVIMIENTO` queda cubierta por `pruebas/eliminacion.test.js` y
`pruebas/seguridad.test.js`.

### Reglas §5

| Regla | Resultado |
|---|---|
| F-VER-01 Cada AC tiene una prueba que pasa | ✅ 16/16 (AC-01 a AC-16); ⚠️ W-1, W-2, W-3 |
| F-VER-02 Tareas de la spec implementadas | ✅ 4/4 bloques (4 + 5 + 10 + 3 tareas) |
| F-VER-03 Cobertura ≥ 80 % | ✅ ver tabla |
| F-VER-04 Sad paths | ✅ `EliminarMovimiento` (ids mal formados, BA500, BA404, sin `data`, red, falla de `ObtenerCliente`); `BASP_ELIMINAR_MOVIMIENTO` (BA400, BA404 ajeno e inexistente, sin sesión 42501/BA401, BA500, `anon`/`service_role` sin EXECUTE); `ConfirmacionEliminarMovimiento` (Escape/Tab mientras elimina, mousedown en fondo, texto y "Cancelar" deshabilitado); `SeccionCuenta` (doble clic y doble Enter, rechazo y reintento, falla de la recarga, desmontaje con éxito y con error) |
| F-VER-05 Lint | ✅ |
| F-VER-06 Pruebas listadas en la spec | ✅ 37/37 (Block 1: 10, Block 2: 5, Block 3: 15, Block 4: 7) |
| W-VER-01 Código muerto | ✅ sin hallazgos |
| W-VER-02 Lógica de negocio entre 80 y 90 % | ✅ no aplica (toda por encima de 90 %) |
| W-VER-03 Pruebas frágiles | ⚠️ W-1, W-4, W-5 |

### Mitigaciones del threat model

| Riesgo | Implementado | Probado |
|---|---|---|
| R1 IDOR | Cuenta desde `auth.uid()`, filtro `id_cuenta`, mismo BA404 para ajeno e inexistente, UUID validado en el servicio | ✅ E1-2, E2-1 |
| R2 EXECUTE por defecto | REVOKE a los 4 roles + GRANT a `authenticated` | ✅ `seguridad.test.js` E1-6 |
| R3 Atomicidad y concurrencia | `FOR UPDATE` de la cuenta y luego del movimiento, una sola función | ✅ E1-4 (falla simulada), AC-12 (secuencia). La doble eliminación concurrente no tiene prueba propia (ver W-6) |
| R4 DELETE/UPDATE directos | Sin cambios de permisos | ✅ E1-5 |
| R5 Detalles internos | `{ ok: false }` y textos fijos | ✅ servicio y E3-1 (no aparece "BA500" ni "falla simulada") |
| R6 Eliminación accidental o doble | Foco inicial en "Cancelar", ref de bloqueo | ✅ AC-02, AC-05 |
| R7, R8 | De diseño | No aplica |
| R9 XSS | Textos fijos, `react/no-danger` en error | ✅ por inspección y SAST |
| R10 Esquema `pruebas` | Sin acceso desde la API (desde FEAT-001a) | ✅ `seguridad.test.js` |
| R11 Orden de reversión | `BEGIN`/`COMMIT`, borrado previo de las filas del punto, encabezado con el orden | Por lectura (ver W-6) |

### WARNING

- **W-1 (W-VER-03):** `src/paginas/SeccionCuenta.test.jsx:882` (E3-1, AC-08/AC-11) falló 1 vez en
  13 corridas, solo con la suite completa en paralelo: tras "Aceptar", el foco no estaba en la
  fila (línea 904). Pasó en las otras 12 (4 del verificador, 9 de esta ronda). Leyendo
  `ManejarConfirmarEliminacion` y `ManejarAceptarError` no se encontró la causa; la hipótesis es
  que el botón de la fila guardado deja de estar conectado (la lista se vuelve a montar) bajo
  carga, y entonces `isConnected` impide devolver el foco. La prueba del navegador de AC-13 recorre
  solo el camino feliz. El usuario decidió aceptarlo como WARNING (2026-10-28) e investigarlo en un
  ticket aparte.
- **W-2 (leve):** AC-16 se prueba por API (E1-5: el UPDATE directo da 42501 y el saldo queda en
  13000.00). Ninguna prueba de interfaz comprueba que la pantalla siga mostrando "USD 13.000,00".
  La spec solo pedía la versión por API.
- **W-3 (leve):** la prueba de interfaz de E3-1 usa el ingreso de 1.000 con saldo 5.000, no el
  gasto de 3.000 con saldo 10.000 que fija AC-11. Esos valores exactos están en la prueba por API
  (E1-4); entre las dos el comportamiento queda cubierto.
- **W-4 (W-VER-03):** `pruebas-navegador/rendimiento.spec.js` (AC-09) arranca del estado que dejan
  las altas y ediciones anteriores del mismo archivo. Es a propósito (lee el saldo real), pero
  depende del orden. Continúa W-3 de FEAT-001b.
- **W-5 (W-VER-03, leve):** el servidor simulado de `SeccionCuenta.test.jsx` (`ConfigurarServidor`)
  calcula los saldos con `Number`. Es solo de prueba y redondea a centavos.
- **W-6:** la doble eliminación concurrente (R3) y el script
  `supabase/scripts/revertir_eliminacion_movimientos.sql` (R11) no tienen prueba automática. El
  script se revisó leyéndolo.

### Observaciones que no bloquean

- **Evidencia TDD:** el verificador la pidió, pero no es una regla de §5. Se revisaba en CODE,
  sobre el informe del implementador de cada bloque. Esos informes no se guardan en el repo.
- **Verificación final de la spec ("0 resultados" de `dangerouslySetInnerHTML` en `src/`):** el
  grep encuentra `src/pruebas/reglasLint.test.js:9`, que es la prueba intencional de la regla
  `react/no-danger`. No hay usos en el código de la app.
- **Comportamientos aceptados en CODE:**
  - Tab en el menú de la fila lo cierra y deja seguir al foco: las opciones tienen `tabIndex=-1`
    (patrón APG).
  - "Cancelar" deshabilitado lleva `pointer-events: none`, porque Chrome no manda `mousedown` a
    botones deshabilitados y el foco se perdería. Como consecuencia, no muestra el cursor
    `not-allowed`.
  - Durante la recarga posterior a una eliminación exitosa, la fila borrada sigue visible un
    instante, hasta que llega la página 1 (W-3 de la spec).
  - La guardia `montado` de `SeccionCuenta` no se puede distinguir en las pruebas con React 19.
- **AC-59 de FEAT-001a (320 px),** que había fallado una vez de forma intermitente, pasó en esta
  ronda.
- **Pendientes para un ticket propio:**
  - Extraer un hook `useEliminacionMovimiento`.
  - Aplicar en `MensajeError` el mismo arreglo del `mousedown` sobre el fondo.
  - Resolver el foco tras "Aceptar" cuando la sección ya se desmontó.
  - Investigar W-1.
  - La lista de Cuenta se rompe ante un monto con formato inesperado (pendiente de FEAT-001b).
