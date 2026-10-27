// Ayudantes compartidos por pruebas/ y pruebas-navegador/ (spec FEAT-001b, Block 1): E1-2.
// Prueban pruebas/utilidades/ayudantesSupabase.js sin llamar a Supabase.

import { describe, expect, it, vi } from 'vitest';
import {
  CrearClienteAdministrador,
  MarcarUsuarioPrueba,
  mensajeFaltaClave,
  mensajeLimiteInicios,
} from './utilidades/ayudantesSupabase.js';

const urlSupabase = 'https://proyecto.supabase.co';

describe('CrearClienteAdministrador', () => {
  it('(error E1-2) sin urlSupabase lanza el error de clave faltante', () => {
    expect(() => CrearClienteAdministrador({ urlSupabase: '', claveServicio: 'x' })).toThrow(
      'Falta SUPABASE_SERVICE_ROLE_KEY en .env.pruebas.local.',
    );
  });

  it('(error E1-2) sin claveServicio lanza el error de clave faltante', () => {
    expect(() => CrearClienteAdministrador({ urlSupabase, claveServicio: '' })).toThrow(
      mensajeFaltaClave,
    );
  });

  it('crea un cliente nuevo en cada llamada (sin caché propia)', () => {
    const primero = CrearClienteAdministrador({ urlSupabase, claveServicio: 'x' });
    const segundo = CrearClienteAdministrador({ urlSupabase, claveServicio: 'x' });

    expect(typeof primero.from).toBe('function');
    expect(primero).not.toBe(segundo);
  });
});

describe('MarcarUsuarioPrueba', () => {
  it('escribe app_metadata.es_prueba = true en el usuario indicado', async () => {
    const updateUserById = vi.fn(async () => ({ data: {}, error: null }));
    const clienteAdministrador = { auth: { admin: { updateUserById } } };

    await MarcarUsuarioPrueba(clienteAdministrador, 'id-usuario');

    expect(updateUserById).toHaveBeenCalledWith('id-usuario', {
      app_metadata: { es_prueba: true },
    });
  });

  it('si Supabase devuelve error, lanza con el detalle', async () => {
    const clienteAdministrador = {
      auth: { admin: { updateUserById: async () => ({ data: null, error: { message: 'sin permiso' } }) } },
    };

    await expect(MarcarUsuarioPrueba(clienteAdministrador, 'id-usuario')).rejects.toThrow(
      'No se pudo marcar al usuario de prueba: sin permiso',
    );
  });
});

describe('mensajeLimiteInicios', () => {
  it('es el texto del error 429 de los inicios anónimos', () => {
    expect(mensajeLimiteInicios).toBe(
      'Límite de inicios anónimos de Supabase alcanzado; reintente más tarde.',
    );
  });
});
