// Edición atómica de movimientos con BASP_EDITAR_MOVIMIENTO y columna id_categoria de la vista
// BAV_MOVIMIENTOS (spec FEAT-001b, Block 2; threat model R1, R3, R4, R6, R8).
//
// Usa dos usuarios (A edita, B es el ajeno) para gastar pocos inicios anónimos. Cada prueba deja la
// cuenta de A como la necesita con ReiniciarCuenta y carga sus movimientos con la service role.
// service_role no tiene UPDATE sobre bat_movimientos: las ediciones van solo por el RPC, con la
// sesión de A. creado_en y la falla simulada se leen y escriben por la conexión directa (ADR-003).

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
  ObtenerCuentaUsuario,
  ReiniciarCuenta,
  CerrarConexionesBaseDatos,
} from './utilidades/clientesPrueba.js';

const idsUsuariosCreados = [];
let usuarioA;
let usuarioB;
let contexto = null;

beforeAll(async () => {
  usuarioA = await CrearUsuarioPrueba();
  idsUsuariosCreados.push(usuarioA.idUsuario);
  usuarioB = await CrearUsuarioPrueba();
  idsUsuariosCreados.push(usuarioB.idUsuario);
});

afterAll(async () => {
  try {
    await EliminarUsuariosPrueba(idsUsuariosCreados);
  } finally {
    await CerrarConexionesBaseDatos();
  }
});

// Categorías de A ("Transporte", "Mercado", "Sueldo" y las por defecto) y de B ("Mercado"), y un
// gasto de B de 100 dado de alta por el RPC (saldo de B: -100.00).
async function ObtenerContexto() {
  if (!contexto) {
    const cuentaA = await ObtenerCuentaUsuario(usuarioA.idUsuario);
    const cuentaB = await ObtenerCuentaUsuario(usuarioB.idUsuario);
    const { data: categoriasA, error } = await usuarioA.cliente
      .from('bat_categorias')
      .select('id, tipo, es_por_defecto');
    if (error) throw new Error(`No se pudieron leer las categorías de A: ${error.message}`);

    const idMercadoB = await CargarCategoria(cuentaB.id, 'Mercado', 'GASTO');
    const { data: idMovimientoB, error: errorB } = await AgregarMovimiento(
      usuarioB.cliente, 'GASTO', '100', idMercadoB, '2026-10-01',
    );
    if (errorB) throw new Error(`No se pudo crear el movimiento de B: ${errorB.message}`);

    contexto = {
      idCuentaA: cuentaA.id,
      idCuentaB: cuentaB.id,
      idPagoRealizadoA: categoriasA.find((c) => c.tipo === 'GASTO' && c.es_por_defecto).id,
      idPagoIngresadoA: categoriasA.find((c) => c.tipo === 'INGRESO' && c.es_por_defecto).id,
      idTransporteA: await CargarCategoria(cuentaA.id, 'Transporte', 'GASTO'),
      idMercadoA: await CargarCategoria(cuentaA.id, 'Mercado', 'GASTO'),
      idSueldoA: await CargarCategoria(cuentaA.id, 'Sueldo', 'INGRESO'),
      idMercadoB,
      idMovimientoB,
    };
  }
  return contexto;
}

function AgregarMovimiento(cliente, tipo, monto, idCategoria, fecha) {
  return cliente.rpc('basp_agregar_movimiento', {
    p_tipo: tipo,
    p_monto: monto,
    p_id_categoria: idCategoria,
    p_fecha: fecha,
  });
}

function EditarMovimiento(cliente, idMovimiento, tipo, monto, idCategoria, fecha) {
  return cliente.rpc('basp_editar_movimiento', {
    p_id_movimiento: idMovimiento,
    p_tipo: tipo,
    p_monto: monto,
    p_id_categoria: idCategoria,
    p_fecha: fecha,
  });
}

