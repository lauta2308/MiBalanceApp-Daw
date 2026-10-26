// Ayudantes de las pruebas contra el proyecto de Supabase (pruebas/).
//
// Regla de las pruebas: cada archivo crea sus propios usuarios y datos, solo toca lo que creó y
// lo borra al terminar (EliminarUsuariosPrueba en afterAll). Los usuarios de prueba se marcan en
// app_metadata (solo la service role puede escribirlo, mitigación R12) para que
// supabase/scripts/limpiar_usuarios_prueba.sql los borre si una corrida se corta.
//
// Supabase limita los inicios de sesión anónimos (~30 por hora por IP): cada archivo crea los
// usuarios una sola vez (beforeAll) y los reutiliza en todas sus pruebas.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const rutaRaiz = fileURLToPath(new URL('../../', import.meta.url));

const opcionesSinSesionPersistente = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

function ObtenerVariable(nombre, archivo) {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta ${nombre} en ${archivo}.`);
  }
  return valor;
}

export function ObtenerUrlSupabase() {
  return ObtenerVariable('VITE_SUPABASE_URL', '.env.local');
}

export function ObtenerClaveAnonima() {
  return ObtenerVariable('VITE_SUPABASE_ANON_KEY', '.env.local');
}

let clienteAdministrador = null;

// Cliente con la service role: salta RLS. Solo para preparar y verificar datos de prueba.
export function CrearClienteAdministrador() {
  if (!clienteAdministrador) {
    clienteAdministrador = createClient(
      ObtenerUrlSupabase(),
      ObtenerVariable('SUPABASE_SERVICE_ROLE_KEY', '.env.pruebas.local'),
      opcionesSinSesionPersistente,
    );
  }
  return clienteAdministrador;
}

// Cliente con la anon key y sin sesión (rol anon).
export function CrearClienteAnonimo() {
  return createClient(ObtenerUrlSupabase(), ObtenerClaveAnonima(), opcionesSinSesionPersistente);
}

// Inicia una sesión anónima nueva y, salvo { marcar: false }, marca al usuario con
// app_metadata.es_prueba = true. Devuelve { cliente, idUsuario }.
export async function CrearUsuarioPrueba({ marcar = true } = {}) {
  const cliente = CrearClienteAnonimo();
  const { data, error } = await cliente.auth.signInAnonymously();
  if (error) {
    if (error.status === 429) {
      throw new Error('Límite de inicios anónimos de Supabase alcanzado; reintente más tarde.');
    }
    throw new Error(`No se pudo iniciar la sesión anónima de prueba: ${error.message}`);
  }
  const idUsuario = data.user.id;
  if (marcar) {
    const { error: errorMarca } = await CrearClienteAdministrador().auth.admin.updateUserById(
      idUsuario,
      { app_metadata: { es_prueba: true } },
    );
    if (errorMarca) {
      throw new Error(`No se pudo marcar al usuario de prueba: ${errorMarca.message}`);
    }
  }
  return { cliente, idUsuario };
}

// Borra con la service role a los usuarios indicados (el cascade borra sus datos).
export async function EliminarUsuariosPrueba(idsUsuarios) {
  const administrador = CrearClienteAdministrador();
  for (const idUsuario of idsUsuarios) {
    if (!idUsuario) continue;
    const { error } = await administrador.auth.admin.deleteUser(idUsuario);
    if (error && error.status !== 404) {
      throw new Error(`No se pudo borrar al usuario de prueba: ${error.message}`);
    }
  }
}

export async function ObtenerCuentaUsuario(idUsuario) {
  const { data, error } = await CrearClienteAdministrador()
    .from('bat_cuentas')
    .select('id, id_usuario, nombre, moneda, saldo')
    .eq('id_usuario', idUsuario);
  if (error) {
    throw new Error(`No se pudo leer la cuenta de prueba: ${error.message}`);
  }
  if (data.length !== 1) {
    throw new Error(`Se esperaba 1 cuenta para el usuario de prueba y hay ${data.length}.`);
  }
  return data[0];
}

// Crea una categoría con la service role y devuelve su id.
export async function CargarCategoria(idCuenta, nombre, tipo) {
  const { data, error } = await CrearClienteAdministrador()
    .from('bat_categorias')
    .insert({ id_cuenta: idCuenta, nombre, tipo })
    .select('id')
    .single();
  if (error) {
    throw new Error(`No se pudo cargar la categoría de prueba: ${error.message}`);
  }
  return data.id;
}

// Deja la cuenta sin movimientos y con el saldo indicado ("N.NN"), con la service role.
export async function ReiniciarCuenta(idCuenta, saldo) {
  const administrador = CrearClienteAdministrador();
  const { error: errorBorrado } = await administrador
    .from('bat_movimientos')
    .delete()
    .eq('id_cuenta', idCuenta);
  if (errorBorrado) {
    throw new Error(`No se pudieron borrar los movimientos de prueba: ${errorBorrado.message}`);
  }
  const { error } = await administrador.from('bat_cuentas').update({ saldo }).eq('id', idCuenta);
  if (error) {
    throw new Error(`No se pudo reiniciar el saldo de prueba: ${error.message}`);
  }
}

// --- Conexión directa a PostgreSQL (rol postgres) ---
// La API de Supabase no expone el esquema pruebas ni los catálogos (pg_trigger,
// information_schema), así que esas verificaciones van por una conexión directa al pooler del
// proyecto vinculado (supabase link) con SUPABASE_DB_PASSWORD de .env.pruebas.local.

const rutaCertificadoSupabase = 'supabase/certificados/prod-ca-2021.crt';

// CA raíz de Supabase (Supabase Root 2021 CA), pública. El pooler presenta un certificado firmado
// por ella, que no está en el almacén del sistema: se verifica la cadena y el nombre del host
// contra esa CA, nunca se desactiva la verificación.
function LeerCertificadoSupabase() {
  try {
    return readFileSync(`${rutaRaiz}${rutaCertificadoSupabase}`, 'utf8');
  } catch {
    throw new Error(
      `Falta el certificado de la CA de Supabase en ${rutaCertificadoSupabase}. ` +
        'Descárguelo desde Database Settings → SSL Configuration del proyecto.',
    );
  }
}

function ObtenerConfiguracionBaseDatos() {
  let urlPooler;
  try {
    urlPooler = new URL(readFileSync(`${rutaRaiz}supabase/.temp/pooler-url`, 'utf8').trim());
  } catch {
    throw new Error('Falta supabase/.temp/pooler-url. Ejecute npx supabase link.');
  }
  return {
    host: urlPooler.hostname,
    port: Number.parseInt(urlPooler.port || '5432', 10),
    user: decodeURIComponent(urlPooler.username),
    database: urlPooler.pathname.slice(1) || 'postgres',
    password: ObtenerVariable('SUPABASE_DB_PASSWORD', '.env.pruebas.local'),
    ssl: { ca: LeerCertificadoSupabase(), rejectUnauthorized: true },
  };
}

let grupoConexiones = null;

// Un grupo de conexiones por archivo de pruebas (cada conexión nueva al pooler tarda): se cierra
// con CerrarConexionesBaseDatos en afterAll.
async function UsarConexion(funcion) {
  if (!grupoConexiones) {
    grupoConexiones = new pg.Pool({ ...ObtenerConfiguracionBaseDatos(), max: 2 });
  }
  const conexion = await grupoConexiones.connect();
  try {
    return await funcion(conexion);
  } finally {
    conexion.release();
  }
}

export async function CerrarConexionesBaseDatos() {
  if (grupoConexiones) {
    const grupo = grupoConexiones;
    grupoConexiones = null;
    await grupo.end();
  }
}

export async function ConsultarBaseDatos(sql, parametros = []) {
  return UsarConexion(async (conexion) => (await conexion.query(sql, parametros)).rows);
}

// Ejecuta la función dentro de una transacción que siempre se revierte. Sirve para probar
// scripts que borran (limpiar_usuarios_prueba.sql) sin afectar datos de otras pruebas.
export async function EjecutarEnTransaccionRevertida(funcion) {
  return UsarConexion(async (conexion) => {
    await conexion.query('BEGIN');
    try {
      return await funcion((sql, parametros = []) =>
        conexion.query(sql, parametros).then((resultado) => resultado.rows),
      );
    } finally {
      await conexion.query('ROLLBACK');
    }
  });
}

export function LeerScript(rutaRelativa) {
  return readFileSync(`${rutaRaiz}${rutaRelativa}`, 'utf8');
}

// --- Falla simulada (ADR-002) ---

export async function ActivarFallaSimulada(idUsuario, punto) {
  await ConsultarBaseDatos(
    'INSERT INTO pruebas.bat_fallas_simuladas (id_usuario, punto) VALUES ($1, $2) ' +
      'ON CONFLICT (id_usuario) DO UPDATE SET punto = EXCLUDED.punto',
    [idUsuario, punto],
  );
}

export async function DesactivarFallaSimulada(idUsuario) {
  await ConsultarBaseDatos('DELETE FROM pruebas.bat_fallas_simuladas WHERE id_usuario = $1', [
    idUsuario,
  ]);
}
