-- FEAT-001a — Cuenta, categorías y movimientos (spec FEAT-001a, Block 2).
--
-- Crea las tablas de cuentas, categorías y movimientos con RLS de solo lectura para el propietario,
-- el trigger que crea la cuenta y las categorías por defecto al registrarse un usuario, la función
-- atómica BASP_AGREGAR_MOVIMIENTO (llamada por RPC), las vistas de lectura y el esquema pruebas con
-- la tabla de fallas simuladas (ADR-002).
--
-- Reversión: supabase/scripts/revertir_cuentas_y_movimientos.sql.

-- ---------------------------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------------------------

CREATE TABLE public.BAT_CUENTAS (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_usuario uuid NOT NULL,
  nombre text NOT NULL DEFAULT 'Mi Cuenta',
  moneda text NOT NULL DEFAULT 'USD',
  -- Sin precisión: sin tope de dígitos enteros (NFR-03). Nunca float (RNF-04).
  saldo numeric NOT NULL DEFAULT 0.00,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT BAPK_CUENTAS PRIMARY KEY (id),
  CONSTRAINT BAFK_CUENTAS_USUARIO FOREIGN KEY (id_usuario)
    REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT BAUQ_CUENTAS_USUARIO UNIQUE (id_usuario),
  CONSTRAINT BACK_CUENTAS_NOMBRE CHECK (
    length(btrim(nombre)) BETWEEN 1 AND 30 AND nombre = btrim(nombre)
  ),
  CONSTRAINT BACK_CUENTAS_MONEDA CHECK (moneda ~ '^[A-Z]{3}$'),
  CONSTRAINT BACK_CUENTAS_SALDO_ESCALA CHECK (scale(saldo) <= 2)
);

CREATE TABLE public.BAT_CATEGORIAS (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_cuenta uuid NOT NULL,
  nombre text NOT NULL,
  tipo text NOT NULL,
  es_por_defecto boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT BAPK_CATEGORIAS PRIMARY KEY (id),
  CONSTRAINT BAFK_CATEGORIAS_CUENTA FOREIGN KEY (id_cuenta)
    REFERENCES public.BAT_CUENTAS (id) ON DELETE CASCADE,
  CONSTRAINT BACK_CATEGORIAS_NOMBRE CHECK (length(btrim(nombre)) BETWEEN 1 AND 30),
  CONSTRAINT BACK_CATEGORIAS_TIPO CHECK (tipo IN ('INGRESO', 'GASTO')),
  -- Destino de la FK compuesta de BAT_MOVIMIENTOS (categoría de la misma cuenta y del mismo tipo).
  CONSTRAINT BAUQ_CATEGORIAS_ID_CUENTA_TIPO UNIQUE (id, id_cuenta, tipo)
);

CREATE INDEX BAIX_CATEGORIAS_CUENTA ON public.BAT_CATEGORIAS (id_cuenta, tipo);

-- Una sola categoría por defecto por tipo en cada cuenta.
CREATE UNIQUE INDEX BAIX_CATEGORIAS_DEFECTO ON public.BAT_CATEGORIAS (id_cuenta, tipo)
  WHERE es_por_defecto;

CREATE TABLE public.BAT_MOVIMIENTOS (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_cuenta uuid NOT NULL,
  id_categoria uuid NOT NULL,
  tipo text NOT NULL,
  monto numeric(14, 2) NOT NULL,
  -- Día calendario elegido por el usuario: date, nunca convertido a UTC.
  fecha date NOT NULL,
  -- Momento del alta; no cambia al editar (FR-34).
  creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT BAPK_MOVIMIENTOS PRIMARY KEY (id),
  CONSTRAINT BAFK_MOVIMIENTOS_CUENTA FOREIGN KEY (id_cuenta)
    REFERENCES public.BAT_CUENTAS (id) ON DELETE CASCADE,
  -- Impide una categoría de otra cuenta o de otro tipo (AC-16, AC-53).
  CONSTRAINT BAFK_MOVIMIENTOS_CATEGORIA FOREIGN KEY (id_categoria, id_cuenta, tipo)
    REFERENCES public.BAT_CATEGORIAS (id, id_cuenta, tipo) MATCH FULL ON DELETE NO ACTION,
  CONSTRAINT BACK_MOVIMIENTOS_TIPO CHECK (tipo IN ('INGRESO', 'GASTO')),
  CONSTRAINT BACK_MOVIMIENTOS_MONTO_POSITIVO CHECK (monto > 0),
  CONSTRAINT BACK_MOVIMIENTOS_MONTO_MAXIMO CHECK (monto <= 999999999999.99)
);

