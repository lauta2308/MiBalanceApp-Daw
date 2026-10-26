import { describe, expect, it } from 'vitest';
import { OrdenarCategorias } from './categorias.js';

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
});
