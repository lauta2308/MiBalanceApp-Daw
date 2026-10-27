// Alta atómica de movimientos con BASP_AGREGAR_MOVIMIENTO, vista BAV_MOVIMIENTOS y script de
// limpieza de usuarios de prueba (spec FEAT-001a, Block 2).

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ActivarFallaSimulada,
  CargarCategoria,
  ConsultarBaseDatos,
  CrearClienteAdministrador,
  CrearClienteAnonimo,
  CrearUsuarioPrueba,
  DesactivarFallaSimulada,
  EjecutarEnTransaccionRevertida,
  EliminarUsuariosPrueba,
  LeerScript,
  ObtenerClaveAnonima,
  ObtenerCuentaUsuario,
  ObtenerUrlSupabase,
  ReiniciarCuenta,
  CerrarConexionesBaseDatos,
} from './utilidades/clientesPrueba.js';

const idsUsuariosCreados = [];
let principal;
let sinMarca;
let sinCuenta;
let contextoPrincipal = null;

beforeAll(async () => {
  principal = await CrearUsuarioPrueba();
  idsUsuariosCreados.push(principal.idUsuario);
  // Sin la marca de app_metadata: es el usuario que intenta marcarse a sí mismo (R12).
  sinMarca = await CrearUsuarioPrueba({ marcar: false });
  idsUsuariosCreados.push(sinMarca.idUsuario);
  sinCuenta = await CrearUsuarioPrueba();
  idsUsuariosCreados.push(sinCuenta.idUsuario);
});

afterAll(async () => {
  try {
    await EliminarUsuariosPrueba(idsUsuariosCreados);
  } finally {
    await CerrarConexionesBaseDatos();
  }
});

async function ObtenerContextoPrincipal() {
  if (!contextoPrincipal) {
    const cuenta = await ObtenerCuentaUsuario(principal.idUsuario);
    const { data: categorias, error } = await principal.cliente
      .from('bat_categorias')
      .select('id, nombre, tipo, es_por_defecto');
    if (error) throw new Error(`No se pudieron leer las categorías: ${error.message}`);
    const idPagoRealizado = categorias.find((c) => c.tipo === 'GASTO' && c.es_por_defecto).id;
    const idPagoIngresado = categorias.find((c) => c.tipo === 'INGRESO' && c.es_por_defecto).id;
    const idSueldo = await CargarCategoria(cuenta.id, 'Sueldo', 'INGRESO');
    contextoPrincipal = { idCuenta: cuenta.id, idPagoRealizado, idPagoIngresado, idSueldo };
  }
  return contextoPrincipal;
}

function AgregarMovimiento(cliente, tipo, monto, idCategoria, fecha) {
  return cliente.rpc('basp_agregar_movimiento', {
    p_tipo: tipo,
    p_monto: monto,
    p_id_categoria: idCategoria,
    p_fecha: fecha,
  });
}

async function ObtenerSaldo(cliente) {
  const { data, error } = await cliente.from('bav_cuenta').select('saldo');
  expect(error).toBeNull();
  expect(data).toHaveLength(1);
  return data[0].saldo;
}

async function ContarMovimientos(idCuenta) {
  const { count, error } = await CrearClienteAdministrador()
    .from('bat_movimientos')
    .select('id', { count: 'exact', head: true })
    .eq('id_cuenta', idCuenta);
  expect(error).toBeNull();
  return count;
}

// Fecha UTC del servidor más los días indicados, como "AAAA-MM-DD".
async function ObtenerFechaUtc(diasAgregados) {
  const [fila] = await ConsultarBaseDatos(
    "SELECT ((now() AT TIME ZONE 'utc')::date + $1::int)::text AS fecha",
    [diasAgregados],
  );
  return fila.fecha;
}

// Montos de prueba en centavos con BigInt (sin float).
function ConvertirACentavos(monto) {
  const [enteros, decimales = ''] = monto.split('.');
  return BigInt(enteros) * 100n + BigInt(decimales.padEnd(2, '0'));
}

function FormatearCentavos(centavos) {
  const signo = centavos < 0n ? '-' : '';
  const absoluto = centavos < 0n ? -centavos : centavos;
  const decimales = (absoluto % 100n).toString().padStart(2, '0');
  return `${signo}${absoluto / 100n}.${decimales}`;
}