-- Cubre el orden de la lista (FR-34, NFR-01).
CREATE INDEX BAIX_MOVIMIENTOS_CUENTA_FECHA
  ON public.BAT_MOVIMIENTOS (id_cuenta, fecha DESC, creado_en DESC, id DESC);

-- ---------------------------------------------------------------------------------------------
-- Esquema pruebas: falla simulada para probar la atomicidad (ADR-002). La API de Supabase no lo
-- expone y ningún rol de la API tiene permisos: las pruebas lo escriben por la conexión directa
-- como postgres. En producción la tabla queda vacía.
-- ---------------------------------------------------------------------------------------------

CREATE SCHEMA pruebas;

CREATE TABLE pruebas.BAT_FALLAS_SIMULADAS (
  id_usuario uuid NOT NULL,
  punto text NOT NULL,
  CONSTRAINT BAPK_FALLAS_SIMULADAS PRIMARY KEY (id_usuario),
  CONSTRAINT BAFK_FALLAS_SIMULADAS_USUARIO FOREIGN KEY (id_usuario)
    REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT BACK_FALLAS_SIMULADAS_PUNTO CHECK (punto IN ('AGREGAR_MOVIMIENTO'))
);

-- ---------------------------------------------------------------------------------------------
-- Vistas de lectura (respetan la RLS de quien consulta)
-- ---------------------------------------------------------------------------------------------

-- El saldo viaja como texto "N.NN" (ADR-001).
CREATE VIEW public.BAV_CUENTA WITH (security_invoker = true) AS
  SELECT c.id, c.nombre, c.moneda, round(c.saldo, 2)::text AS saldo
    FROM public.BAT_CUENTAS c;

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
-- Sin ORDER BY: el cliente siempre pide el orden fecha desc, creado_en desc, id desc (FR-34),
-- cubierto por BAIX_MOVIMIENTOS_CUENTA_FECHA.

-- ---------------------------------------------------------------------------------------------
-- Trigger de registro: cuenta "Mi Cuenta" y categorías por defecto (FR-04, FR-05)
-- ---------------------------------------------------------------------------------------------

CREATE FUNCTION public.BATF_CREAR_CUENTA_USUARIO()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_id_cuenta uuid;
BEGIN
  INSERT INTO public.BAT_CUENTAS (id_usuario, nombre, moneda, saldo)
  VALUES (NEW.id, 'Mi Cuenta', 'USD', 0.00)
  RETURNING id INTO v_id_cuenta;

  INSERT INTO public.BAT_CATEGORIAS (id_cuenta, nombre, tipo, es_por_defecto)
  VALUES (v_id_cuenta, 'Pago Realizado', 'GASTO', true),
         (v_id_cuenta, 'Pago Ingresado', 'INGRESO', true);

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.BATF_CREAR_CUENTA_USUARIO() OWNER TO postgres;

-- Corre en la transacción del registro: si falla, falla el registro (FR-02) y nunca queda un
-- usuario sin cuenta.
CREATE TRIGGER BATR_CREAR_CUENTA_USUARIO
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.BATF_CREAR_CUENTA_USUARIO();

-- ---------------------------------------------------------------------------------------------
-- Alta atómica de un movimiento (FR-09, FR-10, FR-11, NFR-04)
-- ---------------------------------------------------------------------------------------------

