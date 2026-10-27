# Verificación — FEAT-001a: Cuenta, Saldo, Alta y Lista de Movimientos

## Ronda 1 — 2026-10-26 — BLOCKED

- **Rama:** `feat/FEAT-001a-cuenta-alta-lista` (f41f0d2..2439d50)
- **PRD:** `docs/daw/prd/` (FEAT-001a) · **Spec:** `docs/daw/specs/spec-FEAT-001a.md`
- **Verificación cruzada:** agente `daw-module-verifier`, que no escribió el código.
- **Resultado:** 1 FAIL (F-VER-04), 5 WARNING.

### Pruebas y cobertura

| Suite | Resultado |
|---|---|
| Vitest `unitarias` (src/) | 18 archivos, 183 pruebas ✅ |
| Vitest `supabase` (pruebas/) | 4 archivos, 33 pruebas ✅ (corrida del cierre de CODE, 216/216 en total) |
| Playwright + axe-core | 14/14 ✅ (AC-04, AC-31, AC-50 p95 1463 ms, AC-59 ×4, AC-61, AC-62 ×7) |
| ESLint | sin errores ✅ |
| Build | compila ✅ |

Cobertura de `src/` sin archivos de prueba, con `@vitest/coverage-v8` instalado con `--no-save`
(no forma parte del proyecto): **líneas 98,38 %, ramas 94,29 %, funciones 100 %** (medición
propia; el verificador obtuvo 98,15 / 93,85 / 100). El SQL no se instrumenta: la migración queda
cubierta por las 33 pruebas de `pruebas/`.

Con cobertura activada y la máquina cargada, la primera prueba de
`src/componentes/ListaMovimientos.test.jsx` y de `src/paginas/SeccionCuenta.test.jsx` superó el
límite de 5 s (7,3 s y 11,8 s). Con `--testTimeout=30000` pasaron. Sin cobertura, la suite pasa
con el límite por defecto.

### Reglas §5

| Regla | Resultado |
|---|---|
| F-VER-01 Cada AC tiene una prueba que pasa | ✅ 69/69 (68 ✅, 1 ⚠️ AC-62) |
| F-VER-02 Tareas de la spec implementadas | ✅ 7/7 bloques |
| F-VER-03 Cobertura ≥ 80 % | ✅ 98,38 / 94,29 / 100 |
| F-VER-04 Sad paths | ❌ FAIL-1 |
| F-VER-05 Lint | ✅ |
| F-VER-06 Pruebas listadas en la spec | ✅ 107/107 |
| W-VER-01 Código muerto | ⚠️ W-1 |
| W-VER-02 Lógica de negocio entre 80 y 90 % | ⚠️ W-2 |
| W-VER-03 Pruebas frágiles | ⚠️ W-3, W-4 |

### FAIL-1 (F-VER-04): funciones de `src/utilidades/` sin prueba con entrada inválida

Confirmado contra las pruebas:

- `montos.js:ObtenerSignoSaldo`: la rama `throw new Error('Monto inválido')` no se ejecuta en
  ninguna prueba.
- `montos.js:FormatearSaldo`: solo se prueba con entradas válidas.
- `montos.js:ConvertirMontoParaApi`: solo se prueba con formatos válidos.
- `fechas.js:ConvertirFechaATexto`: falta el caso de un `Date` inválido.
- `categorias.js:OrdenarCategorias`: falta el caso de la lista vacía.

Además, la rama de tipo inválido de `FormatearMontoConSigno` (`montos.js:57`) no está cubierta.
No es un FAIL, porque la función ya tiene una prueba con monto inválido.

### WARNING

- **W-1 (W-VER-01):** `src/utilidades/montos.js:13` reexporta `mensajeMontoMayorACero` y
  `mensajeMontoMaximo`, y nadie los importa desde ahí. `useSesion`
  (`src/sesion/ProveedorSesion.jsx:59`) solo lo usa una prueba.
- **W-2 (W-VER-02):** `src/servicios/cuenta.js` tiene 88,88 % de líneas, porque falta probar la
  rama `catch` de `ObtenerCuenta` (línea 22).
- **W-3 (W-VER-03):** en `pruebas/registro.test.js`, las pruebas AC-07 y AC-09 exigen
  exactamente 2 categorías del usuario compartido, y la prueba AC-68 le agrega "Mercado"
  después. Las pruebas dependen del orden en que corren.
- **W-4 (W-VER-03):** `src/utilidades/montos.test.js:40` exige `duracion < 100` ms, y eso
  depende de la velocidad de la máquina.
- **W-5 (AC-62, prueba en parte superficial):** `AnalizarContraste` exige que `violations` esté
  vacío, pero los nodos `incomplete` de `color-contrast` solo se anotan.

### Desvíos aceptados por el usuario

- Bloque 6: "Guardando…" usa `aria-disabled` en lugar de `disabled` para no perder el foco
  (AC-35). El locale `es` se importa de `react-day-picker/locale` y no de `date-fns` (AC-67).
- Bloque 7 (AC-62): axe no tiene la regla non-text-contrast, así que el 3:1 del tic y la cruz se
  calcula a mano. El select nativo abierto no se puede analizar y se analiza con foco. En el
  mensaje de error, axe corre solo sobre `[role=alertdialog]`. El usuario de prueba de navegador
  se crea con `signInAnonymously`. Los 5.000 movimientos se recargan en cada corrida.
