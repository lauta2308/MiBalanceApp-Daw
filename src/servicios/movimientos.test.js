import { beforeEach, describe, expect, it, vi } from 'vitest';

// Cliente de Supabase simulado: las consultas registran tabla, select, order,
// range, eq y maybeSingle; las llamadas RPC registran nombre y parámetros y
// responden según el nombre de la función. Cada prueba indica la respuesta.
const simulacion = vi.hoisted(() => ({
  consultas: [],
  llamadasRpc: [],
  responderMovimientos: null,
  respuestasRpc: {},
}));

vi.mock('./clienteSupabase.js', () => {
  function CrearConsulta(tabla) {
    const registro = { tabla, select: null, order: [], range: null, eq: [], maybeSingle: false };
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
      eq(...argumentos) {
        registro.eq.push(argumentos);
        return consulta;
      },
      maybeSingle() {
        registro.maybeSingle = true;
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
        return Promise.resolve().then(() => {
          const responder = simulacion.respuestasRpc[nombre];
          if (!responder) {
            throw new Error(`RPC sin respuesta simulada: ${nombre}`);
          }
          return responder(parametros);
        });
      },
    },
  };
});

import {
  AgregarMovimiento,
  EditarMovimiento,
  ObtenerMovimiento,
  ObtenerPaginaMovimientos,
} from './movimientos.js';

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
    simulacion.respuestasRpc = {
      basp_agregar_movimiento: () => ({ data: 'id-movimiento-nuevo', error: null }),
      basp_editar_movimiento: (parametros) => ({ data: parametros.p_id_movimiento, error: null }),
    };
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
      simulacion.respuestasRpc.basp_agregar_movimiento = responder;

      const resultado = await AgregarMovimiento({
        tipo: 'GASTO',
        monto: '1.000',
        idCategoria: 'categoria-mercado',
        fecha: '2026-10-03',
      });

      expect(simulacion.llamadasRpc).toHaveLength(1);
      expect(simulacion.llamadasRpc[0].nombre).toBe('basp_agregar_movimiento');
      expect(resultado).toEqual({ ok: false });
    });
  });

  describe('ObtenerMovimiento', () => {
    const idMovimiento = '3f2b8c1e-5a4d-4e7f-9b6a-1c2d3e4f5a6b';
    const movimiento = {
      id: idMovimiento,
      fecha: '2026-09-17',
      tipo: 'GASTO',
      monto: '1500.00',
      id_categoria: '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
    };

    it('con un id válido consulta bav_movimientos con eq("id", …) y devuelve el movimiento con monto y fecha como texto (FR-02)', async () => {
      simulacion.responderMovimientos = () => ({ data: { ...movimiento }, error: null });

      const resultado = await ObtenerMovimiento(idMovimiento);

      expect(resultado).toEqual({ ok: true, movimiento });
      expect(resultado.movimiento.monto).toBe('1500.00');
      expect(resultado.movimiento.fecha).toBe('2026-09-17');
      expect(simulacion.consultas).toHaveLength(1);
      const [consulta] = simulacion.consultas;
      expect(consulta.tabla).toBe('bav_movimientos');
      expect(consulta.select[0].split(',').map((columna) => columna.trim())).toEqual([
        'id',
        'fecha',
        'tipo',
        'monto',
        'id_categoria',
      ]);
      expect(consulta.eq).toEqual([['id', idMovimiento]]);
      expect(consulta.maybeSingle).toBe(true);
    });

    it.each([['abc'], [''], [undefined], [`${idMovimiento}x`], ['3f2b8c1e5a4d4e7f9b6a1c2d3e4f5a6b']])(
      '(error E3-1) con el id mal formado %j devuelve { ok: false } sin llamar a Supabase',
      async (idMalFormado) => {
        await expect(ObtenerMovimiento(idMalFormado)).resolves.toEqual({ ok: false });
        expect(simulacion.consultas).toHaveLength(0);
      },
    );

    it('(error E3-2) con data: null (inexistente o ajeno) devuelve { ok: false }', async () => {
      simulacion.responderMovimientos = () => ({ data: null, error: null });

      await expect(ObtenerMovimiento(idMovimiento)).resolves.toEqual({ ok: false });
      expect(simulacion.consultas).toHaveLength(1);
    });

    it.each([
      [
        'un error de Supabase (22P02)',
        () => ({ data: null, error: { code: '22P02', message: 'invalid input syntax for type uuid' } }),
      ],
      [
        'una excepción',
        () => {
          throw new Error('Failed to fetch');
        },
      ],
    ])('(error E3-3) ante %s devuelve exactamente { ok: false }, sin el texto del error', async (_, responder) => {
      simulacion.responderMovimientos = responder;

      const resultado = await ObtenerMovimiento(idMovimiento);

      expect(resultado).toEqual({ ok: false });
      expect(JSON.stringify(resultado)).not.toMatch(/invalid input|Failed to fetch|22P02/);
    });
  });

  describe('EditarMovimiento', () => {
    const datosEdicion = {
      idMovimiento: '3f2b8c1e-5a4d-4e7f-9b6a-1c2d3e4f5a6b',
      tipo: 'GASTO',
      monto: '2.000',
      idCategoria: 'categoria-mercado',
      fecha: '2026-09-18',
    };

    it('con monto "2.000" llama una vez a basp_editar_movimiento con p_monto "2000.00" y los demás parámetros, y devuelve { ok: true }', async () => {
      const resultado = await EditarMovimiento(datosEdicion);

      expect(resultado).toEqual({ ok: true });
      expect(simulacion.llamadasRpc).toEqual([
        {
          nombre: 'basp_editar_movimiento',
          parametros: {
            p_id_movimiento: '3f2b8c1e-5a4d-4e7f-9b6a-1c2d3e4f5a6b',
            p_tipo: 'GASTO',
            p_monto: '2000.00',
            p_id_categoria: 'categoria-mercado',
            p_fecha: '2026-09-18',
          },
        },
      ]);
    });

    it.each([
      ['un rechazo BA500 (falla simulada)', () => ({ data: null, error: { code: 'BA500', message: 'Falla simulada' } })],
      ['un rechazo BA422 (monto)', () => ({ data: null, error: { code: 'BA422', message: 'Monto inválido' } })],
      ['una respuesta sin data', () => ({ data: null, error: null })],
      [
        'una excepción de red',
        () => {
          throw new Error('Failed to fetch');
        },
      ],
    ])('(error E3-4) ante %s devuelve exactamente { ok: false }, sin el error de Supabase (FR-22)', async (_, responder) => {
      simulacion.respuestasRpc.basp_editar_movimiento = responder;

      const resultado = await EditarMovimiento(datosEdicion);

      expect(simulacion.llamadasRpc).toHaveLength(1);
      expect(simulacion.llamadasRpc[0].nombre).toBe('basp_editar_movimiento');
      expect(resultado).toEqual({ ok: false });
    });
  });
});
