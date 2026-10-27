import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmacionEliminarMovimiento } from './ConfirmacionEliminarMovimiento.jsx';

const textoPregunta = '¿Está seguro que desea eliminar este movimiento?';

// La confirmación se monta entre otros controles de la página ("Antes" y
// "Después"), para comprobar que Tab y Mayús+Tab no salen del diálogo.
function RenderizarConfirmacion({ eliminando = false, alConfirmar = vi.fn(), alCancelar = vi.fn() } = {}) {
  function Prueba({ eliminandoActual }) {
    return (
      <>
        <button type="button">Antes</button>
        <ConfirmacionEliminarMovimiento
          eliminando={eliminandoActual}
          alConfirmar={alConfirmar}
          alCancelar={alCancelar}
        />
        <button type="button">Después</button>
      </>
    );
  }
  const { rerender } = render(<Prueba eliminandoActual={eliminando} />);
  return {
    alConfirmar,
    alCancelar,
    EstablecerEliminando: (valor) => rerender(<Prueba eliminandoActual={valor} />),
  };
}

function ObtenerCancelar() {
  return screen.getByRole('button', { name: 'Cancelar' });
}

function ObtenerConfirmar() {
  return screen.getByRole('button', { name: /^(Confirmar|Eliminando…)$/ });
}

describe('ConfirmacionEliminarMovimiento', () => {
  it('es un diálogo modal nombrado por la pregunta, con "Confirmar" y "Cancelar", y el foco en "Cancelar" (AC-02, D2)', () => {
    RenderizarConfirmacion();

    const dialogo = screen.getByRole('alertdialog', { name: textoPregunta });
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).toHaveClass('confirmacion-eliminar');
    expect(dialogo.parentElement).toHaveClass('fondo-confirmacion');
    expect(screen.getByText(textoPregunta)).toBeInTheDocument();
    expect(dialogo).toContainElement(ObtenerCancelar());
    expect(dialogo).toContainElement(screen.getByRole('button', { name: 'Confirmar' }));
    expect(ObtenerCancelar().closest('.botones-confirmacion')).not.toBeNull();
    expect(document.activeElement).toBe(ObtenerCancelar());
  });

  it('"Confirmar" llama a alConfirmar y "Cancelar" a alCancelar', async () => {
    const usuario = userEvent.setup();
    const { alConfirmar, alCancelar } = RenderizarConfirmacion();

    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(alConfirmar).toHaveBeenCalledTimes(1);
    expect(alCancelar).not.toHaveBeenCalled();

    await usuario.click(ObtenerCancelar());
    expect(alCancelar).toHaveBeenCalledTimes(1);
    expect(alConfirmar).toHaveBeenCalledTimes(1);
  });

  it('Escape llama a alCancelar (D2)', () => {
    const { alCancelar, alConfirmar } = RenderizarConfirmacion();

    fireEvent.keyDown(ObtenerCancelar(), { key: 'Escape' });

    expect(alCancelar).toHaveBeenCalledTimes(1);
    expect(alConfirmar).not.toHaveBeenCalled();
  });

  it('Tab y Mayús+Tab alternan entre "Cancelar" y "Confirmar" y no salen del diálogo (AC-13)', async () => {
    const usuario = userEvent.setup();
    RenderizarConfirmacion();
    const cancelar = ObtenerCancelar();
    const confirmar = screen.getByRole('button', { name: 'Confirmar' });

    await usuario.tab();
    expect(document.activeElement).toBe(confirmar);
    await usuario.tab();
    expect(document.activeElement).toBe(cancelar);
    await usuario.tab({ shift: true });
    expect(document.activeElement).toBe(confirmar);
    await usuario.tab({ shift: true });
    expect(document.activeElement).toBe(cancelar);
  });

  it('mientras elimina, "Confirmar" dice "Eliminando…" con aria-disabled, sin disabled, y toma el foco; "Cancelar" queda deshabilitado (D5)', () => {
    const { EstablecerEliminando } = RenderizarConfirmacion();
    expect(document.activeElement).toBe(ObtenerCancelar());

    EstablecerEliminando(true);

    const confirmar = screen.getByRole('button', { name: 'Eliminando…' });
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();
    expect(confirmar).toHaveAttribute('aria-disabled', 'true');
    expect(confirmar).not.toHaveAttribute('disabled');
    expect(document.activeElement).toBe(confirmar);
    expect(ObtenerCancelar()).toBeDisabled();
  });

  it('mientras elimina, Escape no llama a alCancelar y Tab y Mayús+Tab dejan el foco en "Eliminando…" (D5, E3-3)', () => {
    const { alCancelar, EstablecerEliminando } = RenderizarConfirmacion();
    EstablecerEliminando(true);
    const confirmar = ObtenerConfirmar();

    fireEvent.keyDown(confirmar, { key: 'Escape' });
    expect(alCancelar).not.toHaveBeenCalled();

    const eventoTab = fireEvent.keyDown(confirmar, { key: 'Tab' });
    expect(eventoTab).toBe(false);
    expect(document.activeElement).toBe(confirmar);
    const eventoMayusTab = fireEvent.keyDown(confirmar, { key: 'Tab', shiftKey: true });
    expect(eventoMayusTab).toBe(false);
    expect(document.activeElement).toBe(confirmar);
  });

  // El mousedown cancelado impide que el clic le quite el foco al diálogo y lo
  // deje en <body>, desde donde Tab saldría del modal (NFR-04, D1).
  it.each([
    ['el fondo', () => document.querySelector('.fondo-confirmacion')],
    ['el texto de la pregunta', () => screen.getByText(textoPregunta)],
  ])('un mousedown sobre %s se cancela y el foco sigue en "Cancelar"', (_, ObtenerZona) => {
    RenderizarConfirmacion();

    const evento = fireEvent.mouseDown(ObtenerZona());

    expect(evento).toBe(false);
    expect(document.activeElement).toBe(ObtenerCancelar());
  });

  it('un mousedown sobre "Cancelar" deshabilitado (mientras elimina) se cancela y el foco sigue en "Eliminando…"', () => {
    const { EstablecerEliminando } = RenderizarConfirmacion();
    EstablecerEliminando(true);

    const evento = fireEvent.mouseDown(ObtenerCancelar());

    expect(evento).toBe(false);
    expect(document.activeElement).toBe(ObtenerConfirmar());
  });

  it('un mousedown sobre un botón habilitado no se cancela', () => {
    RenderizarConfirmacion();

    expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'Confirmar' }))).toBe(true);
    expect(fireEvent.mouseDown(ObtenerCancelar())).toBe(true);
  });

  it('al terminar de eliminar sin cerrarse, "Confirmar" vuelve a su texto y "Cancelar" se habilita', () => {
    const { EstablecerEliminando } = RenderizarConfirmacion();
    EstablecerEliminando(true);

    EstablecerEliminando(false);

    const confirmar = screen.getByRole('button', { name: 'Confirmar' });
    expect(confirmar).not.toHaveAttribute('aria-disabled');
    expect(ObtenerCancelar()).toBeEnabled();
  });
});
