import { createClient } from '@supabase/supabase-js';

const urlSupabase = import.meta.env.VITE_SUPABASE_URL;
const claveAnonimaSupabase = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!urlSupabase || !claveAnonimaSupabase) {
  // Solo lo ve quien desarrolla, en la consola; la interfaz muestra el error de
  // inicio de sesión (FR-02) porque la sesión no se puede iniciar.
  throw new Error('Faltan variables de entorno de Supabase. Revise .env.local.');
}

export const clienteSupabase = createClient(urlSupabase, claveAnonimaSupabase, {
  auth: { persistSession: true },
});
