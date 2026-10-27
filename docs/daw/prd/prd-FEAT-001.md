# PRD Padre: Cuenta y Movimientos

| Métrica | Valor |
|---------|-------|
| Ticket | FEAT-001 |
| Date | 2026-10-25 |
| Status | Split |

## Sub-tickets

| Sub-ticket | Título | PRD | Dependencias | Status |
|---|---|---|---|---|
| FEAT-001a | Cuenta, Saldo, Alta y Lista de Movimientos | prd-FEAT-001a.md | ninguna | done — en el PR #1, se integra a main con su merge |
| FEAT-001b | Edición de Movimientos | prd-FEAT-001b.md | depende de a | active |
| FEAT-001c | Eliminación de Movimientos | prd-FEAT-001c.md | depende de a y b | pending |

## Orden de implementación sugerido

a → b → c

> La columna `Status` se mantiene: el cierre en RELEASE de cada sub-ticket lo pasa a `done`, con
> dónde quedó su rama, y el siguiente a `active`.

## Contexto original

El usuario pidió construir la primera feature de MiBalance según `docs/daw/prd/PRD.md` (PRD-001):
cuenta y categorías por defecto, saldo, y alta, lista, edición y eliminación de movimientos, con los
formatos de `docs/daw/prd/INTERFAZ.md`. El control de alcance de DEFINE estimó unos 75 criterios de
aceptación sobre base de datos, sesión, sección Cuenta, formularios y mensajes, y el usuario aprobó
dividirla en tres entregas que se publican por separado, en orden a → b → c.

Decisiones tomadas en DEFINE que valen para los tres sub-tickets:

- Inicio de sesión anónimo de Supabase, provisorio y aislado, con el error "No se pudo iniciar la
  sesión. Vuelva a intentarlo." y "Aceptar" para reintentar.
- Las categorías propias quedan fuera: las pruebas las cargan directamente en la base de datos.
- Sin barra de navegación: solo la flecha para volver atrás de los formularios de movimientos.
- Errores del servidor: "No se pudieron cargar sus movimientos. Vuelva a intentarlo.", "No se pudo
  guardar el movimiento. Vuelva a intentarlo." (el formulario queda abierto con los datos) y "No se
  pudo eliminar el movimiento. Vuelva a intentarlo." (el movimiento sigue en la lista).

## Cobertura de PRD-001

Entran en FEAT-001 (entre los tres sub-tickets):

- RF-01, RF-03, RF-90 y RF-91, solo en los formularios de movimientos.
- RF-04, RF-05, RF-25 y RF-28.
- RF-29 a RF-69 y RF-104 a RF-108.
- RF-87 y RF-88, solo la protección desde la API.
- RNF-02 a RNF-08, en lo que toca a la cuenta, las categorías por defecto y los movimientos.
- UI-01 a UI-11 y UI-14 a UI-16.

Quedan para features futuras:

- RF-02, RF-06 a RF-24, RF-26, RF-27, RF-70 a RF-89 (de RF-87 y RF-88, la parte de la interfaz) y
  RF-92 a RF-103.
- Las partes de RF-01, RF-03, RF-90 y RF-91 de los demás formularios y secciones.
- RNF-01, UI-12 y UI-13.
- Las partes de RNF-02 a RNF-08 sobre monedas, categorías propias, Editar Cuenta, Restablecer
  Cuenta, Reportes y Google.
