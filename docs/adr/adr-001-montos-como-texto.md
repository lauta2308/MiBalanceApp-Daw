# ADR-001: Montos y saldo como texto en el navegador

| Field | Value |
|-------|-------|
| Date | 2026-10-25 |
| Ticket | FEAT-001a |
| Status | Accepted |

## Context
`AGENTS.md` prohíbe usar float para montos (RNF-04). En la base se usa `numeric`, pero supabase-js
entrega un `numeric` como número de JavaScript (float de 64 bits): se redondea mal desde ~15 dígitos,
y el saldo no tiene tope (NFR-03 de `prd-FEAT-001a.md`). Sumar en JS además arrastra errores
(0,1 + 0,2 = 0,30000000000000004).

## Options considered

### Option 1: números de JavaScript
- **Pros:** sin código extra; `Intl.NumberFormat` formatea directo.
- **Cons:** viola la regla de `AGENTS.md` en el navegador; pierde precisión con saldos grandes.

### Option 2: texto de punta a punta
- **Pros:** sin pérdida de precisión con cualquier cantidad de dígitos; cumple `AGENTS.md`.
- **Cons:** formateo y validación propios sobre cadenas, con sus pruebas.

## Decision
Option 2. Las vistas devuelven `monto::text` y `round(saldo, 2)::text` (siempre `"N.NN"`); el RPC
recibe `p_monto` como cadena `"N.NN"`. El navegador nunca convierte un monto a `Number` ni hace
cuentas con montos: el saldo siempre lo calcula la base.

## Consequences
- `src/utilidades/montos.js` formatea, filtra y valida montos solo con cadenas (spec de FEAT-001a,
  Block 3).
- Prohibidos `Number(`, `parseFloat` y aritmética sobre montos en `src/`.
- Las features futuras (Reportes, porcentajes de RF-99) deben calcular totales en SQL y recibirlos
  como texto, o justificar otra decisión en un ADR nuevo.