describe('BASP_AGREGAR_MOVIMIENTO', { timeout: 60000 }, () => {
  it('un ingreso de 1000 sobre 10000.00 deja "11000.00" y un gasto de 1500 deja "8500.00" (FR-09, FR-10)', async () => {
    const contexto = await ObtenerContextoPrincipal();
    await ReiniciarCuenta(contexto.idCuenta, '10000.00');

    const ingreso = await AgregarMovimiento(
      principal.cliente, 'INGRESO', '1000', contexto.idPagoIngresado, '2026-10-01',
    );
    expect(ingreso.error).toBeNull();
    expect(ingreso.data).toMatch(/^[0-9a-f-]{36}$/);
    expect(await ObtenerSaldo(principal.cliente)).toBe('11000.00');

    await ReiniciarCuenta(contexto.idCuenta, '10000.00');
    const gasto = await AgregarMovimiento(
      principal.cliente, 'GASTO', '1500', contexto.idPagoRealizado, '2026-10-01',
    );
    expect(gasto.error).toBeNull();
    expect(await ObtenerSaldo(principal.cliente)).toBe('8500.00');
  });

  it('un gasto de 2000 sobre 1000.00 deja "-1000.00" (AC-27)', async () => {
    const contexto = await ObtenerContextoPrincipal();
    await ReiniciarCuenta(contexto.idCuenta, '1000.00');

    const { error } = await AgregarMovimiento(
      principal.cliente, 'GASTO', '2000', contexto.idPagoRealizado, '2026-10-01',
    );
    expect(error).toBeNull();
    expect(await ObtenerSaldo(principal.cliente)).toBe('-1000.00');
  });

  it('(E2-4) rechaza montos 0, -50, 1000000000000.00, 10.555 y NaN con BA422 (AC-16)', async () => {
    const contexto = await ObtenerContextoPrincipal();
    await ReiniciarCuenta(contexto.idCuenta, '10000.00');

    for (const monto of ['0', '-50', '1000000000000.00', '10.555', 'NaN']) {
      const { error } = await AgregarMovimiento(
        principal.cliente, 'GASTO', monto, contexto.idPagoRealizado, '2026-10-01',
      );
      expect(error?.code, `monto ${monto}`).toBe('BA422');
    }
    expect(await ObtenerSaldo(principal.cliente)).toBe('10000.00');
    expect(await ContarMovimientos(contexto.idCuenta)).toBe(0);
  });

  it('(E2-6) rechaza un gasto con la categoría de ingresos "Sueldo" con BA424 (AC-16)', async () => {
    const contexto = await ObtenerContextoPrincipal();
    await ReiniciarCuenta(contexto.idCuenta, '10000.00');

    const { error } = await AgregarMovimiento(
      principal.cliente, 'GASTO', '100', contexto.idSueldo, '2026-10-01',
    );
    expect(error?.code).toBe('BA424');
    expect(await ObtenerSaldo(principal.cliente)).toBe('10000.00');
    expect(await ContarMovimientos(contexto.idCuenta)).toBe(0);
  });

  it('(E2-1) rechaza un gasto sin monto, sin categoría, sin fecha o con tipo "OTRO" con BA400 (AC-16)', async () => {
    const contexto = await ObtenerContextoPrincipal();
    await ReiniciarCuenta(contexto.idCuenta, '10000.00');

    const casos = [
      ['GASTO', null, contexto.idPagoRealizado, '2026-10-01'],
      ['GASTO', '100', null, '2026-10-01'],
      ['GASTO', '100', contexto.idPagoRealizado, null],
      ['OTRO', '100', contexto.idPagoRealizado, '2026-10-01'],
    ];
    for (const [tipo, monto, idCategoria, fecha] of casos) {
      const { error } = await AgregarMovimiento(principal.cliente, tipo, monto, idCategoria, fecha);
      expect(error?.code, JSON.stringify({ tipo, monto, idCategoria, fecha })).toBe('BA400');
    }
    expect(await ObtenerSaldo(principal.cliente)).toBe('10000.00');
    expect(await ContarMovimientos(contexto.idCuenta)).toBe(0);
  });

  it('(E2-5) rechaza un gasto con fecha dos días posterior a hoy en UTC con BA423 (AC-28)', async () => {
    const contexto = await ObtenerContextoPrincipal();
    await ReiniciarCuenta(contexto.idCuenta, '10000.00');

    const { error } = await AgregarMovimiento(
      principal.cliente, 'GASTO', '100', contexto.idPagoRealizado, await ObtenerFechaUtc(2),
    );
    expect(error?.code).toBe('BA423');
    expect(await ObtenerSaldo(principal.cliente)).toBe('10000.00');
    expect(await ContarMovimientos(contexto.idCuenta)).toBe(0);
  });

  it('acepta un gasto de 100 con la fecha de mañana en UTC y la guarda igual (AC-29)', async () => {
    const contexto = await ObtenerContextoPrincipal();
    await ReiniciarCuenta(contexto.idCuenta, '10000.00');
    const manana = await ObtenerFechaUtc(1);

    const { data: idMovimiento, error } = await AgregarMovimiento(
      principal.cliente, 'GASTO', '100', contexto.idPagoRealizado, manana,
    );
    expect(error).toBeNull();
    const { data, error: errorLectura } = await principal.cliente
      .from('bav_movimientos')
      .select('fecha, tipo, monto, nombre_categoria')
      .eq('id', idMovimiento);
    expect(errorLectura).toBeNull();
    expect(data).toEqual([
      { fecha: manana, tipo: 'GASTO', monto: '100.00', nombre_categoria: 'Pago Realizado' },
    ]);
    expect(await ObtenerSaldo(principal.cliente)).toBe('9900.00');
  });

  it('acepta un gasto con fecha 1990-03-15 (FR-23)', async () => {
    const contexto = await ObtenerContextoPrincipal();
    await ReiniciarCuenta(contexto.idCuenta, '10000.00');

    const { data: idMovimiento, error } = await AgregarMovimiento(
      principal.cliente, 'GASTO', '100', contexto.idPagoRealizado, '1990-03-15',
    );
    expect(error).toBeNull();
    const { data } = await principal.cliente
      .from('bav_movimientos')
      .select('fecha')
      .eq('id', idMovimiento);
    expect(data).toEqual([{ fecha: '1990-03-15' }]);
  });

  it('0.10 + 0.20 deja "0.30" y monto y saldo son numeric (AC-55)', async () => {
    const contexto = await ObtenerContextoPrincipal();
    await ReiniciarCuenta(contexto.idCuenta, '0.00');

    for (const monto of ['0.10', '0.20']) {
      const { error } = await AgregarMovimiento(
        principal.cliente, 'INGRESO', monto, contexto.idPagoIngresado, '2026-10-01',
      );
      expect(error).toBeNull();
    }
    expect(await ObtenerSaldo(principal.cliente)).toBe('0.30');

    const columnas = await ConsultarBaseDatos(
      `SELECT table_name, column_name, data_type
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND ((table_name = 'bat_movimientos' AND column_name = 'monto')
            OR (table_name = 'bat_cuentas' AND column_name = 'saldo'))
        ORDER BY table_name`,
    );
    expect(columnas).toEqual([
      { table_name: 'bat_cuentas', column_name: 'saldo', data_type: 'numeric' },
      { table_name: 'bat_movimientos', column_name: 'monto', data_type: 'numeric' },
    ]);
  });

  it('dos ingresos de 999999999999.99 dejan "1999999999999.98" (AC-56)', async () => {
    const contexto = await ObtenerContextoPrincipal();
    await ReiniciarCuenta(contexto.idCuenta, '0.00');

    for (let vuelta = 0; vuelta < 2; vuelta += 1) {
      const { error } = await AgregarMovimiento(
        principal.cliente, 'INGRESO', '999999999999.99', contexto.idPagoIngresado, '2026-10-01',
      );
      expect(error).toBeNull();
    }
    expect(await ObtenerSaldo(principal.cliente)).toBe('1999999999999.98');
  });

  it('(E2-7) con la falla simulada activa devuelve BA500 y no deja nada a medias (AC-57)', async () => {
    const contexto = await ObtenerContextoPrincipal();
    await ReiniciarCuenta(contexto.idCuenta, '10000.00');

    await ActivarFallaSimulada(principal.idUsuario, 'AGREGAR_MOVIMIENTO');
    try {
      const { error } = await AgregarMovimiento(
        principal.cliente, 'GASTO', '1000', contexto.idPagoRealizado, '2026-10-01',
      );
      expect(error?.code).toBe('BA500');
    } finally {
      await DesactivarFallaSimulada(principal.idUsuario);
    }
    expect(await ContarMovimientos(contexto.idCuenta)).toBe(0);
    expect(await ObtenerSaldo(principal.cliente)).toBe('10000.00');
  });

  it('20 altas intercaladas mantienen saldo = Σ ingresos − Σ gastos después de cada alta (AC-58)', async () => {
    const contexto = await ObtenerContextoPrincipal();
    await ReiniciarCuenta(contexto.idCuenta, '0.00');

    const secuencia = [
      ['INGRESO', '1500.50'], ['GASTO', '200.25'], ['INGRESO', '0.01'], ['GASTO', '999.99'],
      ['INGRESO', '35000'], ['GASTO', '12.10'], ['INGRESO', '0.99'], ['GASTO', '40000.00'],
      ['INGRESO', '250.75'], ['GASTO', '3.33'], ['INGRESO', '7.77'], ['GASTO', '0.10'],
      ['INGRESO', '123456.78'], ['GASTO', '654.32'], ['INGRESO', '10'], ['GASTO', '88888.88'],
      ['INGRESO', '0.02'], ['GASTO', '1.01'], ['INGRESO', '42.42'], ['GASTO', '29999.99'],
    ];
    let esperadoCentavos = 0n;
    for (const [tipo, monto] of secuencia) {
      const idCategoria = tipo === 'INGRESO' ? contexto.idPagoIngresado : contexto.idPagoRealizado;
      const { error } = await AgregarMovimiento(
        principal.cliente, tipo, monto, idCategoria, '2026-10-01',
      );
      expect(error).toBeNull();
      esperadoCentavos += tipo === 'INGRESO' ? ConvertirACentavos(monto) : -ConvertirACentavos(monto);

      const [fila] = await ConsultarBaseDatos(
        `SELECT c.saldo::text AS saldo,
                COALESCE(sum(CASE WHEN m.tipo = 'INGRESO' THEN m.monto ELSE -m.monto END), 0)::numeric(20,2)::text AS suma
           FROM public.bat_cuentas c
           LEFT JOIN public.bat_movimientos m ON m.id_cuenta = c.id
          WHERE c.id = $1
          GROUP BY c.saldo`,
        [contexto.idCuenta],
      );
      const saldo = await ObtenerSaldo(principal.cliente);
      expect(saldo).toBe(FormatearCentavos(esperadoCentavos));
      expect(saldo).toBe(fila.suma);
    }
    expect(await ContarMovimientos(contexto.idCuenta)).toBe(20);
  });

  it('(E2-3) un usuario cuya cuenta se borró recibe BA404', async () => {
    const { error: errorBorrado } = await CrearClienteAdministrador()
      .from('bat_cuentas')
      .delete()
      .eq('id_usuario', sinCuenta.idUsuario);
    expect(errorBorrado).toBeNull();

    const { error } = await AgregarMovimiento(
      sinCuenta.cliente, 'GASTO', '100', randomUUID(), '2026-10-01',
    );
    expect(error?.code).toBe('BA404');
  });

  it('(E2-2) la llamada con la anon key y sin sesión es rechazada', async () => {
    const contexto = await ObtenerContextoPrincipal();
    await ReiniciarCuenta(contexto.idCuenta, '10000.00');

    const { data, error } = await AgregarMovimiento(
      CrearClienteAnonimo(), 'GASTO', '100', contexto.idPagoRealizado, '2026-10-01',
    );
    expect(data).toBeNull();
    expect(error?.code).toBe('42501');
    expect(await ContarMovimientos(contexto.idCuenta)).toBe(0);
  });
});

