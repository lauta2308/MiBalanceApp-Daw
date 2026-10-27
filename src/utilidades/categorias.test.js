import { describe, expect, it } from 'vitest';
import { ObtenerCategoriaPorDefecto, OrdenarCategorias } from './categorias.js';

describe('OrdenarCategorias', () => {
  it('pone la categoría por defecto primero y el resto en orden alfabético sin distinguir mayúsculas (AC-26)', () => {
    const lista = [
      { id: '1', nombre: 'Transporte', es_por_defecto: false },
      { id: '2', nombre: 'café', es_por_defecto: false },
      { id: '3', nombre: 'Mercado', es_por_defecto: false },
      { id: '4', nombre: 'Pago Realizado', es_por_defecto: true },
    ];
    expect(OrdenarCategorias(lista).map((categoria) => categoria.nombre)).toEqual([
      'Pago Realizado',
      'café',
      'Mercado',
      'Transporte',
    ]);
  });

  it('devuelve una lista nueva ordenada sin modificar la recibida', () => {
    const lista = [
      { id: '1', nombre: 'Transporte', es_por_defecto: false },
      { id: '2', nombre: 'Pago Realizado', es_por_defecto: true },
    ];
    const ordenada = OrdenarCategorias(lista);
    expect(ordenada.map((categoria) => categoria.nombre)).toEqual(['Pago Realizado', 'Transporte']);
    expect(lista.map((categoria) => categoria.nombre)).toEqual(['Transporte', 'Pago Realizado']);
  });

  it('ordena los nombres con tilde junto a su letra base (FR-17)', () => {
    const lista = ['Ómnibus', 'nafta', 'árbol', 'Agua'].map((nombre, indice) => ({
      id: String(indice + 1),
      nombre,
      es_por_defecto: false,
    }));
    expect(OrdenarCategorias(lista).map((categoria) => categoria.nombre)).toEqual([
      'Agua',
      'árbol',
      'nafta',
      'Ómnibus',
    ]);
  });

  it('con la lista vacía devuelve una lista vacía', () => {
    expect(OrdenarCategorias([])).toEqual([]);
  });
});

describe('ObtenerCategoriaPorDefecto', () => {
  it('devuelve el id de la categoría por defecto aunque no sea la primera (FR-18)', () => {
    const lista = [
      { id: 'cat-ahorro', nombre: 'Ahorro', es_por_defecto: false },
      { id: 'cat-pago-realizado', nombre: 'Pago Realizado', es_por_defecto: true },
    ];
    expect(ObtenerCategoriaPorDefecto(lista)).toBe('cat-pago-realizado');
  });

  it('sin una categoría por defecto devuelve el id de la primera (FR-15: siempre hay una elegida)', () => {
    const lista = [
      { id: 'cat-mercado', nombre: 'Mercado', es_por_defecto: false },
      { id: 'cat-transporte', nombre: 'Transporte', es_por_defecto: false },
    ];
    expect(ObtenerCategoriaPorDefecto(lista)).toBe('cat-mercado');
  });

  it('con la lista vacía devuelve null en lugar de fallar', () => {
    expect(ObtenerCategoriaPorDefecto([])).toBeNull();
  });
});
