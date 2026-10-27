-- FEAT-001b — Edición de movimientos (spec FEAT-001b, Block 2).
--
-- Crea la función atómica BASP_EDITAR_MOVIMIENTO (llamada por RPC), que cambia el movimiento sin
-- tocar creado_en y ajusta el saldo en la misma transacción; suma el punto de falla simulada
-- EDITAR_MOVIMIENTO (ADR-002) y la columna id_categoria a la vista BAV_MOVIMIENTOS.
--
-- Reversión: supabase/scripts/revertir_edicion_movimientos.sql.

-- ---------------------------------------------------------------------------------------------
-- Esquema pruebas: nuevo punto de falla simulada (ADR-002)
-- ---------------------------------------------------------------------------------------------

ALTER TABLE pruebas.BAT_FALLAS_SIMULADAS DROP CONSTRAINT BACK_FALLAS_SIMULADAS_PUNTO;
ALTER TABLE pruebas.BAT_FALLAS_SIMULADAS ADD CONSTRAINT BACK_FALLAS_SIMULADAS_PUNTO
  CHECK (punto IN ('AGREGAR_MOVIMIENTO', 'EDITAR_MOVIMIENTO'));

-- ---------------------------------------------------------------------------------------------
-- Vista de lectura: id_categoria para precargar el formulario de edición
-- ---------------------------------------------------------------------------------------------

-- CREATE OR REPLACE solo admite columnas nuevas al final: mismas columnas, mismo orden, e
-- id_categoria después de creado_en. Se repite security_invoker para que la vista siga respetando
-- la RLS de quien consulta (threat R2). Conserva sus permisos (SELECT para authenticated).
CREATE OR REPLACE VIEW public.BAV_MOVIMIENTOS WITH (security_invoker = true) AS
  SELECT m.id,
         m.id_cuenta,
         m.fecha,
         m.tipo,
         m.monto::text AS monto,
         c.nombre AS nombre_categoria,
         m.creado_en,
         m.id_categoria
    FROM public.BAT_MOVIMIENTOS m
    JOIN public.BAT_CATEGORIAS c ON c.id = m.id_categoria;
-- Sin ORDER BY: el cliente siempre pide el orden fecha desc, creado_en desc, id desc (FR-34).

-- ---------------------------------------------------------------------------------------------
-- Edición atómica de un movimiento (FR-05, FR-07, FR-12, FR-13, FR-14, NFR-02, NFR-03)
-- ---------------------------------------------------------------------------------------------

