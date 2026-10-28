# SAST — FEAT-001c: Eliminación de Movimientos

- **Fecha:** 2026-10-28
- **Fase:** CODE, cierre (4 bloques commiteados, hasta 58898b5)
- **Alcance:** cambios de la rama respecto de `main` (`git diff main...HEAD`): migración
  `20261028000100_eliminacion_movimientos.sql` y su script de reversión, `src/servicios/`,
  `src/componentes/`, `src/paginas/`, `src/mensajes/`, `pruebas/` y `pruebas-navegador/`.
- **Resultado:** ✅ PASSED — 0 críticas, 0 altas, 0 medias. 1 hallazgo informativo documentado
  abajo.

## Secretos (F-SAST-01)

| Verificación | Resultado |
|---|---|
| `.env.local`, `.env.pruebas.local`, `pruebas-navegador/.sesiones/` y `supabase/.temp/` ignorados (`git check-ignore`) | ✅ |
| Ningún `.env*` versionado salvo `.env.example` | ✅ |
| Los valores de `SUPABASE_DB_PASSWORD` y `SUPABASE_SERVICE_ROLE_KEY` no aparecen en archivos versionados ni en el historial de la rama (`git log main..HEAD -p`) | ✅ 0 coincidencias |
| Patrones de clave/token/JWT (`eyJ…`, `sk_…`), contraseñas literales y cadenas `postgres://usuario:clave@` en el historial de la rama | ✅ 0 coincidencias |

## Inyección (F-SAST-02, F-SAST-03, F-SAST-05)

| Verificación | Resultado |
|---|---|
| SQL: `BASP_ELIMINAR_MOVIMIENTO` no usa SQL dinámico (`EXECUTE`/`format`); es `SECURITY DEFINER` con `SET search_path = ''` y nombres calificados | ✅ |
| SQL: la cuenta sale de `auth.uid()`, nunca de un parámetro; el movimiento se busca con `id = p_id_movimiento AND id_cuenta = v_id_cuenta` y uno inexistente o ajeno dan el mismo `BA404` (threat R1) | ✅ |
| SQL: el cliente llama `rpc('basp_eliminar_movimiento', { p_id_movimiento })` con parámetros; no arma consultas con texto | ✅ |
| Rutas/comandos: sin `child_process` ni lecturas de archivos con datos del usuario | ✅ |

## XSS y funciones inseguras (F-SAST-06, F-SAST-04, F-SAST-17)

| Verificación | Resultado |
|---|---|
| Sin `dangerouslySetInnerHTML`/`innerHTML`/`document.write` en lo cambiado | ✅ |
| Sin `eval`/`new Function`/deserialización insegura | ✅ |
| La confirmación muestra solo textos fijos de `src/mensajes/textos.js` | ✅ |

## Resto de categorías

| Regla | Verificación | Resultado |
|---|---|---|
| F-SAST-07 | Sin solicitudes a URLs armadas con datos del usuario | ✅ |
| F-SAST-08 | Sin criptografía propia | ✅ |
| F-SAST-09 | Sin modo depuración ni trazas expuestas | ✅ |
| F-SAST-10 | Sin `console.*` en `src/`. Ver hallazgo informativo I-1 | ✅ |
| F-SAST-11 | Sin carga de archivos | ✅ N/A |
| F-SAST-12 | Sin cookies de sesión propias: el JWT va en la cabecera `Authorization` | ✅ |
| F-SAST-14 | `EliminarMovimiento` (`src/servicios/movimientos.js`) valida que el id sea un UUID antes de llamar; `BASP_ELIMINAR_MOVIMIENTO` valida sesión, cuenta propia, id obligatorio y pertenencia del movimiento antes de borrar. El saldo se ajusta con el tipo y el monto leídos bajo bloqueo (threat R3) | ✅ |
| F-SAST-15 | `EliminarMovimiento` devuelve `{ ok: false }` sin el error de Supabase; la interfaz muestra `mensajeErrorEliminarMovimiento` | ✅ |
| F-SAST-13/16 | `npm audit` (con y sin dependencias de desarrollo): `found 0 vulnerabilities` | ✅ |

## Permisos de la base (threat R2, R4, R10)

La migración revoca `EXECUTE` sobre `BASP_ELIMINAR_MOVIMIENTO` a `PUBLIC`, `anon`, `authenticated` y
`service_role`, y lo concede solo a `authenticated`. Los permisos de las tablas no cambian:
`authenticated` sigue sin `DELETE` directo sobre `BAT_MOVIMIENTOS`. El esquema `pruebas` sigue
inaccesible para los roles de la API. La reversión no borra datos de usuarios.

## Falsos positivos e informativos

| ID | Archivo | Categoría | Disposición | Revisó | Fecha | Justificación | Control compensatorio / revisar |
|---|---|---|---|---|---|---|---|
| I-1 | `pruebas-navegador/anchos.spec.js:224,281,323`, `pruebas-navegador/rendimiento.spec.js:50` | F-SAST-10 | Informativo, no bloquea | Claude (daw-security-sast) | 2026-10-28 | Los `console.log` imprimen solo medidas (px, ms) y descripciones de la prueba; no incluyen tokens, claves ni datos personales. Son pruebas, no código de la app. Continúa I-1 de FEAT-001a/b; se suma la línea 323 (AC-14 de FEAT-001c) | Revisar si cambian los resúmenes; revisar en el próximo SAST |