// Deja la cuenta de A sin movimientos, con el saldo indicado, y le carga con la service role los
// movimientos indicados (sin tocar el saldo). Devuelve sus ids en el mismo orden.
async function PrepararCuentaA(saldo, movimientos = []) {
  const { idCuentaA } = await ObtenerContexto();
  await ReiniciarCuenta(idCuentaA, saldo);
  if (movimientos.length === 0) return [];
  const filas = movimientos.map((movimiento) => ({
    id: randomUUID(),
    id_cuenta: idCuentaA,
    ...movimiento,
  }));
  const { error } = await CrearClienteAdministrador().from('bat_movimientos').insert(filas);
  if (error) throw new Error(`No se pudieron cargar los movimientos de prueba: ${error.message}`);
  return filas.map((fila) => fila.id);
}

// Gasto de 3000 en "Transporte" del 17/09/2026 con saldo 10000.00: el caso base de la spec.
async function PrepararGastoTransporte() {
  const { idTransporteA } = await ObtenerContexto();
  const [idMovimiento] = await PrepararCuentaA('10000.00', [
    { id_categoria: idTransporteA, tipo: 'GASTO', monto: '3000.00', fecha: '2026-09-17' },
  ]);
  return idMovimiento;
}

// Movimiento leído por la conexión directa, con creado_en como texto para comparar exacto.
async function LeerMovimiento(idMovimiento) {
  const filas = await ConsultarBaseDatos(
    `SELECT id_cuenta, id_categoria, tipo, monto::text AS monto, fecha::text AS fecha,
            creado_en::text AS creado_en
       FROM public.bat_movimientos
      WHERE id = $1`,
    [idMovimiento],
  );
  return filas[0] ?? null;
}

async function LeerSaldo(idCuenta) {
  const [fila] = await ConsultarBaseDatos(
    'SELECT round(saldo, 2)::text AS saldo FROM public.bat_cuentas WHERE id = $1',
    [idCuenta],
  );
  return fila.saldo;
}

