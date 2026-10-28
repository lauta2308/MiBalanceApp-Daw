# Threat model — FIX-001: Pendientes de FEAT-001

- **Fecha:** 2026-10-28
- **Diseño analizado:** `docs/daw/specs/fix-FIX-001.md` (pasos 1 a 8)
- **Resultado:** ✅ PASSED — 0 críticos, 0 altos, 1 medio mitigado, 3 bajos.

## Alcance

El fix no agrega endpoints, funciones SQL, permisos, migraciones ni dependencias. Cambia:

| Componente | Cambio | Superficie |
|---|---|---|
| `src/servicios/cuenta.js`, `src/servicios/movimientos.js` (`ObtenerCuenta`, `ObtenerPaginaMovimientos`, `ObtenerMovimiento`) | Validan la forma de los datos que devuelve Supabase y el número de página | Datos que cruzan desde la API hacia la interfaz |
| `src/utilidades/montos.js`, `src/utilidades/fechas.js` | Predicados `EsMontoApiValido`, `EsFechaValida` | Entrada no confiable (datos de la API) |
| `src/utilidades/foco.js` (nuevo), `src/mensajes/ProveedorMensajes.jsx` | Foco de reserva al cerrar un error | DOM local |
| `src/mensajes/MensajeError.jsx` (y `ErrorSesionAnonima`, que lo reutiliza), `ConfirmacionEliminarMovimiento.jsx`, `MenuMovimiento.jsx` | `mousedown` cancelado, foco inicial con `useLayoutEffect` | DOM local |
| `src/paginas/useEliminacionMovimiento.js` (nuevo), `SeccionCuenta.jsx` | Refactor de la eliminación, misma llamada `rpc('basp_eliminar_movimiento')` | Sin cambios de flujo |

## Fronteras de confianza

1. **Navegador ↔ API de Supabase (PostgREST/RPC).** Sin cambios: el JWT de la sesión, la RLS de
   las vistas y los permisos `EXECUTE` de las funciones siguen igual (threat models de FEAT-001a/b/c).
   Lo nuevo es que la interfaz deja de confiar en la **forma** de lo que responde la API: los
   servicios validan monto, saldo, tipo y fecha antes de entregarlos a los componentes.
2. **Servicios ↔ componentes de React.** Los componentes reciben solo datos validados o
   `{ ok: false }`. Los formateadores siguen lanzando ante datos inválidos, como contrato.
3. **Historial del navegador (Atrás) ↔ estado de la sección Cuenta.** El usuario puede desmontar
   Cuenta durante una operación; el foco de reserva y la guardia `montado` cubren ese cruce.

## STRIDE por componente

### Servicios con validación (`cuenta.js`, `movimientos.js`)

| Cat. | Análisis |
|---|---|
| S | Sin cambios: la identidad sale del JWT de Supabase Auth; los servicios no reciben ids de usuario. |
| T | Un dato manipulado en la base (por ejemplo, por un `service_role` o una migración errónea) ya no rompe la pantalla: se rechaza la página entera (T-1). La validación es de forma, no de integridad: no reemplaza la RLS ni las funciones `BASP_`. |
| R | Sin cambios (no hay escrituras nuevas). |
| I | Al rechazar, se muestra `mensajeErrorCargaMovimientos` (texto fijo de `textos.js`), nunca el dato ni el error de Supabase (NFR-06). |
| D | Una sola fila malformada deja la sección sin lista hasta que se corrija el dato (D-1). |
| E | Sin cambios: no se agregan permisos ni funciones. |

### Foco y diálogos (`ProveedorMensajes`, `foco.js`, `MensajeError`, confirmación, menú)

| Cat. | Análisis |
|---|---|
| S | El clic cancelado en el fondo impide que un clic "atraviese" el modal hacia controles de la pantalla de atrás (S-1, mejora). |
| T | `ObtenerPrimerControlEnfocable` solo lee el DOM propio; no inserta HTML ni usa datos del usuario en selectores (el selector es una constante). |
| R | No aplica. |
| I | No expone datos. |
| D | Si no hay ningún control enfocable, no lanza (D-2). |
| E | No aplica: el foco no da privilegios; las acciones siguen pasando por los mismos manejadores. |

### Refactor `useEliminacionMovimiento`

| Cat. | Análisis |
|---|---|
| S, E | Sin cambios: misma RPC, mismo id validado como UUID en `EliminarMovimiento` (R1 de FEAT-001c). |
| T | El bloqueo del doble envío (`eliminacionEnCurso`) se mueve tal cual; si se perdiera, habría dos llamadas, pero la segunda da BA404 en la base (R3 de FEAT-001c) (T-2). |
| R, I, D | Sin cambios. |

## Datos sensibles

| Dato | Clasificación | Tratamiento |
|---|---|---|
| Montos, saldo, fechas y categorías del usuario | Financiero personal | Sin cambios: viajan por HTTPS (TLS de Supabase) y en reposo en PostgreSQL de Supabase (cifrado del proveedor). El fix no los registra, no los muestra en mensajes y no los copia a otro lugar. |
| JWT de la sesión anónima | Credencial | Sin cambios: lo maneja supabase-js; el fix no lo lee. |

No se agregan PII ni credenciales nuevas.

## Riesgos

| ID | Riesgo | STRIDE | Prob. | Impacto | Mitigación |
|---|---|---|---|---|---|
| T-1 | Un predicado más laxo de lo necesario deja pasar un dato que hace lanzar a un formateador (pantalla en blanco otra vez) | T | Baja | Medio | Los predicados reutilizan la misma expresión que los formateadores (`expresionMontoApi`, `SepararFecha`), y las pruebas de unidad cubren `"2026-02-30"`, `"1.555"`, montos negativos en movimientos y tipos desconocidos (fix-plan, Tests). |
| D-1 | Una fila malformada oculta toda la lista (el usuario no ve sus movimientos hasta que se corrija el dato) | D | Baja | Bajo | Decisión del usuario en DEFINE (RCA punto 1): preferible a mostrar una lista que no coincide con el saldo. El mensaje invita a reintentar y no expone el dato. |
| D-2 | Sin controles enfocables, el foco queda donde lo deja el navegador | D | Baja | Bajo | Caso límite documentado y probado (no lanza). Toda pantalla de la app tiene al menos un botón. |
| T-2 | El refactor pierde el bloqueo del doble envío | T | Baja | Bajo | La suite de `SeccionCuenta.test.jsx` (doble clic y doble Enter, E3-2) no se modifica; la base rechaza la segunda eliminación con BA404. |

Sin riesgos críticos ni altos; ningún riesgo aceptado formalmente.

## Mitigaciones incorporadas al fix-plan

1. Predicados basados en las mismas expresiones que los formateadores, con pruebas de los casos
   límite (pasos 1 y 2).
2. Mensaje fijo `mensajeErrorCargaMovimientos` ante datos inválidos, sin el dato ni el error
   (paso 2, NFR-06).
3. Selector constante en `ObtenerPrimerControlEnfocable` y caso "sin controles" probado (paso 4).
4. Suite existente de eliminación sin cambios como red del refactor (paso 7).
