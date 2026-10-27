-- Reversión de supabase/migrations/20261025000100_cuentas_y_movimientos.sql (spec FEAT-001a,
-- sección Rollback). Elimina en orden inverso todo lo que crea la migración. Los usuarios de
-- auth.users no se tocan.
--
-- Después de ejecutarlo, marcar la migración como revertida en el historial de Supabase:
--   npx supabase migration repair --status reverted 20261025000100

BEGIN;

DROP VIEW IF EXISTS public.BAV_MOVIMIENTOS;
DROP VIEW IF EXISTS public.BAV_CUENTA;

DROP FUNCTION IF EXISTS public.BASP_AGREGAR_MOVIMIENTO(text, numeric, uuid, date);

DROP TRIGGER IF EXISTS BATR_CREAR_CUENTA_USUARIO ON auth.users;
DROP FUNCTION IF EXISTS public.BATF_CREAR_CUENTA_USUARIO();

DROP TABLE IF EXISTS public.BAT_MOVIMIENTOS;
DROP TABLE IF EXISTS public.BAT_CATEGORIAS;
DROP TABLE IF EXISTS public.BAT_CUENTAS;
DROP TABLE IF EXISTS pruebas.BAT_FALLAS_SIMULADAS;

DROP SCHEMA IF EXISTS pruebas;

COMMIT;
