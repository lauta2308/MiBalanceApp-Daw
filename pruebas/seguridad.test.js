// RLS y permisos: un usuario (A) no puede leer ni escribir datos de otro (B) ni escribir
// directamente los propios (spec FEAT-001a, Block 2; threat model R1, R2, R4, R10). Suma los
// permisos de la edición (spec FEAT-001b, Block 2; threat model de FEAT-001b R2, R7).

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CargarCategoria,
  ConsultarBaseDatos,
  CrearClienteAdministrador,
  CrearClienteAnonimo,
  CrearUsuarioPrueba,
  EliminarUsuariosPrueba,
  ObtenerCuentaUsuario,
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

function AgregarMovimiento(cliente, tipo, monto, idCategoria, fecha) {
  return cliente.rpc('basp_agregar_movimiento', {
    p_tipo: tipo,
    p_monto: monto,
    p_id_categoria: idCategoria,
    p_fecha: fecha,
  });
}

// A con un ingreso de 500 y B con la categoría "Mercado" y un gasto de 100 en ella.
async function ObtenerContexto() {
  if (!contexto) {
    const cuentaA = await ObtenerCuentaUsuario(usuarioA.idUsuario);
    const cuentaB = await ObtenerCuentaUsuario(usuarioB.idUsuario);
    const idMercadoB = await CargarCategoria(cuentaB.id, 'Mercado', 'GASTO');
    const { data: idMovimientoB, error } = await AgregarMovimiento(
      usuarioB.cliente, 'GASTO', '100', idMercadoB, '2026-10-01',
    );
    if (error) throw new Error(`No se pudo crear el movimiento de B: ${error.message}`);

    const { data: categoriasA } = await usuarioA.cliente
      .from('bat_categorias')
      .select('id, tipo, es_por_defecto');
    const idPagoIngresadoA = categoriasA.find((c) => c.tipo === 'INGRESO' && c.es_por_defecto).id;
    const { data: idMovimientoA, error: errorA } = await AgregarMovimiento(
      usuarioA.cliente, 'INGRESO', '500', idPagoIngresadoA, '2026-10-01',
    );
    if (errorA) throw new Error(`No se pudo crear el movimiento de A: ${errorA.message}`);

    contexto = {
      idCuentaA: cuentaA.id,
      idCuentaB: cuentaB.id,
      idMercadoB,
      idMovimientoB,
      idPagoIngresadoA,
      idMovimientoA,
    };
  }
  return contexto;
}

// Foto de los datos de una cuenta, leída con la service role.
async function LeerDatosCuenta(idCuenta) {
  const administrador = CrearClienteAdministrador();
  const cuenta = await administrador
    .from('bat_cuentas')
    .select('id, id_usuario, nombre, moneda, saldo')
    .eq('id', idCuenta);
  const categorias = await administrador
    .from('bat_categorias')
    .select('id, nombre, tipo, es_por_defecto')
    .eq('id_cuenta', idCuenta)
    .order('id');
  const movimientos = await administrador
    .from('bat_movimientos')
    .select('id, id_categoria, tipo, monto, fecha')
    .eq('id_cuenta', idCuenta)
    .order('id');
  expect(cuenta.error).toBeNull();
  expect(categorias.error).toBeNull();
  expect(movimientos.error).toBeNull();
  return { cuenta: cuenta.data, categorias: categorias.data, movimientos: movimientos.data };
}

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