describe('BAV_MOVIMIENTOS', { timeout: 60000 }, () => {
  it('devuelve el orden fecha desc, creado_en desc, id desc (FR-34)', async () => {
    const contexto = await ObtenerContextoPrincipal();
    await ReiniciarCuenta(contexto.idCuenta, '0.00');

    const momento = '2026-10-01T12:00:00+00:00';
    const momentoPosterior = '2026-10-01T12:00:05+00:00';
    const filas = [
      { fecha: '2026-01-10', creado_en: momento },
      { fecha: '2026-01-10', creado_en: momento },
      { fecha: '2026-01-10', creado_en: momentoPosterior },
      { fecha: '2026-01-12', creado_en: momento },
      { fecha: '2025-12-31', creado_en: momentoPosterior },
    ].map((fila) => ({
      ...fila,
      id: randomUUID(),
      id_cuenta: contexto.idCuenta,
      id_categoria: contexto.idPagoRealizado,
      tipo: 'GASTO',
      monto: '1.00',
    }));
    const { error } = await CrearClienteAdministrador().from('bat_movimientos').insert(filas);
    expect(error).toBeNull();

    const esperado = [...filas]
      .sort((a, b) =>
        b.fecha.localeCompare(a.fecha) ||
        Date.parse(b.creado_en) - Date.parse(a.creado_en) ||
        (b.id > a.id ? 1 : -1),
      )
      .map((fila) => fila.id);

    // La vista no ordena: el orden lo pide siempre el cliente (contrato de la API).
    const [definicion] = await ConsultarBaseDatos(
      "SELECT pg_get_viewdef('public.bav_movimientos'::regclass) AS sql",
    );
    expect(definicion.sql).not.toMatch(/ORDER BY/i);

    // Orden del contrato de la API.
    const conOrden = await principal.cliente
      .from('bav_movimientos')
      .select('id')
      .order('fecha', { ascending: false })
      .order('creado_en', { ascending: false })
      .order('id', { ascending: false });
    expect(conOrden.error).toBeNull();
    expect(conOrden.data.map((fila) => fila.id)).toEqual(esperado);

    await ReiniciarCuenta(contexto.idCuenta, '0.00');
  });
});

