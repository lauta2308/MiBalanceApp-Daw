import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MensajeError } from './MensajeError.jsx';
import { AntesDeEfectosPasivos } from '../pruebas/antesDeEfectosPasivos.jsx';

const mensajeMonto = 'El monto debe ser mayor a 0.';

function RenderizarConControlesAlrededor(alAceptar = vi.fn()) {
  render(
    <>
      <button type="button">Antes</button>
      <MensajeError texto={mensajeMonto} alAceptar={alAceptar} />
      <button type="button">Después</button>
    </>,
  );
}

describe('MensajeError', () => {
  it('es un diálogo modal (aria-modal) con el foco en "Aceptar" (FR-44, NFR-07)', () => {
    RenderizarConControlesAlrededor();

    expect(screen.getByRole('alertdialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Aceptar' })).toHaveFocus();
  });

  it('Tab deja el foco en "Aceptar"', async () => {
    const usuario = userEvent.setup();
    RenderizarConControlesAlrededor();

    await usuario.tab();

    expect(screen.getByRole('button', { name: 'Aceptar' })).toHaveFocus();
  });

  it('Shift+Tab deja el foco en "Aceptar"', async () => {
    const usuario = userEvent.setup();
    RenderizarConControlesAlrededor();

    await usuario.tab({ shift: true });

    expect(screen.getByRole('button', { name: 'Aceptar' })).toHaveFocus();
  });

  it('Escape no cierra el diálogo: solo se cierra con "Aceptar" (FR-44)', () => {
    const alAceptar = vi.fn();
    RenderizarConControlesAlrededor(alAceptar);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Aceptar' }), { key: 'Escape' });

    expect(alAceptar).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  // FR-44, AC-72: un clic en el fondo o en el texto no le saca el foco a
  // "Aceptar"; jsdom no mueve el foco con el mousedown, así que se verifica
  // que se cancele (en Chrome lo prueba accesibilidad.spec.js).
  it.each([
    ['el fondo', () => document.querySelector('.fondo-mensaje-error')],
    ['el texto del mensaje', () => screen.getByText(mensajeMonto)],
  ])('un mousedown sobre %s se cancela y el foco sigue en "Aceptar"', (_, ObtenerZona) => {
    RenderizarConControlesAlrededor();

    const evento = fireEvent.mouseDown(ObtenerZona());

    expect(evento).toBe(false);
    expect(screen.getByRole('button', { name: 'Aceptar' })).toHaveFocus();
  });

  it('un mousedown sobre "Aceptar" no se cancela', () => {
    RenderizarConControlesAlrededor();

    expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'Aceptar' }))).toBe(true);
  });

  it('(regresión 4) "Aceptar" ya tiene el foco en el commit que monta el mensaje, antes de los efectos pasivos', () => {
    let focoEnElCommit = null;
    render(
      <AntesDeEfectosPasivos
        alComprometer={() => {
          focoEnElCommit = document.activeElement;
        }}
      >
        <MensajeError texto={mensajeMonto} alAceptar={vi.fn()} />
      </AntesDeEfectosPasivos>,
    );

    expect(focoEnElCommit).toBe(screen.getByRole('button', { name: 'Aceptar' }));
  });

  it('(regresión 4) un clic en "Aceptar" antes de los efectos pasivos no vuelve a llevar el foco a "Aceptar"', () => {
    function AceptarYEnfocarAfuera() {
      screen.getByRole('button', { name: 'Después' }).focus();
    }
    render(
      <AntesDeEfectosPasivos
        alComprometer={() => screen.getByRole('button', { name: 'Aceptar' }).click()}
      >
        <MensajeError texto={mensajeMonto} alAceptar={AceptarYEnfocarAfuera} />
        <button type="button">Después</button>
      </AntesDeEfectosPasivos>,
    );

    expect(screen.getByRole('button', { name: 'Después' })).toHaveFocus();
  });
});
