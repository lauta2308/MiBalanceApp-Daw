import { afterEach, describe, expect, it, vi } from 'vitest';

const urlPrueba = 'https://proyecto-prueba.supabase.co';
const clavePrueba = 'clave-anonima-de-prueba';

async function ImportarCliente() {
  vi.resetModules();
  return import('./clienteSupabase.js');
}

describe('clienteSupabase', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('crea el cliente con las variables de entorno definidas', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', urlPrueba);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', clavePrueba);

    const { clienteSupabase } = await ImportarCliente();

    expect(clienteSupabase).toBeDefined();
    expect(typeof clienteSupabase.from).toBe('function');
    expect(typeof clienteSupabase.rpc).toBe('function');
    expect(typeof clienteSupabase.auth.signInAnonymously).toBe('function');
    expect(clienteSupabase.supabaseUrl).toBe(urlPrueba);
  });

  it('lanza el error indicado si falta VITE_SUPABASE_URL', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', clavePrueba);

    await expect(ImportarCliente()).rejects.toThrow(
      'Faltan variables de entorno de Supabase. Revise .env.local.',
    );
  });

  it('lanza el error indicado si falta VITE_SUPABASE_ANON_KEY', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', urlPrueba);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    await expect(ImportarCliente()).rejects.toThrow(
      'Faltan variables de entorno de Supabase. Revise .env.local.',
    );
  });
});