describe('aislamiento entre usuarios', { timeout: 60000 }, () => {
  it('(E2-9) A recibe 0 filas al consultar la cuenta, las categorías y los movimientos de B (AC-51)', async () => {
    const { idCuentaB, idMercadoB, idMovimientoB } = await ObtenerContexto();

    const cuenta = await usuarioA.cliente.from('bav_cuenta').select('id').eq('id', idCuentaB);
    expect(cuenta.error).toBeNull();
    expect(cuenta.data).toEqual([]);

    const categorias = await usuarioA.cliente
      .from('bat_categorias')
      .select('id')
      .eq('id_cuenta', idCuentaB);
    expect(categorias.error).toBeNull();
    expect(categorias.data).toEqual([]);

    const categoria = await usuarioA.cliente.from('bat_categorias').select('id').eq('id', idMercadoB);
    expect(categoria.error).toBeNull();
    expect(categoria.data).toEqual([]);

    const movimientos = await usuarioA.cliente
      .from('bav_movimientos')
      .select('id')
      .eq('id_cuenta', idCuentaB);
    expect(movimientos.error).toBeNull();
    expect(movimientos.data).toEqual([]);

    const movimiento = await usuarioA.cliente
      .from('bav_movimientos')
      .select('id')
      .eq('id', idMovimientoB);
    expect(movimiento.error).toBeNull();
    expect(movimiento.data).toEqual([]);

    // Las tablas base tampoco filtran datos de B.
    const cuentasBase = await usuarioA.cliente.from('bat_cuentas').select('id').eq('id', idCuentaB);
    expect(cuentasBase.error).toBeNull();
    expect(cuentasBase.data).toEqual([]);
    const movimientosBase = await usuarioA.cliente
      .from('bat_movimientos')
      .select('id')
      .eq('id_cuenta', idCuentaB);
    expect(movimientosBase.error).toBeNull();
    expect(movimientosBase.data).toEqual([]);
  });

  it('(E2-8) A no puede editar ni eliminar la cuenta, una categoría ni un movimiento de B (AC-52)', async () => {
    const { idCuentaB, idMercadoB, idMovimientoB } = await ObtenerContexto();
    const antes = await LeerDatosCuenta(idCuentaB);

    const intentos = [
      usuarioA.cliente.from('bat_cuentas').update({ nombre: 'Robada' }).eq('id', idCuentaB),
      usuarioA.cliente.from('bat_cuentas').update({ saldo: '0' }).eq('id', idCuentaB),
      usuarioA.cliente.from('bat_cuentas').delete().eq('id', idCuentaB),
      usuarioA.cliente.from('bat_categorias').update({ nombre: 'Otra' }).eq('id', idMercadoB),
      usuarioA.cliente.from('bat_categorias').delete().eq('id', idMercadoB),
      usuarioA.cliente.from('bat_movimientos').update({ monto: '1' }).eq('id', idMovimientoB),
      usuarioA.cliente.from('bat_movimientos').delete().eq('id', idMovimientoB),
    ];
    for (const intento of intentos) {
      const { error } = await intento;
      expect(error?.code).toBe('42501');
    }

    expect(await LeerDatosCuenta(idCuentaB)).toEqual(antes);
  });

  it('(E2-6) A no puede crear un movimiento con la categoría de B ni insertar en la cuenta de B (AC-53)', async () => {
    const { idCuentaA, idCuentaB, idMercadoB } = await ObtenerContexto();
    const antesA = await LeerDatosCuenta(idCuentaA);
    const antesB = await LeerDatosCuenta(idCuentaB);

    const conCategoriaAjena = await AgregarMovimiento(
      usuarioA.cliente, 'GASTO', '100', idMercadoB, '2026-10-01',
    );
    expect(conCategoriaAjena.error?.code).toBe('BA424');

    const insercionDirecta = await usuarioA.cliente.from('bat_movimientos').insert({
      id_cuenta: idCuentaB,
      id_categoria: idMercadoB,
      tipo: 'GASTO',
      monto: '100',
      fecha: '2026-10-01',
    });
    expect(insercionDirecta.error?.code).toBe('42501');

    expect(await LeerDatosCuenta(idCuentaA)).toEqual(antesA);
    expect(await LeerDatosCuenta(idCuentaB)).toEqual(antesB);
  });

  it('(E2-8) A no puede cambiar su saldo ni escribir directamente sus movimientos (AC-54)', async () => {
    const { idCuentaA, idPagoIngresadoA, idMovimientoA } = await ObtenerContexto();
    const antes = await LeerDatosCuenta(idCuentaA);

    const intentos = [
      usuarioA.cliente.from('bat_cuentas').update({ saldo: '1000000' }).eq('id', idCuentaA),
      usuarioA.cliente.from('bat_movimientos').insert({
        id_cuenta: idCuentaA,
        id_categoria: idPagoIngresadoA,
        tipo: 'INGRESO',
        monto: '100',
        fecha: '2026-10-01',
      }),
      usuarioA.cliente.from('bat_movimientos').update({ monto: '9999' }).eq('id', idMovimientoA),
      usuarioA.cliente.from('bat_movimientos').delete().eq('id', idMovimientoA),
    ];
    for (const intento of intentos) {
      const { error } = await intento;
      expect(error?.code).toBe('42501');
    }

    expect(await LeerDatosCuenta(idCuentaA)).toEqual(antes);
    const { saldo, suma } = await LeerSaldoYSuma(idCuentaA);
    expect(saldo).toBe('500.00');
    expect(saldo).toBe(suma);
  });

  it('(E2-8) A no puede leer ni escribir pruebas.bat_fallas_simuladas ni ejecutar batf_crear_cuenta_usuario', async () => {
    // Desde la API: el esquema pruebas no está expuesto y la función de trigger no se puede llamar.
    const lectura = await usuarioA.cliente.schema('pruebas').from('bat_fallas_simuladas').select('*');
    expect(lectura.error).not.toBeNull();
    const escritura = await usuarioA.cliente
      .schema('pruebas')
      .from('bat_fallas_simuladas')
      .insert({ id_usuario: usuarioA.idUsuario, punto: 'AGREGAR_MOVIMIENTO' });
    expect(escritura.error).not.toBeNull();
    const ejecucion = await usuarioA.cliente.rpc('batf_crear_cuenta_usuario');
    expect(ejecucion.error).not.toBeNull();

    // En la base: los roles de la API no tienen ningún privilegio sobre esos objetos.
    const [privilegios] = await ConsultarBaseDatos(
      `SELECT has_schema_privilege('authenticated', 'pruebas', 'USAGE') AS usa_esquema_authenticated,
              has_schema_privilege('anon', 'pruebas', 'USAGE') AS usa_esquema_anon,
              has_table_privilege('authenticated', 'pruebas.bat_fallas_simuladas', 'SELECT, INSERT, UPDATE, DELETE') AS tabla_authenticated,
              has_table_privilege('anon', 'pruebas.bat_fallas_simuladas', 'SELECT, INSERT, UPDATE, DELETE') AS tabla_anon,
              has_function_privilege('authenticated', 'public.batf_crear_cuenta_usuario()', 'EXECUTE') AS trigger_authenticated,
              has_function_privilege('anon', 'public.batf_crear_cuenta_usuario()', 'EXECUTE') AS trigger_anon,
              has_function_privilege('anon', 'public.basp_agregar_movimiento(text, numeric, uuid, date)', 'EXECUTE') AS alta_anon,
              has_function_privilege('authenticated', 'public.basp_agregar_movimiento(text, numeric, uuid, date)', 'EXECUTE') AS alta_authenticated`,
    );
    expect(privilegios).toEqual({
      usa_esquema_authenticated: false,
      usa_esquema_anon: false,
      tabla_authenticated: false,
      tabla_anon: false,
      trigger_authenticated: false,
      trigger_anon: false,
      alta_anon: false,
      alta_authenticated: true,
    });
  });

  it('(R2, R4) los roles de la API solo tienen SELECT sobre tablas y vistas, y las vistas usan security_invoker', async () => {
    const privilegios = await ConsultarBaseDatos(
      `SELECT grantee, table_name, privilege_type
         FROM information_schema.role_table_grants
        WHERE table_schema = 'public'
          AND table_name IN ('bat_cuentas', 'bat_categorias', 'bat_movimientos', 'bav_cuenta', 'bav_movimientos')
          AND grantee IN ('anon', 'authenticated')
        ORDER BY grantee, table_name, privilege_type`,
    );
    expect(privilegios).toEqual(
      ['bat_categorias', 'bat_cuentas', 'bat_movimientos', 'bav_cuenta', 'bav_movimientos'].map(
        (tabla) => ({ grantee: 'authenticated', table_name: tabla, privilege_type: 'SELECT' }),
      ),
    );

    const vistas = await ConsultarBaseDatos(
      `SELECT c.relname, c.reloptions
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname IN ('bav_cuenta', 'bav_movimientos')
        ORDER BY c.relname`,
    );
    expect(vistas).toEqual([
      { relname: 'bav_cuenta', reloptions: ['security_invoker=true'] },
      { relname: 'bav_movimientos', reloptions: ['security_invoker=true'] },
    ]);

    const tablasConRls = await ConsultarBaseDatos(
      `SELECT n.nspname || '.' || c.relname AS tabla, c.relrowsecurity AS rls
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE (n.nspname = 'public' AND c.relname IN ('bat_cuentas', 'bat_categorias', 'bat_movimientos'))
           OR (n.nspname = 'pruebas' AND c.relname = 'bat_fallas_simuladas')
        ORDER BY 1`,
    );
    expect(tablasConRls).toEqual([
      { tabla: 'pruebas.bat_fallas_simuladas', rls: true },
      { tabla: 'public.bat_categorias', rls: true },
      { tabla: 'public.bat_cuentas', rls: true },
      { tabla: 'public.bat_movimientos', rls: true },
    ]);
  });

  it('(E2-8 de FEAT-001b, R2, R7) solo authenticated ejecuta basp_editar_movimiento y la vista sigue sin devolver movimientos ajenos', async () => {
    const { idMovimientoB, idMovimientoA } = await ObtenerContexto();

    const [privilegios] = await ConsultarBaseDatos(
      `SELECT has_function_privilege('anon', 'public.basp_editar_movimiento(uuid, text, numeric, uuid, date)', 'EXECUTE') AS edicion_anon,
              has_function_privilege('service_role', 'public.basp_editar_movimiento(uuid, text, numeric, uuid, date)', 'EXECUTE') AS edicion_service_role,
              has_function_privilege('authenticated', 'public.basp_editar_movimiento(uuid, text, numeric, uuid, date)', 'EXECUTE') AS edicion_authenticated`,
    );
    expect(privilegios).toEqual({
      edicion_anon: false,
      edicion_service_role: false,
      edicion_authenticated: true,
    });

    // Desde la API: anon y service_role no pueden llamarla.
    const parametros = {
      p_id_movimiento: idMovimientoA,
      p_tipo: 'INGRESO',
      p_monto: '1.00',
      p_id_categoria: randomUUID(),
      p_fecha: '2026-10-01',
    };
    const comoAnon = await CrearClienteAnonimo().rpc('basp_editar_movimiento', parametros);
    expect(comoAnon.error?.code).toBe('42501');
    const comoServiceRole = await CrearClienteAdministrador().rpc('basp_editar_movimiento', parametros);
    expect(comoServiceRole.error?.code).toBe('42501');

    // La vista, ya con id_categoria, conserva security_invoker y no devuelve el movimiento de B.
    const [vista] = await ConsultarBaseDatos(
      `SELECT c.reloptions
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'bav_movimientos'`,
    );
    expect(vista.reloptions).toEqual(['security_invoker=true']);
    const ajeno = await usuarioA.cliente
      .from('bav_movimientos')
      .select('id, id_categoria')
      .eq('id', idMovimientoB);
    expect(ajeno.error).toBeNull();
    expect(ajeno.data).toEqual([]);
  });

  it('(R10) la service role solo tiene los privilegios que usan las pruebas y ninguno sobre el esquema pruebas', async () => {
    const privilegios = await ConsultarBaseDatos(
      `SELECT table_name, privilege_type
         FROM information_schema.role_table_grants
        WHERE table_schema = 'public'
          AND table_name IN ('bat_cuentas', 'bat_categorias', 'bat_movimientos', 'bav_cuenta', 'bav_movimientos')
          AND grantee = 'service_role'
        ORDER BY table_name, privilege_type`,
    );
    expect(privilegios).toEqual([
      { table_name: 'bat_categorias', privilege_type: 'INSERT' },
      { table_name: 'bat_categorias', privilege_type: 'SELECT' },
      { table_name: 'bat_cuentas', privilege_type: 'DELETE' },
      { table_name: 'bat_cuentas', privilege_type: 'SELECT' },
      { table_name: 'bat_cuentas', privilege_type: 'UPDATE' },
      { table_name: 'bat_movimientos', privilege_type: 'DELETE' },
      { table_name: 'bat_movimientos', privilege_type: 'INSERT' },
      { table_name: 'bat_movimientos', privilege_type: 'SELECT' },
    ]);

    const [pruebas] = await ConsultarBaseDatos(
      `SELECT has_schema_privilege('service_role', 'pruebas', 'USAGE') AS usa_esquema,
              has_table_privilege('service_role', 'pruebas.bat_fallas_simuladas', 'SELECT, INSERT, UPDATE, DELETE') AS tabla`,
    );
    expect(pruebas).toEqual({ usa_esquema: false, tabla: false });

    const funciones = await ConsultarBaseDatos(
      `SELECT has_function_privilege('service_role', 'public.batf_crear_cuenta_usuario()', 'EXECUTE') AS crear_cuenta,
              has_function_privilege('service_role', 'public.basp_agregar_movimiento(text, numeric, uuid, date)', 'EXECUTE') AS agregar_movimiento`,
    );
    expect(funciones).toEqual([{ crear_cuenta: false, agregar_movimiento: false }]);
  });
});
