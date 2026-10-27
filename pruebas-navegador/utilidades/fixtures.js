// Fixtures y ayudantes de las pruebas en navegador (spec FEAT-001a, Block 7).
//
// Regla de las pruebas: cada especificación usa su propio usuario de prueba, preparado por
// configuracionGlobal.js, y solo toca los datos de ese usuario. Los usuarios se marcan con
// app_metadata.es_prueba = true para que supabase/scripts/limpiar_usuarios_prueba.sql los borre.
//
// SUPABASE_SERVICE_ROLE_KEY se lee con loadEnv de .env.pruebas.local, nunca de process.env:
// playwright.config.js la quita a propósito para que no llegue al servidor de desarrollo.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, expect } from '@playwright/test';
import { loadEnv } from 'vite';
import {
  CrearClienteAdministrador as CrearClienteAdministradorNuevo,
  MarcarUsuarioPrueba as MarcarUsuarioPruebaConCliente,
  mensajeFaltaClave,
  mensajeLimiteInicios,
} from '../../pruebas/utilidades/ayudantesSupabase.js';

export { expect, mensajeFaltaClave, mensajeLimiteInicios };

// Sesiones guardadas (storageState) y registro de usuarios preparados. Fuera de git: tienen tokens.
export const directorioSesionesPorDefecto = fileURLToPath(new URL('../.sesiones/', import.meta.url));
export const nombreRegistroUsuarios = 'usuarios.json';

// Un usuario por especificación: corren en paralelo sin pisarse los datos.
export const nombresUsuarios = ['sesion', 'zonaHoraria', 'rendimiento', 'accesibilidad', 'anchos'];

// --- Variables y clientes ---

// Lee .env, .env.local, .env.pruebas y .env.pruebas.local del directorio. Corta con E7-1 si falta
// la clave de service role.
export function ObtenerVariablesPruebas(directorio = process.cwd()) {
  const variables = loadEnv('pruebas', directorio, '');
  if (!variables.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(mensajeFaltaClave);
  }
  for (const nombre of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) {
    if (!variables[nombre]) {
      throw new Error(`Falta ${nombre} en .env.local.`);
    }
  }
  return {
    urlSupabase: variables.VITE_SUPABASE_URL,
    claveAnonima: variables.VITE_SUPABASE_ANON_KEY,
    claveServicio: variables.SUPABASE_SERVICE_ROLE_KEY,
  };
}

let clienteAdministrador = null;

// Cliente con la service role: salta RLS. Solo para preparar y verificar datos de prueba.
export function CrearClienteAdministrador(variables = ObtenerVariablesPruebas()) {
  if (!clienteAdministrador) {
    clienteAdministrador = CrearClienteAdministradorNuevo(variables);
  }
  return clienteAdministrador;
}

// --- Registro de usuarios preparados ---

export function ObtenerRutaRegistro(directorioSesiones = directorioSesionesPorDefecto) {
  return join(directorioSesiones, nombreRegistroUsuarios);
}

// Devuelve { idUsuario, idCuenta, rutaEstado } del usuario preparado por configuracionGlobal.js.
// Si la preparación no pudo iniciar su sesión por el límite de Supabase, falla con E7-2.
export function ObtenerUsuarioPreparado(nombre, rutaRegistro = ObtenerRutaRegistro()) {
  let registro;
  try {
    registro = JSON.parse(readFileSync(rutaRegistro, 'utf8'));
  } catch {
    throw new Error(`No hay usuarios preparados en ${rutaRegistro}. Corra npm run test:navegador.`);
  }
  const usuario = registro[nombre];
  if (!usuario) {
    throw new Error(`El usuario de prueba "${nombre}" no fue preparado.`);
  }
  if (usuario.limite) {
    throw new Error(mensajeLimiteInicios);
  }
  return usuario;
}

export async function MarcarUsuarioPrueba(idUsuario) {
  await MarcarUsuarioPruebaConCliente(CrearClienteAdministrador(), idUsuario);
}

// Ids de usuario de las sesiones de supabase-js guardadas en el localStorage de un storageState.
export function ObtenerIdsUsuariosDeEstado(estado) {
  const ids = new Set();
  for (const origen of estado.origins ?? []) {
    for (const { name, value } of origen.localStorage ?? []) {
      if (!/^sb-.+-auth-token$/.test(name)) continue;
      try {
        const idUsuario = JSON.parse(value)?.user?.id;
        if (idUsuario) ids.add(idUsuario);
      } catch {
        // Un valor que no es una sesión no identifica a ningún usuario.
      }
    }
  }
  return [...ids];
}

// Marca con es_prueba a todo usuario que la app haya creado en el contexto (por ejemplo, si una
// sesión no se reutilizó y la app inició otra anónima): así el script de limpieza lo alcanza.
export async function MarcarUsuariosCreadosPorLaApp(contexto, idsConocidos) {
  const estado = await contexto.storageState();
  const nuevos = ObtenerIdsUsuariosDeEstado(estado).filter((id) => !idsConocidos.includes(id));
  for (const idUsuario of nuevos) {
    await MarcarUsuarioPrueba(idUsuario);
  }
  return nuevos;
}

// --- Montos y fechas ---

// Montos como texto "N.NN" ↔ centavos enteros (BigInt): nunca float (RNF-04).
export function ConvertirMontoACentavos(monto) {
  const [, signo, enteros, decimales] = /^(-?)(\d+)\.(\d{2})$/.exec(monto);
  const centavos = BigInt(enteros) * 100n + BigInt(decimales);
  return signo ? -centavos : centavos;
}

export function ConvertirCentavosAMonto(centavos) {
  const absoluto = centavos < 0n ? -centavos : centavos;
  const decimales = String(absoluto % 100n).padStart(2, '0');
  return `${centavos < 0n ? '-' : ''}${absoluto / 100n}.${decimales}`;
}

