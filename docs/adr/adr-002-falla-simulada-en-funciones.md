# ADR-002: Falla simulada en funciones SQL para probar la atomicidad

| Field | Value |
|-------|-------|
| Date | 2026-10-25 |
| Ticket | FEAT-001a |
| Status | Accepted |

## Context
RNF-05 y AC-57 de `prd-FEAT-001a.md` exigen probar que, si el alta falla después de guardar el
movimiento y antes de actualizar el saldo, no queda nada a medias. Ese punto está dentro de
`BASP_AGREGAR_MOVIMIENTO`: una prueba no puede cortarlo desde afuera. `AGENTS.md` fija que las
pruebas corren contra el proyecto de Supabase, no contra una base local.

## Options considered

### Option 1: tabla de fallas simuladas consultada por la función
- **Pros:** prueba el punto exacto; sirve igual para edición y eliminación (FEAT-001b/c).
- **Cons:** código de prueba dentro de una función de producción; una consulta extra por alta.

### Option 2: provocar una falla natural del UPDATE
- **Pros:** sin código de prueba en producción.
- **Cons:** con el saldo sin tope no hay forma natural de que el UPDATE falle; no prueba el punto pedido.

### Option 3: base local (Docker) con una versión de la función que falla
- **Pros:** producción sin ganchos.
- **Cons:** contradice `AGENTS.md` (pruebas contra el proyecto) y agrega Docker como requisito.

## Decision
Option 1. La tabla `pruebas.BAT_FALLAS_SIMULADAS` vive en el esquema `pruebas`, que la API de Supabase
no expone, sin permisos para `anon` ni `authenticated`: solo la service role (que tienen las pruebas
y nunca la app) puede escribirla. En producción queda vacía.

## Consequences
- `BASP_AGREGAR_MOVIMIENTO` consulta la tabla entre el INSERT y el UPDATE y lanza `BA500` si el
  usuario está anotado (spec de FEAT-001a, Block 2).
- Las funciones de edición y eliminación de FEAT-001b y FEAT-001c usan el mismo mecanismo, con
  nuevos valores en `BACK_FALLAS_SIMULADAS_PUNTO`.
- Un usuario no puede activarla; aunque pudiera, solo abortaría su propia operación.
