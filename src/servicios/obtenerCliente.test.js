import { afterEach, describe, expect, it, vi } from 'vitest';

// Cada prueba simula clienteSupabase.js a su manera, así que se vuelven a cargar los módulos
// para que la importación dinámica de ObtenerCliente tome la simulación de esa prueba.
afterEach(() => {
  vi.doUnmock('./clienteSupabase.js');
  vi.resetModules();
});

describe('ObtenerCliente', () => {
  it('devuelve el clienteSupabase simulado', async () => {
    const clienteSimulado = { from: vi.fn() };
    vi.doMock('./clienteSupabase.js', () => ({ clienteSupabase: clienteSimulado }));
    const { ObtenerCliente } = await import('./obtenerCliente.js');

    await expect(ObtenerCliente()).resolves.toBe(clienteSimulado);
  });

  // Cuenta pide la cuenta y la página de movimientos a la vez (Promise.all): con dos importaciones
  // simultáneas desde el mismo módulo, Vitest entregaba el cliente real a la segunda.
  it('dos llamadas simultáneas devuelven el mismo clienteSupabase simulado', async () => {
    const clienteSimulado = { from: vi.fn() };
    vi.doMock('./clienteSupabase.js', () => ({ clienteSupabase: clienteSimulado }));
    const { ObtenerCliente } = await import('./obtenerCliente.js');

    const [primero, segundo] = await Promise.all([ObtenerCliente(), ObtenerCliente()]);

    expect(primero).toBe(clienteSimulado);
    expect(segundo).toBe(clienteSimulado);
  });

  it('(error E1-1) si clienteSupabase.js lanza al cargarse, rechaza la promesa', async () => {
    vi.doMock('./clienteSupabase.js', () => {
      throw new Error('Faltan las variables de entorno de Supabase.');
    });
    const { ObtenerCliente } = await import('./obtenerCliente.js');

    await expect(ObtenerCliente()).rejects.toThrow();
  });

  it('(error E1-1) después de una importación rechazada, la siguiente llamada vuelve a importar', async () => {
    let fallar = true;
    const clienteSimulado = { from: vi.fn() };
    vi.doMock('./clienteSupabase.js', () => {
      if (fallar) {
        throw new Error('Faltan las variables de entorno de Supabase.');
      }
      return { clienteSupabase: clienteSimulado };
    });
    const { ObtenerCliente } = await import('./obtenerCliente.js');

    await expect(ObtenerCliente()).rejects.toThrow();
    fallar = false;
    await expect(ObtenerCliente()).resolves.toBe(clienteSimulado);
  });

  it('(error E1-1) si clienteSupabase.js lanza al cargarse, los servicios devuelven { ok: false }', async () => {
    vi.doMock('./clienteSupabase.js', () => {
      throw new Error('Faltan las variables de entorno de Supabase.');
    });
    const { ObtenerCuenta } = await import('./cuenta.js');
    const { ObtenerPaginaMovimientos } = await import('./movimientos.js');
    const { ObtenerCategorias } = await import('./categorias.js');

    await expect(ObtenerCuenta()).resolves.toEqual({ ok: false });
    await expect(ObtenerPaginaMovimientos(1)).resolves.toEqual({ ok: false });
    await expect(ObtenerCategorias('GASTO')).resolves.toEqual({ ok: false });
  });

  it('(error E3-3, E3-4) si clienteSupabase.js lanza al cargarse, ObtenerMovimiento y EditarMovimiento devuelven { ok: false }', async () => {
    vi.doMock('./clienteSupabase.js', () => {
      throw new Error('Faltan las variables de entorno de Supabase.');
    });
    const { EditarMovimiento, ObtenerMovimiento } = await import('./movimientos.js');

    await expect(ObtenerMovimiento('3f2b8c1e-5a4d-4e7f-9b6a-1c2d3e4f5a6b')).resolves.toEqual({
      ok: false,
    });
    await expect(
      EditarMovimiento({
        idMovimiento: '3f2b8c1e-5a4d-4e7f-9b6a-1c2d3e4f5a6b',
        tipo: 'GASTO',
        monto: '2.000',
        idCategoria: 'categoria-mercado',
        fecha: '2026-09-18',
      }),
    ).resolves.toEqual({ ok: false });
  });
});
