import { beforeEach, describe, expect, it, vi } from 'vitest';

// Cliente de Supabase simulado: las consultas registran tabla, select, order y
// range; las llamadas RPC registran nombre y parámetros. Cada prueba indica la
// respuesta.
const simulacion = vi.hoisted(() => ({
  consultas: [],
  llamadasRpc: [],
  responderMovimientos: null,
  responderRpc: null,
}));

vi.mock('./clienteSupabase.js', () => {
  function CrearConsulta(tabla) {
    const registro = { tabla, select: null, order: [], range: null };
    simulacion.consultas.push(registro);
    const consulta = {
      select(...argumentos) {
        registro.select = argumentos;
        return consulta;
      },
      order(...argumentos) {
        registro.order.push(argumentos);
        return consulta;
      },
      range(desde, hasta) {
        registro.range = [desde, hasta];
        return consulta;
      },
      then(alResolver, alRechazar) {
        return Promise.resolve()
          .then(() => simulacion.responderMovimientos(registro))
          .then(alResolver, alRechazar);
      },
    };
    return consulta;
  }
  return {
    clienteSupabase: {
      from: (tabla) => CrearConsulta(tabla),
      rpc: (nombre, parametros) => {
        simulacion.llamadasRpc.push({ nombre, parametros });
        return Promise.resolve().then(() => simulacion.responderRpc(parametros));
      },
    },
  };
});

import { AgregarMovimiento, ObtenerPaginaMovimientos } from './movimientos.js';

const errorSupabase = { message: 'relation "bav_movimientos" does not exist', code: '42P01' };

function CrearMovimientos(cantidad) {
  return Array.from({ length: cantidad }, (_, indice) => {
    const posicion = String(indice + 1).padStart(3, '0');
    return {
      id: `mov-${posicion}`,
      fecha: '2026-10-02',
      tipo: 'GASTO',
      monto: '10.00',
      nombre_categoria: `Categoría ${posicion}`,
      creado_en: '2026-10-02T12:00:00+00:00',
    };
  });
}

function ConfigurarMovimientos(movimientos) {
  simulacion.responderMovimientos = (registro) => {
    const [desde, hasta] = registro.range ?? [0, movimientos.length - 1];
    return { data: movimientos.slice(desde, hasta + 1), error: null, count: movimientos.length };
  };
}

describe('servicio de movimientos', () => {
  beforeEach(() => {
    simulacion.consultas.length = 0;
    simulacion.llamadasRpc.length = 0;
    ConfigurarMovimientos([]);
    simulacion.responderRpc = () => ({ data: 'id-movimiento-nuevo', error: null });
  });

  describe('ObtenerPaginaMovimientos', () => {
    it('ObtenerPaginaMovimientos(2) pide el rango 50–99 de bav_movimientos con el orden fecha, creado_en e id descendentes y el total exacto (FR-34, FR-39)', async () => {
      ConfigurarMovimientos(CrearMovimientos(120));

      const resultado = await ObtenerPaginaMovimientos(2);

      expect(resultado.ok).toBe(true);
      expect(resultado.total).toBe(120);
      expect(resultado.movimientos).toHaveLength(50);
      expect(resultado.movimientos[0].id).toBe('mov-051');
      const [consulta] = simulacion.consultas;
      expect(consulta.tabla).toBe('bav_movimientos');
      expect(consulta.range).toEqual([50, 99]);
      expect(consulta.order).toEqual([
        ['fecha', { ascending: false }],
        ['creado_en', { ascending: false }],
        ['id', { ascending: false }],
      ]);
      expect(consulta.select[1]).toEqual({ count: 'exact' });
      expect(consulta.select[0].split(',').map((columna) => columna.trim())).toEqual(
        expect.arrayContaining(['id', 'fecha', 'tipo', 'monto', 'nombre_categoria']),
      );
    });

    it('ObtenerPaginaMovimientos devuelve { ok: false } sin exponer el error de Supabase (NFR-06)', async () => {
      simulacion.responderMovimientos = () => ({ data: null, error: errorSupabase, count: null });

      await expect(ObtenerPaginaMovimientos(1)).resolves.toEqual({ ok: false });
      expect(simulacion.consultas).toHaveLength(1);
    });
  });

  describe('AgregarMovimiento', () => {
    it('llama una vez a basp_agregar_movimiento con el monto convertido para la API y devuelve { ok: true } (AC-12, AC-20)', async () => {
      const resultado = await AgregarMovimiento({
        tipo: 'GASTO',
        monto: '1.500,50',
        idCategoria: 'categoria-mercado',
        fecha: '2026-10-03',
      });

      expect(resultado).toEqual({ ok: true });
      expect(simulacion.llamadasRpc).toEqual([
        {
          nombre: 'basp_agregar_movimiento',
          parametros: {
            p_tipo: 'GASTO',
            p_monto: '1500.50',
            p_id_categoria: 'categoria-mercado',
            p_fecha: '2026-10-03',
          },
        },
      ]);
    });

    it('envía el monto entero con dos decimales y la fecha tal cual, sin pasar por UTC', async () => {
      await AgregarMovimiento({
        tipo: 'INGRESO',
        monto: '1.000',
        idCategoria: 'categoria-sueldo',
        fecha: '1990-03-15',
      });

      expect(simulacion.llamadasRpc[0].parametros).toEqual({
        p_tipo: 'INGRESO',
        p_monto: '1000.00',
        p_id_categoria: 'categoria-sueldo',
        p_fecha: '1990-03-15',
      });
    });

    it.each([
      ['un rechazo BA500 (falla simulada)', () => ({ data: null, error: { code: 'BA500', message: 'Falla simulada' } })],
      ['un rechazo BA423 (fecha)', () => ({ data: null, error: { code: 'BA423', message: 'Fecha posterior' } })],
      ['una respuesta sin id', () => ({ data: null, error: null })],
      [
        'una excepción de red',
        () => {
          throw new Error('Failed to fetch');
        },
      ],
    ])('(error E6-3) ante %s devuelve exactamente { ok: false }, sin el error de Supabase (NFR-06, AC-60)', async (_, responder) => {
      simulacion.responderRpc = responder;

      const resultado = await AgregarMovimiento({
        tipo: 'GASTO',
        monto: '1.000',
        idCategoria: 'categoria-mercado',
        fecha: '2026-10-03',
      });

      expect(simulacion.llamadasRpc).toHaveLength(1);
      expect(resultado).toEqual({ ok: false });
    });
  });
});
