// Eliminación atómica de movimientos con BASP_ELIMINAR_MOVIMIENTO (spec FEAT-001c, Block 1;
// threat model R1, R3, R4).
//
// Usa dos usuarios (A elimina, B es el ajeno) para gastar pocos inicios anónimos. Cada prueba deja la
// cuenta de A como la necesita con ReiniciarCuenta y carga sus movimientos con la service role.
// Las eliminaciones van solo por el RPC, con la sesión de A. El saldo, los movimientos y la falla
// simulada se leen y escriben por la conexión directa (ADR-002, ADR-003).

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

// Categorías por defecto y "Transporte" de A, y un gasto de B de 100 dado de alta por el RPC
// (saldo de B: -100.00).
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

function EliminarMovimiento(cliente, idMovimiento) {
  return cliente.rpc('basp_eliminar_movimiento', { p_id_movimiento: idMovimiento });
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

async function ContarMovimientos(idCuenta) {
  const [fila] = await ConsultarBaseDatos(
    'SELECT count(*)::int AS cantidad FROM public.bat_movimientos WHERE id_cuenta = $1',
    [idCuenta],
  );
  return fila.cantidad;
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

describe('BASP_ELIMINAR_MOVIMIENTO', { timeout: 60000 }, () => {
  it('eliminar un ingreso de 1000 con saldo 5000.00 borra la fila, deja el saldo en 4000.00 y devuelve su id (AC-03, FR-05)', async () => {
    const { idCuentaA, idPagoIngresadoA, idTransporteA } = await ObtenerContexto();
    const [idIngreso, idOtro] = await PrepararCuentaA('5000.00', [
      { id_categoria: idPagoIngresadoA, tipo: 'INGRESO', monto: '1000.00', fecha: '2026-10-01' },
      { id_categoria: idTransporteA, tipo: 'GASTO', monto: '200.00', fecha: '2026-10-02' },
    ]);

    const { data, error } = await EliminarMovimiento(usuarioA.cliente, idIngreso);
    expect(error).toBeNull();
    expect(data).toBe(idIngreso);

    expect(await LeerMovimiento(idIngreso)).toBeNull();
    expect(await LeerMovimiento(idOtro)).not.toBeNull();
    expect(await LeerSaldo(idCuentaA)).toBe('4000.00');
  });

  it('eliminar el único movimiento, un gasto de 500 con saldo -500.00, deja 0 movimientos y el saldo en 0.00 (AC-07)', async () => {
    const { idCuentaA, idPagoRealizadoA } = await ObtenerContexto();
    const [idGasto] = await PrepararCuentaA('-500.00', [
      { id_categoria: idPagoRealizadoA, tipo: 'GASTO', monto: '500.00', fecha: '2026-10-01' },
    ]);

    const { data, error } = await EliminarMovimiento(usuarioA.cliente, idGasto);
    expect(error).toBeNull();
    expect(data).toBe(idGasto);

    expect(await ContarMovimientos(idCuentaA)).toBe(0);
    expect(await LeerSaldo(idCuentaA)).toBe('0.00');
  });

  it('(E1-2) A no puede eliminar un movimiento de B por su id: BA404, sin cambios en B (AC-10, NFR-02)', async () => {
    const { idCuentaA, idCuentaB, idMovimientoB } = await ObtenerContexto();
    await PrepararGastoTransporte();
    const antes = await LeerMovimiento(idMovimientoB);
    const saldoAntes = await LeerSaldo(idCuentaB);
    expect(antes).not.toBeNull();

    const { data, error } = await EliminarMovimiento(usuarioA.cliente, idMovimientoB);
    expect(data).toBeNull();
    expect(error?.code).toBe('BA404');

    expect(await LeerMovimiento(idMovimientoB)).toEqual(antes);
    expect(await LeerSaldo(idCuentaB)).toBe(saldoAntes);
    expect(await LeerSaldo(idCuentaA)).toBe('10000.00');
  });

  it('(E1-2) un id inexistente devuelve el mismo código que un id ajeno', async () => {
    const { idCuentaA, idMovimientoB } = await ObtenerContexto();
    const idMovimiento = await PrepararGastoTransporte();

    const ajeno = await EliminarMovimiento(usuarioA.cliente, idMovimientoB);
    const inexistente = await EliminarMovimiento(usuarioA.cliente, randomUUID());
    expect(inexistente.data).toBeNull();
    expect(inexistente.error?.code).toBe('BA404');
    expect(inexistente.error?.code).toBe(ajeno.error?.code);
    expect(inexistente.error?.message).toBe(ajeno.error?.message);

    expect(await LeerMovimiento(idMovimiento)).not.toBeNull();
    expect(await LeerSaldo(idCuentaA)).toBe('10000.00');
  });

  it('(E1-4) con la falla ELIMINAR_MOVIMIENTO activa, eliminar un gasto de 3000 devuelve BA500 y no deja nada a medias (AC-11, NFR-03)', async () => {
    const { idCuentaA } = await ObtenerContexto();
    const idMovimiento = await PrepararGastoTransporte();
    const antes = await LeerMovimiento(idMovimiento);

    await ActivarFallaSimulada(usuarioA.idUsuario, 'ELIMINAR_MOVIMIENTO');
    try {
      const { data, error } = await EliminarMovimiento(usuarioA.cliente, idMovimiento);
      expect(data).toBeNull();
      expect(error?.code).toBe('BA500');
    } finally {
      await DesactivarFallaSimulada(usuarioA.idUsuario);
    }

    expect(await LeerMovimiento(idMovimiento)).toEqual(antes);
    expect(antes.monto).toBe('3000.00');
    expect(await LeerSaldo(idCuentaA)).toBe('10000.00');
  });

  it('20 altas, 20 ediciones (10 con cambio de tipo) y 10 eliminaciones intercaladas mantienen saldo = Σ ingresos − Σ gastos (AC-12)', { timeout: 240000 }, async () => {
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
    // Paso i: alta i; edición del movimiento i con el monto indicado (cambia el tipo en los pasos
    // 0, 1, 4, 5, 8, 9, 12, 13, 16 y 17); en los pasos impares, eliminación del movimiento i − 1,
    // que ya no se vuelve a editar. Quedan eliminados ingresos y gastos.
    const montosEditados = [
      '1499.49', '300.00', '0.50', '1000.00', '45000.10', '12.10', '0.01', '39999.99',
      '250.76', '3.34', '7.70', '0.11', '0.03', '654.33', '10.01', '88888.89',
      '0.04', '1.02', '42.41', '29999.98',
    ];

    const movimientos = [];
    let esperadoCentavos = 0n;
    let cantidadEliminaciones = 0;
    let cantidadCambiosTipo = 0;
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

      const anterior = movimientos[indice];
      const cambiaTipo = indice % 4 < 2;
      const tipoNuevo = cambiaTipo ? (anterior.tipo === 'INGRESO' ? 'GASTO' : 'INGRESO') : anterior.tipo;
      const montoNuevo = montosEditados[indice];
      const { error: errorEdicion } = await EditarMovimiento(
        usuarioA.cliente, anterior.id, tipoNuevo, montoNuevo, categoriaPorTipo[tipoNuevo], '2026-10-02',
      );
      expect(errorEdicion, `edición ${indice}`).toBeNull();
      if (cambiaTipo) cantidadCambiosTipo += 1;
      esperadoCentavos += CalcularEfectoCentavos({ tipo: tipoNuevo, monto: montoNuevo }) - CalcularEfectoCentavos(anterior);
      movimientos[indice] = { id: anterior.id, tipo: tipoNuevo, monto: montoNuevo };
      await VerificarInvariante(`edición ${indice}`);

      if (indice % 2 === 1) {
        const eliminado = movimientos[indice - 1];
        const { data: idEliminado, error: errorEliminacion } = await EliminarMovimiento(
          usuarioA.cliente, eliminado.id,
        );
        expect(errorEliminacion, `eliminación ${indice}`).toBeNull();
        expect(idEliminado, `eliminación ${indice}`).toBe(eliminado.id);
        cantidadEliminaciones += 1;
        esperadoCentavos -= CalcularEfectoCentavos(eliminado);
        await VerificarInvariante(`eliminación ${indice}`);
      }
    }

    expect(cantidadCambiosTipo).toBe(10);
    expect(cantidadEliminaciones).toBe(10);
    expect(await ContarMovimientos(idCuentaA)).toBe(10);
  });

  it('(E1-5) después de eliminar un gasto de 3000, un UPDATE directo del saldo con la sesión del usuario es rechazado (AC-16, FR-11)', async () => {
    const { idCuentaA } = await ObtenerContexto();
    const idMovimiento = await PrepararGastoTransporte();

    const eliminacion = await EliminarMovimiento(usuarioA.cliente, idMovimiento);
    expect(eliminacion.error).toBeNull();
    expect(await LeerSaldo(idCuentaA)).toBe('13000.00');

    const { error } = await usuarioA.cliente
      .from('bat_cuentas')
      .update({ saldo: '1000000' })
      .eq('id', idCuentaA);
    expect(error?.code).toBe('42501');
    expect(await LeerSaldo(idCuentaA)).toBe('13000.00');
  });

  it('(E1-3) rechaza un id de movimiento nulo con BA400, sin cambios', async () => {
    const { idCuentaA } = await ObtenerContexto();
    const idMovimiento = await PrepararGastoTransporte();

    const { data, error } = await EliminarMovimiento(usuarioA.cliente, null);
    expect(data).toBeNull();
    expect(error?.code).toBe('BA400');

    expect(await LeerMovimiento(idMovimiento)).not.toBeNull();
    expect(await LeerSaldo(idCuentaA)).toBe('10000.00');
  });

  it('(E1-1) la llamada sin sesión es rechazada: por la API sin EXECUTE y en la base con BA401', async () => {
    const { idCuentaA } = await ObtenerContexto();
    const idMovimiento = await PrepararGastoTransporte();
    const antes = await LeerMovimiento(idMovimiento);

    const { data, error } = await EliminarMovimiento(CrearClienteAnonimo(), idMovimiento);
    expect(data).toBeNull();
    expect(error?.code).toBe('42501');

    // Directo en la base, sin claims de JWT: auth.uid() es nulo. Se revierte por las dudas.
    const codigo = await EjecutarEnTransaccionRevertida(async (Consultar) => {
      try {
        await Consultar('SELECT public.basp_eliminar_movimiento($1)', [idMovimiento]);
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
