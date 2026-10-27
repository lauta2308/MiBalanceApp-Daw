import { describe, expect, it } from 'vitest';
import * as textos from './textos.js';

describe('textos de los mensajes', () => {
  it('mensajeMovimientoActualizado es "Movimiento actualizado con éxito." (FR-20)', () => {
    expect(textos.mensajeMovimientoActualizado).toBe('Movimiento actualizado con éxito.');
  });

  it('mensajeMovimientoEliminado es "Movimiento eliminado con éxito." (FR-07)', () => {
    expect(textos.mensajeMovimientoEliminado).toBe('Movimiento eliminado con éxito.');
  });

  it('mensajeErrorEliminarMovimiento es el texto de FR-10', () => {
    expect(textos.mensajeErrorEliminarMovimiento).toBe(
      'No se pudo eliminar el movimiento. Vuelva a intentarlo.',
    );
  });

  it('la confirmación usa "¿Está seguro que desea eliminar este movimiento?", "Confirmar" y "Cancelar" (FR-02)', () => {
    expect(textos.textoConfirmarEliminacion).toBe(
      '¿Está seguro que desea eliminar este movimiento?',
    );
    expect(textos.textoBotonConfirmar).toBe('Confirmar');
    expect(textos.textoBotonCancelar).toBe('Cancelar');
  });

  it('textoEliminando es "Eliminando…" (FR-06)', () => {
    expect(textos.textoEliminando).toBe('Eliminando…');
  });
});
