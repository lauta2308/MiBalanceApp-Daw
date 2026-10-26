// Trigger de registro BATR_CREAR_CUENTA_USUARIO y permisos de solo lectura sobre la cuenta y las
// categorías (spec FEAT-001a, Block 2).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CargarCategoria,
  ConsultarBaseDatos,
  CrearClienteAdministrador,
  CrearUsuarioPrueba,
  EliminarUsuariosPrueba,
  ObtenerCuentaUsuario,
  CerrarConexionesBaseDatos,
} from './utilidades/clientesPrueba.js';

const idsUsuariosCreados = [];
let usuario;

beforeAll(async () => {
  usuario = await CrearUsuarioPrueba();
  idsUsuariosCreados.push(usuario.idUsuario);
});

afterAll(async () => {
  try {
    await EliminarUsuariosPrueba(idsUsuariosCreados);
  } finally {
    await CerrarConexionesBaseDatos();
  }
});

async function LeerCategoriasComoAdministrador(idCuenta) {
  const { data, error } = await CrearClienteAdministrador()
    .from('bat_categorias')
    .select('id, nombre, tipo, es_por_defecto')
    .eq('id_cuenta', idCuenta)
    .order('nombre');
  expect(error).toBeNull();
  return data;
}

async function ObtenerCategoriaPorDefecto(idCuenta, tipo) {
  const categorias = await LeerCategoriasComoAdministrador(idCuenta);
  return categorias.find((categoria) => categoria.tipo === tipo && categoria.es_por_defecto);
}