CREATE FUNCTION public.BASP_AGREGAR_MOVIMIENTO(
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
  v_id_movimiento uuid;
BEGIN
  -- 1. Usuario de la sesión.
  v_id_usuario := auth.uid();
  IF v_id_usuario IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'BA401', MESSAGE = 'Sin sesión.';
  END IF;

  -- 2. Cuenta del usuario, nunca de un parámetro; bloquea la fila del saldo.
  SELECT c.id INTO v_id_cuenta
    FROM public.BAT_CUENTAS c
   WHERE c.id_usuario = v_id_usuario
     FOR UPDATE;
  IF v_id_cuenta IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'BA404', MESSAGE = 'El usuario no tiene cuenta.';
  END IF;

  -- 3. Validaciones, antes de escribir nada.
  IF p_tipo IS NULL OR p_monto IS NULL OR p_id_categoria IS NULL OR p_fecha IS NULL THEN
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
  -- SECURITY DEFINER salta la RLS: la categoría se valida contra la cuenta del usuario.
  IF NOT EXISTS (
    SELECT 1
      FROM public.BAT_CATEGORIAS c
     WHERE c.id = p_id_categoria
       AND c.id_cuenta = v_id_cuenta
       AND c.tipo = p_tipo
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'BA424', MESSAGE = 'Categoría inválida.';
  END IF;

  -- 4. Movimiento.
  INSERT INTO public.BAT_MOVIMIENTOS (id_cuenta, id_categoria, tipo, monto, fecha)
  VALUES (v_id_cuenta, p_id_categoria, p_tipo, p_monto, p_fecha)
  RETURNING id INTO v_id_movimiento;

  -- 5. Falla simulada para las pruebas de atomicidad (ADR-002).
  IF EXISTS (
    SELECT 1
      FROM pruebas.BAT_FALLAS_SIMULADAS f
     WHERE f.id_usuario = v_id_usuario
       AND f.punto = 'AGREGAR_MOVIMIENTO'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'BA500', MESSAGE = 'Falla simulada.';
  END IF;

  -- 6. Saldo, sin piso: puede quedar negativo (FR-11).
  UPDATE public.BAT_CUENTAS
     SET saldo = CASE WHEN p_tipo = 'INGRESO' THEN saldo + p_monto ELSE saldo - p_monto END
   WHERE id = v_id_cuenta;

  -- 7. Id del movimiento creado.
  RETURN v_id_movimiento;
END;
$$;

ALTER FUNCTION public.BASP_AGREGAR_MOVIMIENTO(text, numeric, uuid, date) OWNER TO postgres;

-- ---------------------------------------------------------------------------------------------
-- RLS: solo lectura del propietario (NFR-02)
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.BAT_CUENTAS ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.BAT_CATEGORIAS ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.BAT_MOVIMIENTOS ENABLE ROW LEVEL SECURITY;
ALTER TABLE pruebas.BAT_FALLAS_SIMULADAS ENABLE ROW LEVEL SECURITY;

CREATE POLICY BAPOL_CUENTAS_PROPIETARIO ON public.BAT_CUENTAS
  FOR SELECT TO authenticated
  USING (id_usuario = (SELECT auth.uid()));

CREATE POLICY BAPOL_CATEGORIAS_PROPIETARIO ON public.BAT_CATEGORIAS
  FOR SELECT TO authenticated
  USING (id_cuenta IN (SELECT id FROM public.BAT_CUENTAS WHERE id_usuario = (SELECT auth.uid())));

CREATE POLICY BAPOL_MOVIMIENTOS_PROPIETARIO ON public.BAT_MOVIMIENTOS
  FOR SELECT TO authenticated
  USING (id_cuenta IN (SELECT id FROM public.BAT_CUENTAS WHERE id_usuario = (SELECT auth.uid())));

-- ---------------------------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------------------------

-- Los privilegios por defecto de Supabase dan permisos a anon, authenticated y service_role sobre
-- los objetos nuevos (R2): se revocan todos y se concede solo lo necesario. authenticated tiene
-- únicamente SELECT; ninguna escritura directa (FR-49, FR-50).
REVOKE ALL ON public.BAT_CUENTAS, public.BAT_CATEGORIAS, public.BAT_MOVIMIENTOS
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.BAV_CUENTA, public.BAV_MOVIMIENTOS
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.BAT_CUENTAS, public.BAT_CATEGORIAS, public.BAT_MOVIMIENTOS TO authenticated;
GRANT SELECT ON public.BAV_CUENTA, public.BAV_MOVIMIENTOS TO authenticated;

-- service_role: estos permisos existen solo para que las pruebas de pruebas/ preparen y verifiquen
-- sus datos (la app nunca usa la service role). Se concede únicamente lo que esas pruebas usan.
GRANT SELECT, UPDATE, DELETE ON public.BAT_CUENTAS TO service_role;
GRANT SELECT, INSERT ON public.BAT_CATEGORIAS TO service_role;
GRANT SELECT, INSERT, DELETE ON public.BAT_MOVIMIENTOS TO service_role;

-- Esquema pruebas: sin acceso para ningún rol de la API (R10, ADR-002).
REVOKE ALL ON SCHEMA pruebas FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON pruebas.BAT_FALLAS_SIMULADAS FROM PUBLIC, anon, authenticated, service_role;

-- Funciones: la de trigger no la ejecuta nadie desde la API; el alta solo usuarios autenticados.
REVOKE EXECUTE ON FUNCTION public.BATF_CREAR_CUENTA_USUARIO() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.BASP_AGREGAR_MOVIMIENTO(text, numeric, uuid, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.BASP_AGREGAR_MOVIMIENTO(text, numeric, uuid, date) TO authenticated;
