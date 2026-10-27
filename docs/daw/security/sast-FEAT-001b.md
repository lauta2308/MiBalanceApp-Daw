# SAST — FEAT-001b: Edición de Movimientos

- **Fecha:** 2026-10-27
- **Fase:** CODE, cierre (5 bloques commiteados)
- **Alcance:** cambios de la rama respecto de `main` (`git diff main...HEAD`): migración
  `20261027000100_edicion_movimientos.sql` y su script de reversión, `src/servicios/`,
  `src/componentes/`, `src/paginas/`, `src/App.jsx`, `pruebas/` y `pruebas-navegador/`.
- **Resultado:** ✅ PASSED — 0 críticas, 0 altas, 0 medias. 1 hallazgo informativo documentado
  abajo.

## Secretos (F-SAST-01)

| Verificación | Resultado |
|---|---|
| `.env.local`, `.env.pruebas.local`, `pruebas-navegador/.sesiones/` y `supabase/.temp/` ignorados (`git check-ignore`) | ✅ |
| Ningún `.env*` versionado salvo `.env.example`, que solo tiene nombres de variables vacías | ✅ |
| Los valores de `SUPABASE_DB_PASSWORD` y `SUPABASE_SERVICE_ROLE_KEY` no aparecen en archivos versionados o por versionar ni en el historial de la rama (`git log main..HEAD -p`) | ✅ 0 coincidencias |
| Patrones de clave/token/JWT (`eyJ…`, `sk_…`), contraseñas literales y cadenas `postgres://usuario:clave@` en lo cambiado | ✅ 0 coincidencias |
| `ayudantesSupabase.js` recibe la clave de servicio como parámetro; no lee `process.env` ni la carga la app | ✅ |

## Inyección (F-SAST-02, F-SAST-03, F-SAST-05)

| Verificación | Resultado |
|---|---|
| SQL: `BASP_EDITAR_MOVIMIENTO` no usa SQL dinámico (`EXECUTE`/`format`); es `SECURITY DEFINER` con `SET search_path = ''` y nombres calificados | ✅ |
| SQL: la cuenta sale de `auth.uid()`, nunca de un parámetro; el movimiento se busca con `id = p_id_movimiento AND id_cuenta = v_id_cuenta`, y uno inexistente o ajeno dan el mismo `BA404` (threat R1) | ✅ |
| SQL: el cliente usa supabase-js (`.eq`, `.rpc` con parámetros); no arma consultas con texto | ✅ |
| Rutas/comandos: sin `child_process`, sin lecturas de archivos con datos del usuario | ✅ |

## XSS y funciones inseguras (F-SAST-06, F-SAST-04, F-SAST-17)

| Verificación | Resultado |
|---|---|
| Sin `dangerouslySetInnerHTML`/`innerHTML`/`document.write` en lo cambiado | ✅ |
| Sin `eval`/`new Function`/deserialización insegura | ✅ |
| El `idMovimiento` de la URL (`src/App.jsx:50`) solo llega a `ObtenerMovimiento`, que valida la forma UUID antes de consultar (`src/servicios/movimientos.js`, E3-1); React lo escapa si se muestra | ✅ |

## Resto de categorías

| Regla | Verificación | Resultado |
|---|---|---|
| F-SAST-07 | Sin solicitudes a URLs armadas con datos del usuario; la app solo habla con Supabase por supabase-js | ✅ |
| F-SAST-08 | Sin criptografía propia | ✅ |
| F-SAST-09 | Sin modo depuración ni trazas expuestas | ✅ |
| F-SAST-10 | Sin `console.*` en `src/`. Ver hallazgo informativo I-1 | ✅ |
| F-SAST-11 | Sin carga de archivos | ✅ N/A |
| F-SAST-12 | Sin cookies de sesión propias: el JWT va en la cabecera `Authorization` | ✅ |
| F-SAST-14 | `BASP_EDITAR_MOVIMIENTO` valida sesión, cuenta propia, obligatorios, tipo, NaN/Infinito, rango, decimales, fecha (RF-107), movimiento de la cuenta y categoría de la cuenta y del tipo nuevo (threat R4), antes de escribir. Solo cambia tipo, monto, categoría y fecha (threat R6) | ✅ |
| F-SAST-15 | `ObtenerMovimiento` y `EditarMovimiento` devuelven `{ ok: false }` sin el error de Supabase; la interfaz muestra textos fijos de `src/mensajes/textos.js` | ✅ |
| F-SAST-13/16 | `npm audit` (con y sin dependencias de desarrollo): `found 0 vulnerabilities` | ✅ |

## Permisos de la base (R7, threat model)

La migración revoca `EXECUTE` sobre `BASP_EDITAR_MOVIMIENTO` a `PUBLIC`, `anon`, `authenticated` y
`service_role`, y lo concede solo a `authenticated`. La vista `BAV_MOVIMIENTOS` conserva
`security_invoker = true`, así que sigue respetando la RLS de quien consulta (threat R2).

## Falsos positivos e informativos

| ID | Archivo | Categoría | Disposición | Revisó | Fecha | Justificación | Control compensatorio / revisar |
|---|---|---|---|---|---|---|---|
| I-1 | `pruebas-navegador/anchos.spec.js:197,254`, `pruebas-navegador/rendimiento.spec.js:49` | F-SAST-10 | Informativo, no bloquea | Claude (daw-security-sast) | 2026-10-27 | Los `console.log` imprimen solo medidas (px, ms); no incluyen tokens, claves ni datos personales. Son pruebas, no código de la app. Continúa I-1 de FEAT-001a | Revisar si cambian los resúmenes; revisar en el próximo SAST |