describe('registro de un usuario nuevo', { timeout: 60000 }, () => {
  it('crea 1 cuenta "Mi Cuenta" en USD con saldo "0.00" y las 2 categorías por defecto (AC-07)', async () => {
    const { data: cuentas, error } = await usuario.cliente
      .from('bav_cuenta')
      .select('id, nombre, moneda, saldo');
    expect(error).toBeNull();
    expect(cuentas).toHaveLength(1);
    expect(cuentas[0]).toMatchObject({ nombre: 'Mi Cuenta', moneda: 'USD', saldo: '0.00' });

    const { data: categorias, error: errorCategorias } = await usuario.cliente
      .from('bat_categorias')
      .select('nombre, tipo, es_por_defecto')
      .order('nombre');
    expect(errorCategorias).toBeNull();
    expect(categorias).toEqual([
      { nombre: 'Pago Ingresado', tipo: 'INGRESO', es_por_defecto: true },
      { nombre: 'Pago Realizado', tipo: 'GASTO', es_por_defecto: true },
    ]);
  });

  it('rechaza crear una segunda cuenta desde la API y sigue habiendo 1 (AC-08)', async () => {
    const { error } = await usuario.cliente
      .from('bat_cuentas')
      .insert({ id_usuario: usuario.idUsuario, nombre: 'Otra Cuenta' });
    expect(error?.code).toBe('42501');

    const { count, error: errorConteo } = await CrearClienteAdministrador()
      .from('bat_cuentas')
      .select('id', { count: 'exact', head: true })
      .eq('id_usuario', usuario.idUsuario);
    expect(errorConteo).toBeNull();
    expect(count).toBe(1);
  });

  it('rechaza renombrar, cambiar el tipo o eliminar las categorías por defecto (AC-09)', async () => {
    const cuenta = await ObtenerCuentaUsuario(usuario.idUsuario);
    const pagoRealizado = await ObtenerCategoriaPorDefecto(cuenta.id, 'GASTO');
    const pagoIngresado = await ObtenerCategoriaPorDefecto(cuenta.id, 'INGRESO');

    for (const categoria of [pagoRealizado, pagoIngresado]) {
      const renombrar = await usuario.cliente
        .from('bat_categorias')
        .update({ nombre: 'Otra' })
        .eq('id', categoria.id);
      expect(renombrar.error?.code).toBe('42501');

      const cambiarTipo = await usuario.cliente
        .from('bat_categorias')
        .update({ tipo: categoria.tipo === 'GASTO' ? 'INGRESO' : 'GASTO' })
        .eq('id', categoria.id);
      expect(cambiarTipo.error?.code).toBe('42501');

      const eliminar = await usuario.cliente.from('bat_categorias').delete().eq('id', categoria.id);
      expect(eliminar.error?.code).toBe('42501');
    }

    const categorias = await LeerCategoriasComoAdministrador(cuenta.id);
    expect(categorias).toEqual([
      { id: pagoIngresado.id, nombre: 'Pago Ingresado', tipo: 'INGRESO', es_por_defecto: true },
      { id: pagoRealizado.id, nombre: 'Pago Realizado', tipo: 'GASTO', es_por_defecto: true },
    ]);
  });

  it('rechaza crear "Viajes", renombrar "Mercado" y eliminar "Mercado" desde la API (AC-68)', async () => {
    const cuenta = await ObtenerCuentaUsuario(usuario.idUsuario);
    const idMercado = await CargarCategoria(cuenta.id, 'Mercado', 'GASTO');

    const crear = await usuario.cliente
      .from('bat_categorias')
      .insert({ id_cuenta: cuenta.id, nombre: 'Viajes', tipo: 'GASTO' });
    expect(crear.error?.code).toBe('42501');

    const renombrar = await usuario.cliente
      .from('bat_categorias')
      .update({ nombre: 'Otra' })
      .eq('id', idMercado);
    expect(renombrar.error?.code).toBe('42501');

    const eliminar = await usuario.cliente.from('bat_categorias').delete().eq('id', idMercado);
    expect(eliminar.error?.code).toBe('42501');

    const nombres = (await LeerCategoriasComoAdministrador(cuenta.id)).map((c) => c.nombre);
    expect(nombres).toEqual(['Mercado', 'Pago Ingresado', 'Pago Realizado']);
  });

  it('rechaza cambiar el nombre, la moneda y el saldo de la cuenta (AC-69)', async () => {
    const cuenta = await ObtenerCuentaUsuario(usuario.idUsuario);
    const cambios = [{ nombre: '' }, { moneda: 'ARS' }, { saldo: '1000000' }];

    for (const cambio of cambios) {
      const { error } = await usuario.cliente.from('bat_cuentas').update(cambio).eq('id', cuenta.id);
      expect(error?.code).toBe('42501');
    }

    const { data, error } = await usuario.cliente
      .from('bav_cuenta')
      .select('nombre, moneda, saldo');
    expect(error).toBeNull();
    expect(data).toEqual([{ nombre: 'Mi Cuenta', moneda: 'USD', saldo: '0.00' }]);
  });

  it('el trigger es AFTER INSERT FOR EACH ROW y no diferido, y ningún usuario creado queda sin cuenta (E2-10)', async () => {
    const triggers = await ConsultarBaseDatos(
      `SELECT t.tgtype, t.tgenabled, t.tgdeferrable, t.tginitdeferred, t.tgconstraint::int AS id_restriccion,
              p.proname AS funcion
         FROM pg_trigger t
         JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE t.tgrelid = 'auth.users'::regclass
          AND t.tgname = 'batr_crear_cuenta_usuario'`,
    );
    expect(triggers).toHaveLength(1);
    const [trigger] = triggers;
    // tgtype: bit 0 = FOR EACH ROW, bit 1 = BEFORE, bit 2 = INSERT, bit 6 = INSTEAD OF.
    expect(trigger.tgtype & 1).toBe(1);
    expect(trigger.tgtype & 2).toBe(0);
    expect(trigger.tgtype & 4).toBe(4);
    expect(trigger.tgtype & 64).toBe(0);
    expect(trigger.tgenabled).toBe('O');
    expect(trigger.tgdeferrable).toBe(false);
    expect(trigger.tginitdeferred).toBe(false);
    expect(trigger.id_restriccion).toBe(0);
    expect(trigger.funcion).toBe('batf_crear_cuenta_usuario');

    const sinCuenta = await ConsultarBaseDatos(
      `SELECT u.id
         FROM auth.users u
         LEFT JOIN public.bat_cuentas c ON c.id_usuario = u.id
        WHERE u.id = ANY($1::uuid[])
          AND c.id IS NULL`,
      [idsUsuariosCreados],
    );
    expect(sinCuenta).toEqual([]);
  });
});
