import { beforeEach, describe, expect, it, vi } from 'vitest';

// Cliente de Supabase simulado: registra tabla, select y filtros eq, y responde
// con lo que indique la prueba.
const simulacion = vi.hoisted(() => ({ consultas: [], responder: null }));

vi.mock('./clienteSupabase.js', () => {
  function CrearConsulta(tabla) {
    const registro = { tabla, select: null, filtros: [] };
    simulacion.consultas.push(registro);
    const consulta = {
      select(...argumentos) {
        registro.select = argumentos;
        return consulta;
      },
      eq(columna, valor) {
        registro.filtros.push([columna, valor]);
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
  return { clienteSupabase: { from: (tabla) => CrearConsulta(tabla) } };
});

import { ObtenerCategorias } from './categorias.js';

function CrearCategoria(id, nombre, tipo, esPorDefecto = false) {
  return { id, nombre, tipo, es_por_defecto: esPorDefecto };
}

const categoriasServidor = [
  CrearCategoria('cat-transporte', 'Transporte', 'GASTO'),
  CrearCategoria('cat-sueldo', 'Sueldo', 'INGRESO'),
  CrearCategoria('cat-cafe', 'café', 'GASTO'),
  CrearCategoria('cat-pago-ingresado', 'Pago Ingresado', 'INGRESO', true),
  CrearCategoria('cat-mercado', 'Mercado', 'GASTO'),
  CrearCategoria('cat-pago-realizado', 'Pago Realizado', 'GASTO', true),
];

// Responde como PostgREST: aplica los filtros eq que pidió el servicio.
function ResponderConFiltros(registro) {
  const filas = categoriasServidor.filter((categoria) =>
    registro.filtros.every(([columna, valor]) => categoria[columna] === valor),
  );
  return { data: filas, error: null };
}

describe('ObtenerCategorias', () => {
  beforeEach(() => {
    simulacion.consultas.length = 0;
    simulacion.responder = ResponderConFiltros;
  });

  it('pide bat_categorias filtrado por tipo y las devuelve con la por defecto primero y el resto en orden alfabético (FR-16, FR-17, AC-26)', async () => {
    const resultado = await ObtenerCategorias('GASTO');

    expect(resultado.ok).toBe(true);
    expect(resultado.categorias.map((categoria) => categoria.nombre)).toEqual([
      'Pago Realizado',
      'café',
      'Mercado',
      'Transporte',
    ]);
    const [consulta] = simulacion.consultas;
    expect(consulta.tabla).toBe('bat_categorias');
    expect(consulta.filtros).toEqual([['tipo', 'GASTO']]);
    expect(consulta.select[0].split(',').map((columna) => columna.trim())).toEqual(
      expect.arrayContaining(['id', 'nombre', 'tipo', 'es_por_defecto']),
    );
  });

  it('para INGRESO devuelve solo las categorías de ingresos', async () => {
    const resultado = await ObtenerCategorias('INGRESO');

    expect(resultado.categorias.map((categoria) => categoria.id)).toEqual([
      'cat-pago-ingresado',
      'cat-sueldo',
    ]);
    expect(simulacion.consultas[0].filtros).toEqual([['tipo', 'INGRESO']]);
  });

  it.each([
    ['un error de Supabase', () => ({ data: null, error: { code: 'PGRST301', message: 'JWT expired' } })],
    ['una respuesta sin filas', () => ({ data: [], error: null })],
    [
      'una excepción de red',
      () => {
        throw new Error('Failed to fetch');
      },
    ],
  ])('(error E6-4) ante %s devuelve exactamente { ok: false } (NFR-06)', async (_, responder) => {
    simulacion.responder = responder;

    const resultado = await ObtenerCategorias('GASTO');

    expect(simulacion.consultas).toHaveLength(1);
    expect(resultado).toEqual({ ok: false });
  });
});