CREATE FUNCTION public.BASP_EDITAR_MOVIMIENTO(
  p_id_movimiento uuid,
  p_tipo text,
  p_monto numeric,
  p_id_categoria uuid,
  p_fecha date
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_id_usuario uuid;
  v_id_cuenta uuid;
  v_tipo_anterior text;
  v_monto_anterior numeric;
  v_efecto_anterior numeric;
  v_efecto_nuevo numeric;
BEGIN
  -- 1. Usuario de la sesión.
  v_id_usuario := auth.uid();
  IF v_id_usuario IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'BA401', MESSAGE = 'Sin sesión.';
  END IF;

  -- 2. Cuenta del usuario, nunca de un parámetro; bloquea la fila del saldo. Mismo orden de
  -- bloqueo que el alta (primero la cuenta, después el movimiento) para no generar deadlocks.
  SELECT c.id INTO v_id_cuenta
    FROM public.BAT_CUENTAS c
   WHERE c.id_usuario = v_id_usuario
     FOR UPDATE;
  IF v_id_cuenta IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'BA404', MESSAGE = 'El usuario no tiene cuenta.';
  END IF;

  -- 3. Validaciones, antes de escribir nada: mismo orden y mismos códigos que el alta.
  IF p_id_movimiento IS NULL OR p_tipo IS NULL OR p_monto IS NULL OR p_id_categoria IS NULL
     OR p_fecha IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'BA400', MESSAGE = 'Falta un dato obligatorio.';
  END IF;
  IF p_tipo NOT IN ('INGRESO', 'GASTO') THEN
    RAISE EXCEPTION USING ERRCODE = 'BA400', MESSAGE = 'Tipo de movimiento inválido.';
  END IF;
  IF p_monto = 'NaN'::numeric THEN
    RAISE EXCEPTION USING ERRCODE = 'BA422', MESSAGE = 'Monto inválido.';
  END IF;
  -- 'Infinity' cae en el máximo.
  IF p_monto <= 0 OR p_monto > 999999999999.99 THEN
    RAISE EXCEPTION USING ERRCODE = 'BA422', MESSAGE = 'Monto inválido.';
  END IF;
  -- El tercer decimal se rechaza antes de que numeric(14,2) lo redondee.
  IF p_monto <> round(p_monto, 2) THEN
    RAISE EXCEPTION USING ERRCODE = 'BA422', MESSAGE = 'Monto inválido.';
  END IF;
  -- El servidor no conoce la zona del usuario: rechaza fechas posteriores a mañana en UTC (RF-107)
  -- sin modificar la fecha guardada.
  IF p_fecha > (now() AT TIME ZONE 'utc')::date + 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'BA423', MESSAGE = 'Fecha posterior a mañana.';
  END IF;

  -- 4. Movimiento de la cuenta del usuario, bloqueado. Inexistente o ajeno dan el mismo código:
  -- no revela si el id existe (threat R1).
  SELECT m.tipo, m.monto INTO v_tipo_anterior, v_monto_anterior
    FROM public.BAT_MOVIMIENTOS m
   WHERE m.id = p_id_movimiento
     AND m.id_cuenta = v_id_cuenta
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'BA404', MESSAGE = 'Movimiento inexistente.';
  END IF;

  -- 5. SECURITY DEFINER salta la RLS: la categoría se valida contra la cuenta del usuario y el
  -- tipo nuevo (incluido el cambio de tipo, threat R4).
  IF NOT EXISTS (
    SELECT 1
      FROM public.BAT_CATEGORIAS c
     WHERE c.id = p_id_categoria
       AND c.id_cuenta = v_id_cuenta
       AND c.tipo = p_tipo
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'BA424', MESSAGE = 'Categoría inválida.';
  END IF;

  -- 6. Movimiento: solo tipo, monto, categoría y fecha. creado_en, id e id_cuenta no cambian
  -- (FR-13, threat R6).
  UPDATE public.BAT_MOVIMIENTOS
     SET tipo = p_tipo,
         monto = p_monto,
         id_categoria = p_id_categoria,
         fecha = p_fecha
   WHERE id = p_id_movimiento;

  -- 7. Falla simulada para las pruebas de atomicidad (ADR-002).
  IF EXISTS (
    SELECT 1
      FROM pruebas.BAT_FALLAS_SIMULADAS f
     WHERE f.id_usuario = v_id_usuario
       AND f.punto = 'EDITAR_MOVIMIENTO'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'BA500', MESSAGE = 'Falla simulada.';
  END IF;

  -- 8. Saldo en un solo UPDATE: se quita el efecto anterior y se suma el nuevo (un ingreso suma,
  -- un gasto resta). Sin piso: puede quedar negativo.
  v_efecto_anterior := CASE WHEN v_tipo_anterior = 'INGRESO' THEN v_monto_anterior
                            ELSE -v_monto_anterior END;
  v_efecto_nuevo := CASE WHEN p_tipo = 'INGRESO' THEN p_monto ELSE -p_monto END;
  UPDATE public.BAT_CUENTAS
     SET saldo = saldo - v_efecto_anterior + v_efecto_nuevo
   WHERE id = v_id_cuenta;

  -- 9. Id del movimiento editado.
  RETURN p_id_movimiento;
END;
$$;

ALTER FUNCTION public.BASP_EDITAR_MOVIMIENTO(uuid, text, numeric, uuid, date) OWNER TO postgres;

-- ---------------------------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------------------------

-- Los privilegios por defecto de Supabase dan EXECUTE a anon, authenticated y service_role sobre
-- las funciones nuevas (threat R7): se revocan todos y se concede solo a authenticated.
-- service_role sigue sin UPDATE sobre BAT_MOVIMIENTOS: las pruebas editan solo por el RPC.
REVOKE EXECUTE ON FUNCTION public.BASP_EDITAR_MOVIMIENTO(uuid, text, numeric, uuid, date)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.BASP_EDITAR_MOVIMIENTO(uuid, text, numeric, uuid, date)
  TO authenticated;