- Cierre de CODE: el `REVOKE EXECUTE` a `service_role` se agregó a la migración ya aplicada, sin
  revertirla. La base ya lo tenía revocado, y revertir borraba los datos de 2 usuarios reales.
  R10 (`pruebas/seguridad.test.js`) lo verifica.
- Bloque 2: `pruebas.BAT_FALLAS_SIMULADAS` se escribe por la conexión directa (ADR-003) y no con
  la service role.

### Observaciones que no bloquean

- **Evidencia TDD:** el verificador la pidió, pero no es una regla de §5. Se revisaba en CODE,
  sobre el informe del implementador de cada bloque (`code.instructions.md`). Esos informes
  quedaron en sesiones anteriores y no se guardan en el repo.
- **Ramas de `CampoMonto.jsx`:** tiene 62,5 % de ramas. No se ejercen los `??` de
  `clipboardData` ni de `selectionStart`/`selectionEnd`.
- **Datos malformados:** `ListaMovimientos`, `EncabezadoCuenta` y `SelectorFecha` lanzan una
  excepción si llega un dato malformado de la API, y no hay error boundary. Es poco probable por
  las restricciones de la base.
- **Fecha mínima del calendario:** `SelectorFecha.jsx` empieza el calendario el 01/01/1900. El
  servidor no tiene mínimo (FR-23).
- **AC-50:** se midió sobre `npm run dev`, no sobre el build.

### Próximo paso

Loop correctivo a CODE para FAIL-1, y después volver a VERIFY.

**Lo que pasó después (2026-10-27):** el usuario aprobó el loop correctivo y decidió corregir de W-1 a W-4 en la misma vuelta y aceptar W-5. Commit `0494f41`.

---

## Ronda 2 — 2026-10-27 — PASSED

- **Base:** HEAD `0494f41`, el commit del loop correctivo.
  - Solo agrega pruebas, salvo dos cambios: quita la reexportación sin uso de `montos.js` y agrega
    `EliminarCategoriaPrueba` en `pruebas/utilidades/clientesPrueba.js`.
  - Antes del commit, la revisión en CODE dio PASS en las dos etapas: `daw-module-verifier` y
    `daw-arch-auditor`.
  - Las 2 advertencias del auditor se corrigieron antes del commit: el simulador de
    `cuenta.test.js` ahora se puede encadenar, y el DELETE directo pasó a una función auxiliar.
- **Verificación cruzada:** `daw-module-verifier`, el mismo agente de la ronda 1.
- **Resultado:** 0 FAIL, 0 WARNING abiertos, 1 aceptado (W-5).

### Pruebas y cobertura

| Suite | Resultado |
|---|---|
| `npm test` (unitarias + Supabase) | 23 archivos, 223 pruebas ✅ |
| Vitest `unitarias` con cobertura | 19 archivos, 190 pruebas ✅ |
| Playwright + axe-core | 14/14 ✅ (ronda 1; en `src/` solo cambió la reexportación sin uso) |
| ESLint | sin errores ✅ |
| SAST | ronda 2 PASSED (`docs/daw/security/sast-FEAT-001a.md`) |

Cobertura de `src/`: **líneas 99,07 %, ramas 95,17 %, funciones 100 %**. `src/servicios/` y
`src/utilidades/` están al 100 %.

### Reglas §5

| Regla | Resultado |
|---|---|
| F-VER-01 Cada AC tiene una prueba que pasa | ✅ 69/69 |
| F-VER-02 Tareas de la spec implementadas | ✅ 7/7 bloques |
| F-VER-03 Cobertura ≥ 80 % | ✅ 99,07 / 95,17 / 100 |
| F-VER-04 Sad paths | ✅ FAIL-1 resuelto. Se repasaron `src/utilidades/`, `src/servicios/`, `src/sesion/` y los componentes que validan entrada, y no apareció ningún caso nuevo |
| F-VER-05 Lint | ✅ |
| F-VER-06 Pruebas listadas en la spec | ✅ 107/107 |
| W-VER-01 Código muerto | ✅ W-1 resuelto |
| W-VER-02 Lógica de negocio entre 80 y 90 % | ✅ W-2 resuelto (`cuenta.js` al 100 %) |
| W-VER-03 Pruebas frágiles | ✅ W-3 y W-4 resueltos |

### Estado de la ronda 1

- **FAIL-1:** resuelto. Se agregaron 7 pruebas de entrada inválida, y cada una se comprobó
  rompiendo el código a propósito; el verificador repitió 3 de esas mutaciones.
- **W-1:** resuelto. `useSesion` sigue exportado y solo lo usan pruebas, porque así se acordó el
  alcance.
- **W-2, W-3, W-4:** resueltos.
- **W-5:** aceptado por el usuario. Los nodos `incomplete` de axe en AC-62 se anotan, pero no se
  verifican.

### Observaciones que no bloquean

- **`ObtenerPaginaMovimientos`:** ninguna prueba la llama con una página 0 o negativa. Hoy no
  hace falta, porque `Paginacion` deshabilita "Anterior" en la página 1 y ningún llamador puede
  pasar ese valor.
- **W-4:** la medición de 2.000 dígitos dura microsegundos, así que la proporción puede variar un
  poco. El margen entre el crecimiento lineal (~10×) y el cuadrático (~100×) es amplio.
- **Datos malformados de la base:** siguen igual que en la ronda 1 (no hay error boundary).
