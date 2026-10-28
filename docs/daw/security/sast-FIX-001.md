# SAST — FIX-001: Pendientes de FEAT-001

- **Fecha:** 2026-10-28
- **Fase:** CODE, cierre (5 commits de código: f7748eb, 2a27e9f, bcac4b8, 1f953c5, 58f83be)
- **Alcance:** cambios de la rama respecto de `main` (`git diff main...HEAD`, 30 archivos):
  `src/utilidades/` (montos, fechas, foco), `src/servicios/` (cuenta, movimientos),
  `src/mensajes/` (ProveedorMensajes, MensajeError), `src/componentes/` (confirmación de
  eliminación, menú de la fila), `src/paginas/` (SeccionCuenta, FormularioMovimiento,
  useEliminacionMovimiento), `src/pruebas/antesDeEfectosPasivos.jsx`, sus pruebas y
  `pruebas-navegador/accesibilidad.spec.js`. Sin migraciones ni SQL.
- **Resultado:** ✅ PASSED — 0 críticas, 0 altas, 0 medias. 2 hallazgos informativos documentados
  abajo.

## Secretos (F-SAST-01)

| Verificación | Resultado |
|---|---|
| `.env.local` y `.env.pruebas.local` ignorados (`git check-ignore`, `.gitignore:23`) | ✅ |
| Ningún `.env*` versionado salvo `.env.example` | ✅ |
| Los valores de `SUPABASE_DB_PASSWORD` y `SUPABASE_SERVICE_ROLE_KEY` no aparecen en el historial de la rama (`git log main..HEAD -p`) | ✅ 0 coincidencias |
| Patrones de JWT (`eyJ…`), `sk_…` y `postgres://usuario:clave@` en el historial de la rama | ✅ 0 coincidencias |

## Inyección (F-SAST-02, F-SAST-03, F-SAST-05)

| Verificación | Resultado |
|---|---|
| SQL: el fix no agrega SQL ni funciones; los servicios siguen usando supabase-js (`.from`, `.range`, `.rpc` con parámetros) | ✅ |
| `ObtenerPaginaMovimientos` valida que la página sea un entero ≥ 1 antes de armar el rango (`src/servicios/movimientos.js`) | ✅ |
| Selectores del DOM: `ObtenerPrimerControlEnfocable` usa un selector constante; ningún dato del usuario ni de la base entra en un selector | ✅ |
| Rutas/comandos: sin `child_process` ni lecturas de archivos | ✅ |

## XSS y funciones inseguras (F-SAST-06, F-SAST-04, F-SAST-17)

| Verificación | Resultado |
|---|---|
| Sin `dangerouslySetInnerHTML`, `innerHTML` ni `document.write` en el código de la app. Ver I-2 (pruebas) | ✅ |
| Sin `eval`/`new Function`/deserialización insegura | ✅ |
| Los mensajes ante datos inválidos son textos fijos de `src/mensajes/textos.js`; el dato rechazado nunca se muestra | ✅ |

## Resto de categorías

| Regla | Verificación | Resultado |
|---|---|---|
| F-SAST-07 | Sin solicitudes a URLs armadas con datos | ✅ |
| F-SAST-08 | Sin criptografía | ✅ N/A |
| F-SAST-09 | Sin modo depuración ni trazas expuestas | ✅ |
| F-SAST-10 | Sin `console.*` en `src/`. Ver I-1 | ✅ |
| F-SAST-11 | Sin carga de archivos | ✅ N/A |
| F-SAST-12 | Sin cookies de sesión propias: el JWT va en la cabecera `Authorization` | ✅ |
| F-SAST-14 | Mejora: `EsMontoApiValido`, `EsFechaValida` y `EsMovimientoValido` validan la forma de los datos de la API antes de dibujarlos; la página se valida antes de consultar | ✅ |
| F-SAST-15 | `ObtenerCuenta`, `ObtenerPaginaMovimientos` y `ObtenerMovimiento` devuelven `{ ok: false }` sin el error ni el dato | ✅ |
| F-SAST-13/16 | `npm audit` (con y sin dependencias de desarrollo): `found 0 vulnerabilities` | ✅ |

## Falsos positivos e informativos

| ID | Archivo | Categoría | Disposición | Revisó | Fecha | Justificación | Control compensatorio / revisar |
|---|---|---|---|---|---|---|---|
| I-1 | `pruebas-navegador/anchos.spec.js`, `pruebas-navegador/rendimiento.spec.js` | F-SAST-10 | Informativo, no bloquea | Claude (daw-security-sast) | 2026-10-28 | Los `console.log` existentes imprimen solo medidas (px, ms); este fix no agrega ninguno. Continúa I-1 de FEAT-001a/b/c | Revisar en el próximo SAST |
| I-2 | `src/utilidades/foco.test.js:6,13` | F-SAST-06 | Falso positivo, no bloquea | Claude (daw-security-sast) | 2026-10-28 | `innerHTML` arma fixtures constantes escritos en la propia prueba (botones e inputs) y limpia el DOM de jsdom entre pruebas; no hay datos del usuario ni de la base, y no es código de la app | Si la prueba empezara a usar datos externos, reemplazar por `createElement`; revisar en el próximo SAST |
