# SAST — FEAT-001a: Cuenta, Saldo, Alta y Lista de Movimientos

- **Fecha:** 2026-10-26
- **Fase:** CODE, cierre (bloque 7/7)
- **Alcance:** `src/`, `supabase/` (migración y scripts), `pruebas/`, `pruebas-navegador/`,
  `playwright.config.js`, `vite.config.js`, `.gitignore`, `.env.example`; archivos versionados y por
  versionar (`git ls-files -co --exclude-standard`).
- **Resultado:** ✅ PASSED — 0 críticas, 0 altas, 0 medias. 2 falsos positivos y 1 hallazgo
  informativo documentados abajo.

## Secretos (F-SAST-01)

| Verificación | Resultado |
|---|---|
| `.env` y `.env*.local` en `.gitignore` (`git check-ignore` confirma `.env.local` y `.env.pruebas.local`) | ✅ |
| Ningún `.env*` versionado salvo `.env.example`, que solo tiene nombres de variables vacías | ✅ |
| El valor de `SUPABASE_DB_PASSWORD` no aparece en ningún archivo versionado o por versionar, ni en el historial de git (`git log --all -p`) | ✅ 0 coincidencias |
| El valor de `SUPABASE_SERVICE_ROLE_KEY` no aparece en ningún archivo versionado o por versionar, ni en el historial de git | ✅ 0 coincidencias |
| `pruebas-navegador/.sesiones/` (estados de sesión con tokens) y `supabase/.temp/` (URL del pooler) ignorados | ✅ |
| Patrones de clave/token/JWT (`eyJ…`), `sb_secret_` y cadenas `postgres://usuario:clave@` | ✅ sin secretos reales (ver falsos positivos) |

## Inyección (F-SAST-02, F-SAST-03, F-SAST-05)

| Verificación | Resultado |
|---|---|
| SQL: la migración no usa SQL dinámico (`EXECUTE`/`format`). `BASP_AGREGAR_MOVIMIENTO` y `BATF_CREAR_CUENTA_USUARIO` son `SECURITY DEFINER` con `SET search_path = ''` y nombres calificados | ✅ |
| SQL: las consultas `pg` de `pruebas/` no interpolan valores en el texto SQL (se pasan como parámetros) | ✅ |
| Comandos: sin `child_process`, `exec`/`spawn` del sistema. Los `.exec(` encontrados son `RegExp.prototype.exec` (`src/utilidades/fechas.js:12`, `src/utilidades/montos.js:45,71`, `pruebas-navegador/utilidades/fixtures.js:135,148`) | ✅ |
| Rutas: las lecturas de archivos de `pruebas/` y `pruebas-navegador/` usan rutas fijas del repo, sin datos del usuario | ✅ |

## XSS y funciones inseguras (F-SAST-06, F-SAST-04, F-SAST-17)

| Verificación | Resultado |
|---|---|
| Sin `dangerouslySetInnerHTML`/`innerHTML` en `src/`. La única aparición está en `src/pruebas/reglasLint.test.js:9`, que es la prueba de que ESLint lo marca como error (`react/no-danger`) | ✅ |
| Sin `eval`/`new Function`/deserialización insegura | ✅ |

## Resto de categorías

| Regla | Verificación | Resultado |
|---|---|---|
| F-SAST-07 | Sin solicitudes a URLs armadas con datos del usuario; la app solo habla con Supabase por supabase-js | ✅ |
| F-SAST-08 | Sin criptografía propia. La conexión directa de las pruebas usa TLS con `rejectUnauthorized: true` contra `supabase/certificados/prod-ca-2021.crt` (`pruebas/utilidades/clientesPrueba.js:170`) | ✅ |
| F-SAST-09 | Sin modo depuración ni trazas expuestas en la compilación de Vite | ✅ |
| F-SAST-10 | Sin `console.*` en `src/`. Ver hallazgo informativo I-1 | ✅ |
| F-SAST-11 | Sin carga de archivos | ✅ N/A |
| F-SAST-12 | Sin cookies de sesión propias: supabase-js manda el JWT en la cabecera `Authorization`, que no es vulnerable a CSRF | ✅ |
| F-SAST-14 | `BASP_AGREGAR_MOVIMIENTO` valida sesión, cuenta propia (nunca por parámetro), obligatorios, tipo, NaN/Infinito, rango, decimales, fecha (RF-107) y que la categoría sea de la cuenta y del tipo, antes de escribir | ✅ |
| F-SAST-15 | La interfaz no muestra `error.message`/`details`/`hint` de Supabase: los mensajes al usuario son textos fijos en español | ✅ |
| F-SAST-13/16 | `npm audit`: `found 0 vulnerabilities` | ✅ |

## Permisos de la base (R10, threat model)

`service_role` no tiene `EXECUTE` sobre `BATF_CREAR_CUENTA_USUARIO` ni `BASP_AGREGAR_MOVIMIENTO`:
la migración lo revoca explícitamente y `pruebas/seguridad.test.js` (R10) lo verifica contra la base
con `has_function_privilege`.

## Falsos positivos e informativos

| ID | Archivo | Categoría | Disposición | Revisó | Fecha | Justificación | Control compensatorio / revisar |
|---|---|---|---|---|---|---|---|
| FP-1 | `.claude/agents/daw-sec-auditor.md:121` | F-SAST-01 | Falso positivo | Claude (daw-security-sast) | 2026-10-26 | `JWT_SECRET = "dev-secret-key"` es un ejemplo en la documentación del agente auditor; no es una credencial | Ninguno necesario; revisar en el próximo SAST |
| FP-2 | `src/sesion/ProveedorSesion.test.jsx:18` | F-SAST-01 | Falso positivo | Claude (daw-security-sast) | 2026-10-26 | `access_token: 'token-de-prueba'` es un dato ficticio de una prueba unitaria con Supabase simulado | Ninguno necesario; revisar en el próximo SAST |
| I-1 | `pruebas-navegador/anchos.spec.js:184`, `pruebas-navegador/rendimiento.spec.js:93` | F-SAST-10 | Informativo, no bloquea | Claude (daw-security-sast) | 2026-10-26 | Los `console.log` imprimen solo medidas (px, ms); no incluyen tokens, claves ni datos personales. Son pruebas, no código de la app | Revisar si cambian los resúmenes; revisar en el próximo SAST |
