# Verificación — FIX-001: Pendientes de FEAT-001

## Ronda 1 — 2026-10-28 — PASSED

- **Rama:** `fix/FIX-001-pendientes-feat-001` (6b55c74..243cf15)
- **RCA:** `docs/daw/specs/rca-FIX-001.md` · **Fix-plan:** `docs/daw/specs/fix-FIX-001.md` ·
  **PRD:** `docs/daw/prd/prd-FEAT-001a.md` (loops 5: FR-44, FR-45, AC-70, AC-71, AC-72) ·
  **Threat model:** `docs/daw/security/threat-FIX-001.md` · **SAST:** `docs/daw/security/sast-FIX-001.md`
- **Verificación cruzada:** agente `daw-module-verifier`, que no escribió el código.
- **Resultado:** 0 FAIL, 6 WARNING.

### Commits de código

| Punto del RCA | Pasos del plan | Commit |
|---|---|---|
| 1 y 6 · Datos con formato inesperado; página inválida | 1, 2, 3, 8 | f7748eb |
| 2 · Foco de reserva | 4 | 2a27e9f |
| 3 · Clic en el fondo de `MensajeError` | 5 | bcac4b8 |
| 4 · Foco inicial sin ventana (prueba inestable) | 6 | 1f953c5 |
| 5 · Refactor `useEliminacionMovimiento` | 7 | 58f83be |

### Pruebas y cobertura

| Suite | Resultado |
|---|---|
| Vitest `src/` + `pruebas/` (Supabase) | 32 archivos, 460 pruebas ✅ (cierre de CODE) |
| Vitest `src/`, corridas repetidas | 20 seguidas del implementador + 12 del verificador + 4 mías, todas 395/395 ✅ |
| Playwright + axe-core | 31 pruebas: 30 ✅ y AC-28 a 320 px falló 1 vez por carga en paralelo; corrida sola, 12/12 de `anchos.spec.js` ✅ (W-3). Rendimiento p95: eliminaciones 976 ms, ediciones 977 ms, altas < 2 s |
| ESLint | sin errores ✅ |
| Build | compila ✅ |
| `npm audit` | 0 vulnerabilidades ✅ |

Cobertura del código cambiado (`@vitest/coverage-v8` con `--no-save`, `--testTimeout=30000`): los
predicados, servicios, `foco.js`, `MensajeError.jsx` y `ConfirmacionEliminarMovimiento.jsx` al
100 %; `MenuMovimiento.jsx` 100/94,73/100; `SeccionCuenta.jsx` 100/96,77/100;
`useEliminacionMovimiento.js` 100/94,73/100; `FormularioMovimiento.jsx` 97,67/93,33/100;
`ProveedorMensajes.jsx` 96,92/88,88/100. Todo `src/`: **líneas 99,11 %, ramas 95,84 %, funciones
100 %**.

### Reglas §5

| Regla | Resultado |
|---|---|
| F-VER-01 Cada AC tiene una prueba que pasa | ✅ AC-70 (`SeccionCuenta.test.jsx:704`, `:731`), AC-71 (`SeccionCuenta.test.jsx:1081`), AC-72 (`MensajeError.test.jsx:61`, `accesibilidad.spec.js:478`) |
| F-VER-02 Pasos del plan implementados | ✅ 8/8, con los desvíos aprobados (abajo) |
| F-VER-03 Cobertura ≥ 80 % | ✅ 99,11 / 95,84 / 100 |
| F-VER-04 Sad paths | ✅ `EsMontoApiValido`, `EsFechaValida`, `EsMovimientoValido` (lista y `ObtenerMovimiento`), página inválida, `ObtenerPrimerControlEnfocable` |
| F-VER-05 Lint | ✅ |
| F-VER-06 Pruebas listadas en el plan | ✅ todas existen y pasan. El verificador corrió la suite actual contra cada commit anterior: fallan 57 sobre `main`, 17 sobre f7748eb, 9 sobre 2a27e9f y 7 sobre bcac4b8, es decir, cada regresión falla con el código previo a su commit |
| W-VER-01 Código muerto | ✅ (detalle menor en W-5) |
| W-VER-02 Lógica de negocio entre 80 y 90 % | ✅ no aplica |
| W-VER-03 Pruebas frágiles | ⚠️ W-1, W-3 |

### Regresiones contra el defecto original

| Defecto | Prueba de regresión | Falla sobre |
|---|---|---|
| 1 · Pantalla en blanco ante datos inválidos | `SeccionCuenta.test.jsx:704`, `:731`; `FormularioMovimiento.test.jsx:1439` | `main` |
| 2 · Foco en `<body>` sin elemento de origen | `SeccionCuenta.test.jsx:1081`; `ProveedorMensajes.test.jsx:318` | `main` / f7748eb |
| 3 · Clic en el fondo saca el foco | `MensajeError.test.jsx:61`; `accesibilidad.spec.js:478` (Chrome) | 2a27e9f |
| 4 · Prueba inestable E3-1 | `MensajeError.test.jsx:76`, `:91`; `ConfirmacionEliminarMovimiento.test.jsx:193`, `:208`, `:226`; `MenuMovimiento.test.jsx:191`, `:200` | bcac4b8 (con `useEffect`) |
| 6 · Página inválida consulta a Supabase | `movimientos.test.js:139-157` | `main` |

