-- Reversión de supabase/migrations/20261027000100_edicion_movimientos.sql (spec FEAT-001b,
-- sección Rollback). Deshace la función de edición, la columna id_categoria de la vista y el punto
-- de falla EDITAR_MOVIMIENTO, y deja los permisos como estaban. No borra datos de usuarios. No toca
-- la reversión de FEAT-001a, que nunca se ejecuta en esta base (borra cuentas reales).
--
-- Después de ejecutarlo, marcar la migración como revertida en el historial de Supabase:
--   npx supabase migration repair --status reverted 20261027000100

BEGIN;

-- 1. Filas del punto que se quita: si quedaran, la restricción restaurada no se podría crear
-- (threat R14).
DELETE FROM pruebas.BAT_FALLAS_SIMULADAS WHERE punto = 'EDITAR_MOVIMIENTO';

-- 2. Restricción con el único punto de FEAT-001a.
ALTER TABLE pruebas.BAT_FALLAS_SIMULADAS DROP CONSTRAINT BACK_FALLAS_SIMULADAS_PUNTO;
ALTER TABLE pruebas.BAT_FALLAS_SIMULADAS ADD CONSTRAINT BACK_FALLAS_SIMULADAS_PUNTO
  CHECK (punto IN ('AGREGAR_MOVIMIENTO'));

-- 3. Función de edición.
DROP FUNCTION public.BASP_EDITAR_MOVIMIENTO(uuid, text, numeric, uuid, date);

-- 4. Vista sin id_categoria. CREATE OR REPLACE no puede quitar columnas: se borra y se recrea, con
-- security_invoker y los mismos permisos que le dio FEAT-001a (threat R14).
DROP VIEW public.BAV_MOVIMIENTOS;

CREATE VIEW public.BAV_MOVIMIENTOS WITH (security_invoker = true) AS
  SELECT m.id,
         m.id_cuenta,
         m.fecha,
         m.tipo,
         m.monto::text AS monto,
         c.nombre AS nombre_categoria,
         m.creado_en
    FROM public.BAT_MOVIMIENTOS m
    JOIN public.BAT_CATEGORIAS c ON c.id = m.id_categoria;

REVOKE ALL ON public.BAV_MOVIMIENTOS FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.BAV_MOVIMIENTOS TO authenticated;

COMMIT;
