// Configuración global de las pruebas en navegador (globalSetup de playwright.config.js, spec
// FEAT-001a, Block 7). Antes de correr ninguna prueba:
//   1. Corta si falta SUPABASE_SERVICE_ROLE_KEY en .env.pruebas.local (E7-1).
//   2. Prepara un usuario anónimo por especificación y guarda su sesión (storageState). Si ya hay
//      una sesión guardada de una corrida anterior, la renueva en lugar de crear otro usuario:
//      Supabase limita los inicios anónimos (~30 por hora por IP). Si Supabase responde con el
//      límite, ese usuario queda registrado como no disponible y sus pruebas fallan con E7-2.
//   3. Marca a todos esos usuarios con app_metadata.es_prueba = true (limpiar_usuarios_prueba.sql).
//   4. Deja al usuario de rendimiento con 5.000 movimientos y el saldo consistente (AC-50).

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  CargarMovimientos,
  CrearClienteAdministrador,
  MarcarUsuarioPrueba,
  ObtenerCuentaUsuario,
  ObtenerFechaLocal,
  ObtenerRutaRegistro,
  ObtenerVariablesPruebas,
  directorioSesionesPorDefecto,
  mensajeLimiteInicios,
  nombresUsuarios,
} from './utilidades/fixtures.js';

const urlBasePorDefecto = 'http://localhost:5173';
export const cantidadMovimientosRendimiento = 5000;

// Almacenamiento en memoria para supabase-js: guarda la sesión con la misma clave y el mismo
// formato que usa la app en localStorage, sin que la prueba dependa de cómo se arma esa clave.
function CrearAlmacenamientoMemoria() {
  const valores = new Map();
  return {
    getItem: (clave) => (valores.has(clave) ? valores.get(clave) : null),
    setItem: (clave, valor) => {
      valores.set(clave, valor);
    },
    removeItem: (clave) => {
      valores.delete(clave);
    },
    ObtenerEntradas: () => [...valores].map(([name, value]) => ({ name, value })),
  };
}

function CrearClienteConAlmacenamiento(variables, almacenamiento) {
  return createClient(variables.urlSupabase, variables.claveAnonima, {
    auth: {
      storage: almacenamiento,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

// Inicia una sesión anónima con el cliente indicado. Con el límite de Supabase (429) falla con
// E7-2, que no es una falla de la app.
export async function IniciarSesionAnonimaPrueba(cliente) {
  const { data, error } = await cliente.auth.signInAnonymously();
  if (error) {
    if (error.status === 429) {
      throw new Error(mensajeLimiteInicios);
    }
    throw new Error(`No se pudo iniciar la sesión anónima de prueba: ${error.message}`);
  }
  if (!data?.session) {
    throw new Error('No se pudo iniciar la sesión anónima de prueba: Supabase no devolvió sesión.');
  }
  return data.session;
}

function LeerRefreshTokenGuardado(rutaEstado) {
  try {
    const estado = JSON.parse(readFileSync(rutaEstado, 'utf8'));
    for (const origen of estado.origins ?? []) {
      for (const { name, value } of origen.localStorage ?? []) {
        if (/^sb-.+-auth-token$/.test(name)) {
          return JSON.parse(value)?.refresh_token ?? null;
        }
      }
    }
  } catch {
    // Sin sesión guardada (primera corrida) o ilegible: se crea un usuario nuevo.
  }
  return null;
}

// Renueva la sesión guardada (tokens frescos para toda la corrida) o, si no hay o ya no sirve
// (por ejemplo, el script de limpieza borró al usuario), inicia una anónima nueva.
async function ObtenerSesionUsuario(variables, rutaEstado) {
  const refreshToken = LeerRefreshTokenGuardado(rutaEstado);
  if (refreshToken) {
    const almacenamiento = CrearAlmacenamientoMemoria();
    const cliente = CrearClienteConAlmacenamiento(variables, almacenamiento);
    const { data, error } = await cliente.auth.refreshSession({ refresh_token: refreshToken });
    if (!error && data?.session) {
      return { sesion: data.session, almacenamiento };
    }
  }
  const almacenamiento = CrearAlmacenamientoMemoria();
  const cliente = CrearClienteConAlmacenamiento(variables, almacenamiento);
  const sesion = await IniciarSesionAnonimaPrueba(cliente);
  return { sesion, almacenamiento };
}

async function PrepararUsuario(nombre, variables, directorioSesiones, urlBase) {
  const rutaEstado = join(directorioSesiones, `${nombre}.json`);
  let resultado;
  try {
    resultado = await ObtenerSesionUsuario(variables, rutaEstado);
  } catch (error) {
    if (error.message === mensajeLimiteInicios) {
      rmSync(rutaEstado, { force: true });
      return { limite: true };
    }
    throw error;
  }
  const idUsuario = resultado.sesion.user.id;
  await MarcarUsuarioPrueba(idUsuario);
  const cuenta = await ObtenerCuentaUsuario(idUsuario);

  const estado = {
    cookies: [],
    origins: [{ origin: urlBase, localStorage: resultado.almacenamiento.ObtenerEntradas() }],
  };
  writeFileSync(rutaEstado, JSON.stringify(estado, null, 2));
  return { idUsuario, idCuenta: cuenta.id, rutaEstado };
}

// 5.000 movimientos (ingresos de 100,00 y gastos de 50,00 intercalados) en días anteriores a hoy,
// para que cada alta de la medición quede primera en la lista.
export function CrearMovimientosRendimiento(cantidad = cantidadMovimientosRendimiento) {
  return Array.from({ length: cantidad }, (_, indice) => ({
    tipo: indice % 2 === 0 ? 'INGRESO' : 'GASTO',
    monto: indice % 2 === 0 ? '100.00' : '50.00',
    fecha: ObtenerFechaLocal(-1 - Math.floor(indice / 10)),
  }));
}

// La carga borra y vuelve a insertar todo, así que repetirla es seguro: se reintenta una vez si
// la red falla a mitad de camino.
async function CargarMovimientosRendimiento(idCuenta) {
  const movimientos = CrearMovimientosRendimiento();
  try {
    await CargarMovimientos(idCuenta, movimientos);
  } catch (error) {
    if (!/fetch failed/i.test(error.message)) {
      throw error;
    }
    await CargarMovimientos(idCuenta, movimientos);
  }
}

export default async function ConfigurarPruebasNavegador(configuracion, opciones = {}) {
  const { directorio = process.cwd(), directorioSesiones = directorioSesionesPorDefecto } = opciones;

  // E7-1: antes de cualquier otra cosa.
  const variables = ObtenerVariablesPruebas(directorio);
  CrearClienteAdministrador(variables);

  const urlBase = configuracion?.projects?.[0]?.use?.baseURL ?? urlBasePorDefecto;
  mkdirSync(directorioSesiones, { recursive: true });

  const registro = {};
  for (const nombre of nombresUsuarios) {
    registro[nombre] = await PrepararUsuario(nombre, variables, directorioSesiones, urlBase);
  }

  const usuarioRendimiento = registro.rendimiento;
  if (!usuarioRendimiento.limite) {
    await CargarMovimientosRendimiento(usuarioRendimiento.idCuenta);
  }

  writeFileSync(ObtenerRutaRegistro(directorioSesiones), JSON.stringify(registro, null, 2));
}