// "1500.50" → "1.500,50", como lo muestra la app.
export function FormatearMontoPantalla(monto) {
  const [, signo, enteros, decimales] = /^(-?)(\d+)\.(\d{2})$/.exec(monto);
  return `${signo}${enteros.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decimales}`;
}

// Día calendario local "AAAA-MM-DD" desplazado `dias` desde hoy, sin pasar por UTC.
export function ObtenerFechaLocal(dias = 0, desde = new Date()) {
  const fecha = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + dias);
  const anio = String(fecha.getFullYear()).padStart(4, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

// --- Datos con service role ---

export async function ObtenerCuentaUsuario(idUsuario) {
  const { data, error } = await CrearClienteAdministrador()
    .from('bat_cuentas')
    .select('id, saldo')
    .eq('id_usuario', idUsuario);
  if (error || data.length !== 1) {
    throw new Error(`No se pudo leer la cuenta del usuario de prueba: ${error?.message ?? data.length}`);
  }
  return data[0];
}

// Devuelve el id de la categoría con ese nombre y tipo; si no existe, la crea. Las sesiones se
// reutilizan entre corridas, así que la categoría puede existir de una corrida anterior.
export async function CargarCategoria(idCuenta, nombre, tipo) {
  const administrador = CrearClienteAdministrador();
  const { data: existentes, error: errorLectura } = await administrador
    .from('bat_categorias')
    .select('id')
    .eq('id_cuenta', idCuenta)
    .eq('nombre', nombre)
    .eq('tipo', tipo);
  if (errorLectura) {
    throw new Error(`No se pudo leer la categoría de prueba: ${errorLectura.message}`);
  }
  if (existentes.length > 0) {
    return existentes[0].id;
  }
  const { data, error } = await administrador
    .from('bat_categorias')
    .insert({ id_cuenta: idCuenta, nombre, tipo })
    .select('id')
    .single();
  if (error) {
    throw new Error(`No se pudo cargar la categoría de prueba: ${error.message}`);
  }
  return data.id;
}

async function ObtenerCategoriasPorDefecto(idCuenta) {
  const { data, error } = await CrearClienteAdministrador()
    .from('bat_categorias')
    .select('id, tipo')
    .eq('id_cuenta', idCuenta)
    .eq('es_por_defecto', true);
  if (error) {
    throw new Error(`No se pudieron leer las categorías por defecto: ${error.message}`);
  }
  return Object.fromEntries(data.map((categoria) => [categoria.tipo, categoria.id]));
}

const tamanoLoteMovimientos = 1000;

// Deja la cuenta exactamente con los movimientos indicados ({ tipo, monto: "N.NN", fecha,
// idCategoria? }; sin categoría, la por defecto del tipo) y el saldo consistente:
// Σ ingresos − Σ gastos. Insert masivo en lotes con la service role.
export async function CargarMovimientos(idCuenta, movimientos) {
  const administrador = CrearClienteAdministrador();
  const porDefecto = await ObtenerCategoriasPorDefecto(idCuenta);

  const { error: errorBorrado } = await administrador
    .from('bat_movimientos')
    .delete()
    .eq('id_cuenta', idCuenta);
  if (errorBorrado) {
    throw new Error(`No se pudieron borrar los movimientos de prueba: ${errorBorrado.message}`);
  }

  let saldo = 0n;
  const filas = movimientos.map(({ tipo, monto, fecha, idCategoria }) => {
    const centavos = ConvertirMontoACentavos(monto);
    saldo += tipo === 'INGRESO' ? centavos : -centavos;
    return { id_cuenta: idCuenta, id_categoria: idCategoria ?? porDefecto[tipo], tipo, monto, fecha };
  });

  for (let inicio = 0; inicio < filas.length; inicio += tamanoLoteMovimientos) {
    const { error } = await administrador
      .from('bat_movimientos')
      .insert(filas.slice(inicio, inicio + tamanoLoteMovimientos));
    if (error) {
      throw new Error(`No se pudieron cargar los movimientos de prueba: ${error.message}`);
    }
  }

  const textoSaldo = ConvertirCentavosAMonto(saldo);
  const { error } = await administrador
    .from('bat_cuentas')
    .update({ saldo: textoSaldo })
    .eq('id', idCuenta);
  if (error) {
    throw new Error(`No se pudo actualizar el saldo de prueba: ${error.message}`);
  }
  return textoSaldo;
}

// N movimientos de 10,00 (gastos e ingresos intercalados) en días anteriores a hoy.
export function CrearMovimientosAnteriores(cantidad) {
  return Array.from({ length: cantidad }, (_, indice) => ({
    tipo: indice % 2 === 0 ? 'INGRESO' : 'GASTO',
    monto: '10.00',
    fecha: ObtenerFechaLocal(-1 - Math.floor(indice / 5)),
  }));
}

// --- Fixtures ---

export const test = base.extend({
  // Usuario de la especificación: test.use({ nombreUsuario: 'anchos' }).
  nombreUsuario: ['accesibilidad', { option: true }],

  usuario: async ({ nombreUsuario }, usar) => {
    await usar(ObtenerUsuarioPreparado(nombreUsuario));
  },

  // Cada contexto arranca con la sesión guardada del usuario: la app la reutiliza (FR-03) y no
  // inicia otra anónima, lo que cuida el límite de Supabase.
  storageState: async ({ usuario }, usar) => {
    await usar(usuario.rutaEstado);
  },

  paginaConUsuario: async ({ page, usuario }, usar) => {
    await usar(page);
    await MarcarUsuariosCreadosPorLaApp(page.context(), [usuario.idUsuario]);
  },
});