La hipótesis del punto 4 del RCA quedó **confirmada**: con `useEffect`, un clic que llega antes del
efecto diferido deja el foco en `<body>`. E3-1 (hoy `SeccionCuenta.test.jsx:966`) no falló en
ninguna de las 36 corridas posteriores.

### Mitigaciones del threat model

Las 4 están implementadas y probadas: predicados basados en las mismas expresiones que los
formateadores, con casos límite; mensaje fijo sin el dato rechazado; selector constante y caso "sin
controles" probado; suite de eliminación sin cambios como red del refactor.

### Desvíos del plan aceptados

- **(a) `excluir`:** se quitó el parámetro de `ObtenerPrimerControlEnfocable` y sus 2 pruebas. El
  foco se decide en un `useLayoutEffect` que corre con el mensaje ya desmontado, así que no había a
  quién excluir.
- **(b) Regresión 4 del proveedor:** `ProveedorMensajes.test.jsx:518` es una prueba de resguardo. Falla
  sobre f7748eb y pasa desde 2a27e9f, porque el retorno de foco del punto 2 ya cerraba la ventana en
  ese nivel. La regresión determinista está en las pruebas de cada componente.
- **(c) Reserva tras la navegación:** react-router 8 aplica la navegación en una transición, en un
  commit posterior al que cierra el error. El proveedor usa `useLocation` y vuelve a aplicar la
  reserva tras cerrar un error con `alAceptar`, si el foco quedó en `<body>`. Lo encontró
  `daw-arch-auditor` con una reproducción. Consecuencia: `ProveedorMensajes` necesita estar dentro de
  un Router, como ya lo está en `main.jsx` y en todos los arneses.

### WARNING

- **W-1 (W-VER-03):** `src/servicios/obtenerCliente.test.js:57` ("(error E1-1)", no tocado por este
  fix) falló 2 veces en unas 30 corridas de la suite. El verificador no la reprodujo en 22. Su
  hipótesis: tras `vi.resetModules()` y varias importaciones dinámicas, Vitest puede entregar el
  módulo real (lo documenta `obtenerCliente.js:7-9`). Con `.env.local` presente, la prueba haría
  pedidos reales a Supabase y podría superar los 5 s con carga o con el DNS de WSL. Sin confirmar.
  Pendiente para un ticket propio.
- **W-2 (plan de reversión):** desde HEAD, f7748eb, 1f953c5 y 58f83be se revierten limpios. 2a27e9f y
  bcac4b8 dan conflicto en sus pruebas, porque 1f953c5 agregó pruebas en el mismo lugar: hay que
  revertir antes 1f953c5. Además, revertir solo 2a27e9f hace fallar la guarda (b). Revertir el merge
  entero sale limpio. Se anota en el PR.
- **W-3 (W-VER-03):** `pruebas-navegador/anchos.spec.js:230` (AC-28, 320 px) falló 1 vez porque
  "Cargando…" tardó más de 5 s con `rendimiento.spec.js` en paralelo. Es el mismo patrón que W-2 de
  FEAT-001b y AC-59 de FEAT-001a, y es anterior a este fix.
- **W-4 (cobertura):** `ProveedorMensajes.jsx:109` (`alAceptar` que abre otro error en el mismo
  commit) no tiene prueba.
- **W-5 (menor):** en `ProveedorMensajes.jsx:35`, `cierreReciente.current = false` en la limpieza al
  desmontar no tiene efecto.
- **W-6 (plan de pruebas):** la prueba de AC-71 usa una pantalla "Añadir Gasto" simulada con la
  `FlechaVolver` real como primer control, en lugar del `FormularioMovimiento` completo. El plan lo
  permite. E4-4 sí se prueba con el formulario real (`FormularioMovimiento.test.jsx`).

### Observaciones que no bloquean

- **D5 de FEAT-001b:** al volver de la edición con un id que no corresponde a ninguna fila, Cuenta
  enfoca la primera fila. Es el comportamiento documentado; no se tocó.
- **Hallazgo del punto 1:** los formateadores siguen lanzando ante datos inválidos y no hay error
  boundary. Los servicios ahora los protegen; otra fuente de datos que no pase por ellos volvería a
  dejar la pantalla en blanco.
- **Foco intermedio:** al volver de la edición con movimientos, el foco pasa un instante por "Añadir
  Gasto" antes de que D5 lo lleve a la fila. Aceptado: nunca queda en `<body>`.
- **Fuera del ticket:** fecha mínima en el servidor (calendario desde 1900, FR-23 sin mínimo); queda
  para una feature aparte.
