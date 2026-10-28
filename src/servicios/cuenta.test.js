import { beforeEach, describe, expect, it, vi } from 'vitest';

// Cliente de Supabase simulado: registra la vista y el select pedidos y
// responde con lo que indique la prueba.
const simulacion = vi.hoisted(() => ({ consultas: [], responder: null }));

vi.mock('./clienteSupabase.js', () => {
  function CrearConsulta(vista) {
    const registro = { vista, select: null };
    simulacion.consultas.push(registro);
    const consulta = {
      select(...argumentos) {
        registro.select = argumentos;
        return consulta;
      },
      then(alResolver, alRechazar) {
        return Promise.resolve()
          .then(() => simulacion.responder(registro))
          .then(alResolver, alRechazar);
      },
    };
    return consulta;
  }
  return { clienteSupabase: { from: (vista) => CrearConsulta(vista) } };
});

import { ObtenerCuenta } from './cuenta.js';

describe('ObtenerCuenta', () => {
  beforeEach(() => {
    simulacion.consultas.length = 0;
    simulacion.responder = () => ({ data: [], error: null });
  });

  it('ante una excepción del cliente devuelve exactamente { ok: false } sin exponer el error (NFR-06)', async () => {
    simulacion.responder = () => {
      throw new Error('Failed to fetch');
    };

    const resultado = await ObtenerCuenta();

    expect(simulacion.consultas).toHaveLength(1);
    expect(simulacion.consultas[0].vista).toBe('bav_cuenta');
    expect(resultado).toEqual({ ok: false });
  });

  it('(FR-45) con un saldo de formato inesperado ("abc") devuelve exactamente { ok: false }', async () => {
    simulacion.responder = () => ({
      data: [{ id: 'cuenta-a', nombre: 'Mi Cuenta', moneda: 'USD', saldo: 'abc' }],
      error: null,
    });

    await expect(ObtenerCuenta()).resolves.toEqual({ ok: false });
  });

  it('con un saldo negativo ("-1000.00") devuelve la cuenta tal como llega', async () => {
    const cuenta = { id: 'cuenta-a', nombre: 'Mi Cuenta', moneda: 'USD', saldo: '-1000.00' };
    simulacion.responder = () => ({ data: [{ ...cuenta }], error: null });

    await expect(ObtenerCuenta()).resolves.toEqual({ ok: true, cuenta });
  });
});