// Saldo de la cuenta y suma de ingresos menos gastos de sus movimientos, ambos como "N.NN".
async function LeerSaldoYSuma(idCuenta) {
  const [fila] = await ConsultarBaseDatos(
    `SELECT round(c.saldo, 2)::text AS saldo,
            COALESCE(sum(CASE WHEN m.tipo = 'INGRESO' THEN m.monto ELSE -m.monto END), 0)::numeric(20,2)::text AS suma
       FROM public.bat_cuentas c
       LEFT JOIN public.bat_movimientos m ON m.id_cuenta = c.id
      WHERE c.id = $1
      GROUP BY c.saldo`,
    [idCuenta],
  );
  return fila;
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

describe('BASP_EDITAR_MOVIMIENTO', { timeout: 60000 }, () => {
  it('editar un gasto de 3000 en "Transporte" a 2000, "Mercado" y otra fecha deja el saldo en 11000.00 (AC-04)', async () => {
    const { idCuentaA, idMercadoA } = await ObtenerContexto();
    const idMovimiento = await PrepararGastoTransporte();

    const { data, error } = await EditarMovimiento(
      usuarioA.cliente, idMovimiento, 'GASTO', '2000.00', idMercadoA, '2026-09-16',
    );
    expect(error).toBeNull();
    expect(data).toBe(idMovimiento);

    expect(await LeerMovimiento(idMovimiento)).toMatchObject({
      id_cuenta: idCuentaA,
      id_categoria: idMercadoA,
      tipo: 'GASTO',
      monto: '2000.00',
      fecha: '2026-09-16',
    });
    expect(await LeerSaldo(idCuentaA)).toBe('11000.00');
  });

  it('cambiar a ingreso un gasto de 3000 con "Pago Ingresado" o con "Sueldo" deja el saldo en 16000.00 (AC-05, AC-07, FR-07)', async () => {
    const { idCuentaA, idPagoIngresadoA, idSueldoA } = await ObtenerContexto();

    for (const idCategoria of [idPagoIngresadoA, idSueldoA]) {
      const idMovimiento = await PrepararGastoTransporte();
      const { error } = await EditarMovimiento(
        usuarioA.cliente, idMovimiento, 'INGRESO', '3000.00', idCategoria, '2026-09-17',
      );
      expect(error).toBeNull();
      expect(await LeerMovimiento(idMovimiento)).toMatchObject({
        id_categoria: idCategoria,
        tipo: 'INGRESO',
        monto: '3000.00',
        fecha: '2026-09-17',
      });
      expect(await LeerSaldo(idCuentaA)).toBe('16000.00');
    }
  });

  it('editar a la fecha 1990-03-15 sin cambiar el monto deja el saldo igual (AC-30)', async () => {
    const { idCuentaA, idTransporteA } = await ObtenerContexto();
    const idMovimiento = await PrepararGastoTransporte();

    const { error } = await EditarMovimiento(
      usuarioA.cliente, idMovimiento, 'GASTO', '3000.00', idTransporteA, '1990-03-15',
    );
    expect(error).toBeNull();
    expect((await LeerMovimiento(idMovimiento)).fecha).toBe('1990-03-15');
    expect(await LeerSaldo(idCuentaA)).toBe('10000.00');
  });

  it('editar no cambia creado_en ni el orden de la lista por fecha desc, creado_en desc (AC-12, FR-13)', async () => {
    const { idMercadoA, idPagoRealizadoA } = await ObtenerContexto();
    // "Café" dado de alta antes que "Mercado", ambos el 01/10/2026.
    const [idCafe, idMercado] = await PrepararCuentaA('10000.00', [
      {
        id_categoria: idPagoRealizadoA, tipo: 'GASTO', monto: '500.00', fecha: '2026-10-01',
        creado_en: '2026-10-01T12:00:00+00:00',
      },
      {
        id_categoria: idMercadoA, tipo: 'GASTO', monto: '1500.00', fecha: '2026-10-01',
        creado_en: '2026-10-01T12:00:05+00:00',
      },
    ]);

    async function LeerOrden() {
      const { data, error } = await usuarioA.cliente
        .from('bav_movimientos')
        .select('id')
        .order('fecha', { ascending: false })
        .order('creado_en', { ascending: false })
        .order('id', { ascending: false });
      expect(error).toBeNull();
      return data.map((fila) => fila.id);
    }

    const antes = await LeerMovimiento(idCafe);
    expect(await LeerOrden()).toEqual([idMercado, idCafe]);

    const { error } = await EditarMovimiento(
      usuarioA.cliente, idCafe, 'GASTO', '750.00', idPagoRealizadoA, '2026-10-01',
    );
    expect(error).toBeNull();

    const despues = await LeerMovimiento(idCafe);
    expect(despues.monto).toBe('750.00');
    expect(despues.creado_en).toBe(antes.creado_en);
    expect(despues.id_cuenta).toBe(antes.id_cuenta);
    expect(await LeerOrden()).toEqual([idMercado, idCafe]);
  });

  it('(E2-3, E2-5) rechaza montos 0, -50, 1000000000000.00 y 10.555 con BA422 y "Sueldo" en un gasto con BA424, sin cambios (AC-13)', async () => {
    const { idCuentaA, idMercadoA, idSueldoA } = await ObtenerContexto();
    const idMovimiento = await PrepararGastoTransporte();
    const antes = await LeerMovimiento(idMovimiento);

    for (const monto of ['0', '-50', '1000000000000.00', '10.555']) {
      const { error } = await EditarMovimiento(
        usuarioA.cliente, idMovimiento, 'GASTO', monto, idMercadoA, '2026-09-16',
      );
      expect(error?.code, `monto ${monto}`).toBe('BA422');
    }
    const conSueldo = await EditarMovimiento(
      usuarioA.cliente, idMovimiento, 'GASTO', '2000.00', idSueldoA, '2026-09-16',
    );
    expect(conSueldo.error?.code).toBe('BA424');

    expect(await LeerMovimiento(idMovimiento)).toEqual(antes);
    expect(await LeerSaldo(idCuentaA)).toBe('10000.00');
  });

  it('(E2-4) rechaza una fecha dos días posterior a hoy en UTC con BA423, sin cambios (AC-14)', async () => {
    const { idCuentaA, idTransporteA } = await ObtenerContexto();
    const idMovimiento = await PrepararGastoTransporte();
    const antes = await LeerMovimiento(idMovimiento);

    const { error } = await EditarMovimiento(
      usuarioA.cliente, idMovimiento, 'GASTO', '3000.00', idTransporteA, await ObtenerFechaUtc(2),
    );
    expect(error?.code).toBe('BA423');
    expect(await LeerMovimiento(idMovimiento)).toEqual(antes);
    expect(await LeerSaldo(idCuentaA)).toBe('10000.00');
  });

  it('rechaza un id de movimiento nulo con BA400', async () => {
    const { idCuentaA, idTransporteA } = await ObtenerContexto();
    await PrepararGastoTransporte();

    const { error } = await EditarMovimiento(
      usuarioA.cliente, null, 'GASTO', '2000.00', idTransporteA, '2026-09-16',
    );
    expect(error?.code).toBe('BA400');
    expect(await LeerSaldo(idCuentaA)).toBe('10000.00');
  });

  it('(E2-2) A no puede editar un movimiento de B por su id: BA404, sin cambios en B (AC-23)', async () => {
    const { idCuentaB, idMercadoA, idMovimientoB } = await ObtenerContexto();
    await PrepararGastoTransporte();
    const antes = await LeerMovimiento(idMovimientoB);
    const saldoAntes = await LeerSaldo(idCuentaB);

    const { data, error } = await EditarMovimiento(
      usuarioA.cliente, idMovimientoB, 'GASTO', '1.00', idMercadoA, '2026-09-16',
    );
    expect(data).toBeNull();
    expect(error?.code).toBe('BA404');

    expect(await LeerMovimiento(idMovimientoB)).toEqual(antes);
    expect(await LeerSaldo(idCuentaB)).toBe(saldoAntes);
  });

  it('(E2-2) un id inexistente devuelve el mismo código que un id ajeno', async () => {
    const { idCuentaA, idMercadoA, idMovimientoB } = await ObtenerContexto();
    await PrepararGastoTransporte();

    const ajeno = await EditarMovimiento(
      usuarioA.cliente, idMovimientoB, 'GASTO', '1.00', idMercadoA, '2026-09-16',
    );
    const inexistente = await EditarMovimiento(
      usuarioA.cliente, randomUUID(), 'GASTO', '1.00', idMercadoA, '2026-09-16',
    );
    expect(inexistente.error?.code).toBe('BA404');
    expect(inexistente.error?.code).toBe(ajeno.error?.code);
    expect(inexistente.error?.message).toBe(ajeno.error?.message);
    expect(await LeerSaldo(idCuentaA)).toBe('10000.00');
  });

  it('(E2-5) A no puede asignar a su movimiento una categoría de B: BA424, sin cambios en A ni en B (AC-24)', async () => {
    const { idCuentaA, idCuentaB, idMercadoB } = await ObtenerContexto();
    const idMovimiento = await PrepararGastoTransporte();
    const antes = await LeerMovimiento(idMovimiento);
    const saldoAntesB = await LeerSaldo(idCuentaB);

    const { error } = await EditarMovimiento(
      usuarioA.cliente, idMovimiento, 'GASTO', '2000.00', idMercadoB, '2026-09-16',
    );
    expect(error?.code).toBe('BA424');

    expect(await LeerMovimiento(idMovimiento)).toEqual(antes);
    expect(await LeerSaldo(idCuentaA)).toBe('10000.00');
    expect(await LeerSaldo(idCuentaB)).toBe(saldoAntesB);
  });

  it('(E2-6) con la falla EDITAR_MOVIMIENTO activa, editar el monto o el tipo devuelve BA500 y no deja nada a medias (AC-25)', async () => {
    const { idCuentaA, idMercadoA, idPagoIngresadoA } = await ObtenerContexto();
    const idMovimiento = await PrepararGastoTransporte();
    const antes = await LeerMovimiento(idMovimiento);

    await ActivarFallaSimulada(usuarioA.idUsuario, 'EDITAR_MOVIMIENTO');
    try {
      const aMonto = await EditarMovimiento(
        usuarioA.cliente, idMovimiento, 'GASTO', '2000.00', idMercadoA, '2026-09-16',
      );
      expect(aMonto.error?.code).toBe('BA500');
      const aIngreso = await EditarMovimiento(
        usuarioA.cliente, idMovimiento, 'INGRESO', '3000.00', idPagoIngresadoA, '2026-09-17',
      );
      expect(aIngreso.error?.code).toBe('BA500');
    } finally {
      await DesactivarFallaSimulada(usuarioA.idUsuario);
    }

    expect(await LeerMovimiento(idMovimiento)).toEqual(antes);
    expect(antes.monto).toBe('3000.00');
    expect(await LeerSaldo(idCuentaA)).toBe('10000.00');
  });

  it('20 altas y 20 ediciones intercaladas (10 con cambio de tipo) mantienen saldo = Σ ingresos − Σ gastos (AC-26)', { timeout: 180000 }, async () => {
    const { idCuentaA, idPagoRealizadoA, idPagoIngresadoA } = await ObtenerContexto();
    await PrepararCuentaA('0.00');

    const categoriaPorTipo = { INGRESO: idPagoIngresadoA, GASTO: idPagoRealizadoA };
    const altas = [
      ['INGRESO', '1500.50'], ['GASTO', '200.25'], ['INGRESO', '0.01'], ['GASTO', '999.99'],
      ['INGRESO', '35000'], ['GASTO', '12.10'], ['INGRESO', '0.99'], ['GASTO', '40000.00'],
      ['INGRESO', '250.75'], ['GASTO', '3.33'], ['INGRESO', '7.77'], ['GASTO', '0.10'],
      ['INGRESO', '123456.78'], ['GASTO', '654.32'], ['INGRESO', '10'], ['GASTO', '88888.88'],
      ['INGRESO', '0.02'], ['GASTO', '1.01'], ['INGRESO', '42.42'], ['GASTO', '29999.99'],
    ];
    // Después de cada alta i se edita el movimiento indicado; las ediciones pares cambian el tipo.
    const ediciones = [
      [0, '1499.49'], [1, '300.00'], [0, '0.50'], [3, '1000.00'], [2, '45000.10'],
      [5, '12.10'], [4, '0.01'], [7, '39999.99'], [8, '250.76'], [6, '3.34'],
      [10, '7.70'], [11, '0.11'], [12, '0.03'], [9, '654.33'], [14, '10.01'],
      [15, '88888.89'], [16, '0.04'], [13, '1.02'], [18, '42.41'], [19, '29999.98'],
    ];

    const movimientos = [];
    let esperadoCentavos = 0n;
    const CalcularEfectoCentavos = ({ tipo, monto }) =>
      tipo === 'INGRESO' ? ConvertirACentavos(monto) : -ConvertirACentavos(monto);

    async function VerificarInvariante(descripcion) {
      const { saldo, suma } = await LeerSaldoYSuma(idCuentaA);
      expect(saldo, descripcion).toBe(FormatearCentavos(esperadoCentavos));
      expect(saldo, descripcion).toBe(suma);
    }

    for (let indice = 0; indice < altas.length; indice += 1) {
      const [tipo, monto] = altas[indice];
      const { data: idMovimiento, error } = await AgregarMovimiento(
        usuarioA.cliente, tipo, monto, categoriaPorTipo[tipo], '2026-10-01',
      );
      expect(error, `alta ${indice}`).toBeNull();
      movimientos.push({ id: idMovimiento, tipo, monto });
      esperadoCentavos += CalcularEfectoCentavos({ tipo, monto });
      await VerificarInvariante(`alta ${indice}`);

      const [indiceEditado, montoNuevo] = ediciones[indice];
      const anterior = movimientos[indiceEditado];
      const cambiaTipo = indice % 2 === 0;
      const tipoNuevo = cambiaTipo ? (anterior.tipo === 'INGRESO' ? 'GASTO' : 'INGRESO') : anterior.tipo;
      const { error: errorEdicion } = await EditarMovimiento(
        usuarioA.cliente, anterior.id, tipoNuevo, montoNuevo, categoriaPorTipo[tipoNuevo], '2026-10-02',
      );
      expect(errorEdicion, `edición ${indice}`).toBeNull();
      esperadoCentavos += CalcularEfectoCentavos({ tipo: tipoNuevo, monto: montoNuevo }) - CalcularEfectoCentavos(anterior);
      movimientos[indiceEditado] = { id: anterior.id, tipo: tipoNuevo, monto: montoNuevo };
      await VerificarInvariante(`edición ${indice}`);
    }
  });

  it('(E2-7) después de editar, un UPDATE directo del saldo con la sesión del usuario es rechazado (AC-33)', async () => {
    const { idCuentaA, idMercadoA } = await ObtenerContexto();
    const idMovimiento = await PrepararGastoTransporte();

    const edicion = await EditarMovimiento(
      usuarioA.cliente, idMovimiento, 'GASTO', '2000.00', idMercadoA, '2026-09-16',
    );
    expect(edicion.error).toBeNull();
    expect(await LeerSaldo(idCuentaA)).toBe('11000.00');

    const { error } = await usuarioA.cliente
      .from('bat_cuentas')
      .update({ saldo: '1000000' })
      .eq('id', idCuentaA);
    expect(error?.code).toBe('42501');
    expect(await LeerSaldo(idCuentaA)).toBe('11000.00');
  });

  it('(E2-1) la llamada sin sesión es rechazada: por la API sin EXECUTE y en la base con BA401', async () => {
    const { idCuentaA, idTransporteA } = await ObtenerContexto();
    const idMovimiento = await PrepararGastoTransporte();
    const antes = await LeerMovimiento(idMovimiento);

    const { data, error } = await EditarMovimiento(
      CrearClienteAnonimo(), idMovimiento, 'GASTO', '1.00', idTransporteA, '2026-09-16',
    );
    expect(data).toBeNull();
    expect(error?.code).toBe('42501');

    // Directo en la base, sin claims de JWT: auth.uid() es nulo. Se revierte por las dudas.
    const codigo = await EjecutarEnTransaccionRevertida(async (Consultar) => {
      try {
        await Consultar(
          'SELECT public.basp_editar_movimiento($1, $2, $3, $4, $5)',
          [idMovimiento, 'GASTO', '1.00', idTransporteA, '2026-09-16'],
        );
        return null;
      } catch (errorBase) {
        return errorBase.code;
      }
    });
    expect(codigo).toBe('BA401');

    expect(await LeerMovimiento(idMovimiento)).toEqual(antes);
    expect(await LeerSaldo(idCuentaA)).toBe('10000.00');
  });
});

describe('BAV_MOVIMIENTOS con id_categoria', { timeout: 60000 }, () => {
  it('devuelve id_categoria del movimiento propio', async () => {
    const { idTransporteA } = await ObtenerContexto();
    const idMovimiento = await PrepararGastoTransporte();

    const { data, error } = await usuarioA.cliente
      .from('bav_movimientos')
      .select('id, fecha, tipo, monto, id_categoria')
      .eq('id', idMovimiento);
    expect(error).toBeNull();
    expect(data).toEqual([
      {
        id: idMovimiento,
        fecha: '2026-09-17',
        tipo: 'GASTO',
        monto: '3000.00',
        id_categoria: idTransporteA,
      },
    ]);
  });
});
