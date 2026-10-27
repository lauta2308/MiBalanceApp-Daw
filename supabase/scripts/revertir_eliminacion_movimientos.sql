-- Reversión de supabase/migrations/20261028000100_eliminacion_movimientos.sql (spec FEAT-001c,
-- sección Rollback). Deshace la función de eliminación y el punto de falla ELIMINAR_MOVIMIENTO. No
-- borra datos de usuarios.
--
-- Si hay que revertir también la edición, este script se ejecuta ANTES que
-- revertir_edicion_movimientos.sql: esa reversión rehace la restricción solo con
-- AGREGAR_MOVIMIENTO (threat R11). No toca la reversión de FEAT-001a, que nunca se ejecuta en esta base (borra
-- cuentas reales).
--
-- Después de ejecutarlo, marcar la migración como revertida en el historial de Supabase:
--   npx supabase migration repair --status reverted 20261028000100

BEGIN;

-- 1. Filas del punto que se quita: si quedaran, la restricción restaurada no se podría crear
-- (threat R11).
DELETE FROM pruebas.BAT_FALLAS_SIMULADAS WHERE punto = 'ELIMINAR_MOVIMIENTO';

-- 2. Restricción con los puntos de FEAT-001a y FEAT-001b.
ALTER TABLE pruebas.BAT_FALLAS_SIMULADAS DROP CONSTRAINT BACK_FALLAS_SIMULADAS_PUNTO;
ALTER TABLE pruebas.BAT_FALLAS_SIMULADAS ADD CONSTRAINT BACK_FALLAS_SIMULADAS_PUNTO
  CHECK (punto IN ('AGREGAR_MOVIMIENTO', 'EDITAR_MOVIMIENTO'));

-- 3. Función de eliminación.
DROP FUNCTION public.BASP_ELIMINAR_MOVIMIENTO(uuid);

COMMIT;
