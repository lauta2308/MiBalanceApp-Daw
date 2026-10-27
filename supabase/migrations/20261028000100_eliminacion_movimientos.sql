-- FEAT-001c — Eliminación de movimientos (spec FEAT-001c, Block 1).
--
-- Crea la función atómica BASP_ELIMINAR_MOVIMIENTO (llamada por RPC), que borra el movimiento y le
-- quita su efecto al saldo en la misma transacción, y suma el punto de falla simulada
-- ELIMINAR_MOVIMIENTO (ADR-002). Sin tablas, columnas ni índices nuevos.
--
-- Reversión: supabase/scripts/revertir_eliminacion_movimientos.sql.

-- ---------------------------------------------------------------------------------------------
-- Esquema pruebas: nuevo punto de falla simulada (ADR-002)
-- ---------------------------------------------------------------------------------------------

ALTER TABLE pruebas.BAT_FALLAS_SIMULADAS DROP CONSTRAINT BACK_FALLAS_SIMULADAS_PUNTO;
ALTER TABLE pruebas.BAT_FALLAS_SIMULADAS ADD CONSTRAINT BACK_FALLAS_SIMULADAS_PUNTO
  CHECK (punto IN ('AGREGAR_MOVIMIENTO', 'EDITAR_MOVIMIENTO', 'ELIMINAR_MOVIMIENTO'));

-- ---------------------------------------------------------------------------------------------
-- Eliminación atómica de un movimiento (FR-03, FR-05, FR-11, NFR-02, NFR-03)
-- ---------------------------------------------------------------------------------------------

CREATE FUNCTION public.BASP_ELIMINAR_MOVIMIENTO(p_id_movimiento uuid)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_id_usuario uuid;
  v_id_cuenta uuid;
  v_tipo text;
  v_monto numeric;
  v_efecto numeric;
BEGIN
  -- 1. Usuario de la sesión.
  v_id_usuario := auth.uid();
  IF v_id_usuario IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'BA401', MESSAGE = 'Sin sesión.';
  END IF;

  -- 2. Cuenta del usuario, nunca de un parámetro; bloquea la fila del saldo. Mismo orden de
  -- bloqueo que el alta y la edición (primero la cuenta, después el movimiento) para no generar
  -- deadlocks (threat R3).
  SELECT c.id INTO v_id_cuenta
    FROM public.BAT_CUENTAS c
   WHERE c.id_usuario = v_id_usuario
     FOR UPDATE;
  IF v_id_cuenta IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'BA404', MESSAGE = 'El usuario no tiene cuenta.';
  END IF;

  -- 3. Validación, antes de escribir nada.
  IF p_id_movimiento IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'BA400', MESSAGE = 'Falta un dato obligatorio.';
  END IF;

  -- 4. Movimiento de la cuenta del usuario, bloqueado. Inexistente o ajeno dan el mismo código:
  -- no revela si el id existe (threat R1). Una segunda eliminación concurrente del mismo
  -- movimiento ya no lo encuentra y también da BA404 (threat R3).
  SELECT m.tipo, m.monto INTO v_tipo, v_monto
    FROM public.BAT_MOVIMIENTOS m
   WHERE m.id = p_id_movimiento
     AND m.id_cuenta = v_id_cuenta
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'BA404', MESSAGE = 'Movimiento inexistente.';
  END IF;

  -- 5. Borrado del movimiento.
  DELETE FROM public.BAT_MOVIMIENTOS
   WHERE id = p_id_movimiento;

  -- 6. Falla simulada para las pruebas de atomicidad (ADR-002, threat R3): entre el borrado y el
  -- saldo. El esquema pruebas no es accesible para los roles de la API (threat R10).
  IF EXISTS (
    SELECT 1
      FROM pruebas.BAT_FALLAS_SIMULADAS f
     WHERE f.id_usuario = v_id_usuario
       AND f.punto = 'ELIMINAR_MOVIMIENTO'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'BA500', MESSAGE = 'Falla simulada.';
  END IF;

  -- 7. Saldo en un solo UPDATE, con el tipo y el monto leídos bajo bloqueo (threat R3): se quita
  -- el efecto del movimiento (un ingreso sumaba, un gasto restaba). Sin piso: puede quedar
  -- negativo.
  v_efecto := CASE WHEN v_tipo = 'INGRESO' THEN v_monto ELSE -v_monto END;
  UPDATE public.BAT_CUENTAS
     SET saldo = saldo - v_efecto
   WHERE id = v_id_cuenta;

  -- 8. Id del movimiento eliminado.
  RETURN p_id_movimiento;
END;
$$;

ALTER FUNCTION public.BASP_ELIMINAR_MOVIMIENTO(uuid) OWNER TO postgres;

-- ---------------------------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------------------------

-- Los privilegios por defecto de Supabase dan EXECUTE a anon, authenticated y service_role sobre
-- las funciones nuevas (threat R2): se revocan todos y se concede solo a authenticated. Los
-- permisos de las tablas no cambian: authenticated conserva solo SELECT (FR-11, threat R4) y
-- service_role el DELETE sobre BAT_MOVIMIENTOS que usan las pruebas para limpiar.
REVOKE EXECUTE ON FUNCTION public.BASP_ELIMINAR_MOVIMIENTO(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.BASP_ELIMINAR_MOVIMIENTO(uuid) TO authenticated;
