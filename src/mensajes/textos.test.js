import { describe, expect, it } from 'vitest';
import * as textos from './textos.js';

describe('textos de los mensajes', () => {
  it('mensajeMovimientoActualizado es "Movimiento actualizado con éxito." (FR-20)', () => {
    expect(textos.mensajeMovimientoActualizado).toBe('Movimiento actualizado con éxito.');
  });
});
