import { describe, expect, it } from 'vitest';
import { AgruparPorFecha } from './listaMovimientos.js';

function CrearMovimientosEjemploAc63() {
  // 55 movimientos ordenados como la vista: los lugares 48 a 55 son del 2026-10-01.
  return Array.from({ length: 55 }, (_, indice) => ({
    id: `movimiento-${indice + 1}`,
    fecha: indice + 1 >= 48 ? '2026-10-01' : '2026-10-02',
    tipo: 'GASTO',
    monto: '100.00',
    nombre_categoria: 'Pago Realizado',
  }));
}

describe('AgruparPorFecha', () => {
  it('la página 2 del ejemplo de AC-63 empieza con el grupo "2026-10-01" (FR-35, FR-47)', () => {
    const pagina2 = CrearMovimientosEjemploAc63().slice(50, 55);
    const grupos = AgruparPorFecha(pagina2);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].fecha).toBe('2026-10-01');
    expect(grupos[0].movimientos.map((movimiento) => movimiento.id)).toEqual([
      'movimiento-51',
      'movimiento-52',
      'movimiento-53',
      'movimiento-54',
      'movimiento-55',
    ]);
  });

  it('agrupa en el orden recibido (AC-36)', () => {
    const movimientos = [
      { id: 'cafe', fecha: '2026-10-01' },
      { id: 'sueldo', fecha: '2026-10-01' },
      { id: 'mercado', fecha: '2026-09-17' },
    ];
    expect(AgruparPorFecha(movimientos)).toEqual([
      { fecha: '2026-10-01', movimientos: [movimientos[0], movimientos[1]] },
      { fecha: '2026-09-17', movimientos: [movimientos[2]] },
    ]);
  });

  it('abre un grupo nuevo cada vez que cambia la fecha y no devuelve grupos sin movimientos', () => {
    expect(AgruparPorFecha([])).toEqual([]);
    const grupos = AgruparPorFecha([
      { id: 'a', fecha: '2026-10-02' },
      { id: 'b', fecha: '2026-10-01' },
    ]);
    expect(grupos.map((grupo) => grupo.fecha)).toEqual(['2026-10-02', '2026-10-01']);
  });
});