describe('limpiar_usuarios_prueba.sql', { timeout: 60000 }, () => {
  // El script borra a TODOS los usuarios de prueba; se ejecuta en una transacción revertida para
  // no tocar los usuarios de otros archivos que corren en paralelo.
  it('borra un usuario de prueba con movimientos sin errores de FK', async () => {
    const contexto = await ObtenerContextoPrincipal();
    await ReiniciarCuenta(contexto.idCuenta, '0.00');
    const { error } = await AgregarMovimiento(
      principal.cliente, 'INGRESO', '50', contexto.idPagoIngresado, '2026-10-01',
    );
    expect(error).toBeNull();
    expect(await ContarMovimientos(contexto.idCuenta)).toBe(1);

    const script = LeerScript('supabase/scripts/limpiar_usuarios_prueba.sql');
    await EjecutarEnTransaccionRevertida(async (Consultar) => {
      // El script borra provisoriamente también a los usuarios de prueba de otras corridas, dentro
      // de una transacción que siempre se revierte: nada queda borrado, pero mientras dura bloquea
      // esas filas de auth.users. Los timeouts acotan ese bloqueo: si otra sesión tiene una fila
      // tomada, se espera a lo sumo 3 s por el lock, y ninguna sentencia retiene locks más de 10 s.
      await Consultar("SET LOCAL lock_timeout = '3s'");
      await Consultar("SET LOCAL statement_timeout = '10s'");
      await Consultar(script);
      const [restantes] = await Consultar(
        `SELECT (SELECT count(*) FROM auth.users WHERE id = $1)::int AS usuarios,
                (SELECT count(*) FROM public.bat_cuentas WHERE id = $2)::int AS cuentas,
                (SELECT count(*) FROM public.bat_categorias WHERE id_cuenta = $2)::int AS categorias,
                (SELECT count(*) FROM public.bat_movimientos WHERE id_cuenta = $2)::int AS movimientos`,
        [principal.idUsuario, contexto.idCuenta],
      );
      expect(restantes).toEqual({ usuarios: 0, cuentas: 0, categorias: 0, movimientos: 0 });
    });
  });

  it('(E2-8, R12) un usuario que se marca es_prueba en su user_metadata no es borrado y no puede escribir su app_metadata', async () => {
    const { error: errorMetadatos } = await sinMarca.cliente.auth.updateUser({
      data: { es_prueba: true },
    });
    expect(errorMetadatos).toBeNull();

    // Intento directo contra Auth de escribir app_metadata con el token del propio usuario.
    const { data: sesion } = await sinMarca.cliente.auth.getSession();
    const respuesta = await fetch(`${ObtenerUrlSupabase()}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: ObtenerClaveAnonima(),
        Authorization: `Bearer ${sesion.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ app_metadata: { es_prueba: true } }),
    });
    // Auth rechaza explícitamente la escritura de app_metadata sin privilegios de administrador.
    const cuerpo = await respuesta.json();
    expect({ estado: respuesta.status, codigo: cuerpo.error_code }).toEqual({
      estado: 403,
      codigo: 'not_admin',
    });

    const { data: usuario, error } = await CrearClienteAdministrador().auth.admin.getUserById(
      sinMarca.idUsuario,
    );
    expect(error).toBeNull();
    expect(usuario.user.user_metadata.es_prueba).toBe(true);
    expect(usuario.user.app_metadata.es_prueba).toBeUndefined();

    const script = LeerScript('supabase/scripts/limpiar_usuarios_prueba.sql');
    await EjecutarEnTransaccionRevertida(async (Consultar) => {
      // Mismo acotamiento de locks que en la prueba anterior.
      await Consultar("SET LOCAL lock_timeout = '3s'");
      await Consultar("SET LOCAL statement_timeout = '10s'");
      await Consultar(script);
      const [fila] = await Consultar(
        'SELECT count(*)::int AS usuarios FROM auth.users WHERE id = $1',
        [sinMarca.idUsuario],
      );
      expect(fila.usuarios).toBe(1);
    });

    // Ya verificado, se marca con app_metadata para que limpiar_usuarios_prueba.sql lo alcance si
    // afterAll no llega a correr.
    const { error: errorMarca } = await CrearClienteAdministrador().auth.admin.updateUserById(
      sinMarca.idUsuario,
      { app_metadata: { es_prueba: true } },
    );
    expect(errorMarca).toBeNull();
  });
});
