// Ayudantes compartidos por las pruebas contra Supabase (pruebas/) y las pruebas en navegador
// (pruebas-navegador/). Solo va acá lo que ambos hacían igual; cada uno conserva su propia caché
// del cliente y su propia lectura de las variables de entorno.
//
// No lee process.env ni importa pg o vite: recibe los valores ya leídos por quien lo llama.

import { createClient } from '@supabase/supabase-js';

export const mensajeFaltaClave = 'Falta SUPABASE_SERVICE_ROLE_KEY en .env.pruebas.local.';
export const mensajeLimiteInicios =
  'Límite de inicios anónimos de Supabase alcanzado; reintente más tarde.';

const opcionesSinSesionPersistente = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

// Cliente con la service role: salta RLS. Solo para preparar y verificar datos de prueba. Crea
// un cliente nuevo en cada llamada; corta antes de crearlo si falta la URL o la clave.
export function CrearClienteAdministrador({ urlSupabase, claveServicio }) {
  if (!urlSupabase || !claveServicio) {
    throw new Error(mensajeFaltaClave);
  }
  return createClient(urlSupabase, claveServicio, opcionesSinSesionPersistente);
}

// Marca al usuario con app_metadata.es_prueba = true (solo la service role puede escribirlo) para
// que supabase/scripts/limpiar_usuarios_prueba.sql lo borre.
export async function MarcarUsuarioPrueba(clienteAdministrador, idUsuario) {
  const { error } = await clienteAdministrador.auth.admin.updateUserById(idUsuario, {
    app_metadata: { es_prueba: true },
  });
  if (error) {
    throw new Error(`No se pudo marcar al usuario de prueba: ${error.message}`);
  }
}
