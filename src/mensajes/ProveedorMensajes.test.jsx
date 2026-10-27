import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ProveedorMensajes, useMensajes } from './ProveedorMensajes.jsx';

const mensajeGasto = 'Gasto registrado con éxito.';
const mensajeIngreso = 'Ingreso registrado con éxito.';
const mensajeMonto = 'El monto debe ser mayor a 0.';
const mensajeGuardar = 'No se pudo guardar el movimiento. Vuelva a intentarlo.';

function ComponentePrueba({ alAceptar }) {
  const { MostrarExito, MostrarError } = useMensajes();
  const campoMonto = useRef(null);
  return (
    <>
      <label htmlFor="monto">Monto</label>
      <input id="monto" ref={campoMonto} />
      <button type="button" onClick={() => MostrarExito(mensajeGasto)}>
        Éxito Gasto
      </button>
      <button type="button" onClick={() => MostrarExito(mensajeIngreso)}>
        Éxito Ingreso
      </button>
      <button
        type="button"
        onClick={() =>
          MostrarError(mensajeMonto, { alAceptar, elementoFoco: campoMonto.current })
        }
      >
        Mostrar Error
      </button>
      <button type="button" onClick={() => MostrarError(mensajeGuardar)}>
        Error sin Foco
      </button>
    </>
  );
}

function RenderizarProveedor(alAceptar = vi.fn()) {
  render(
    <ProveedorMensajes>
      <ComponentePrueba alAceptar={alAceptar} />
    </ProveedorMensajes>,
  );
}

// Con timers simulados se usa fireEvent (síncrono): user-event espera timers
// reales que Testing Library no avanza cuando los simula Vitest.
function AvanzarTiempo(milisegundos) {
  act(() => {
    vi.advanceTimersByTime(milisegundos);
  });
}

describe('ProveedorMensajes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tiene una región viva vacía en el DOM antes de cualquier mensaje (NFR-07)', () => {
    RenderizarProveedor();

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
    expect(region).toBeEmptyDOMElement();
  });

  it('MostrarExito muestra el texto con el tic "Éxito", sin "Aceptar", y lo cierra a los 3 s (AC-45)', () => {
    RenderizarProveedor();
    const region = screen.getByRole('status');

    fireEvent.click(screen.getByRole('button', { name: 'Éxito Gasto' }));

    expect(screen.getByRole('status')).toBe(region);
    expect(region).toHaveTextContent(mensajeGasto);
    expect(screen.getByRole('img', { name: 'Éxito' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aceptar' })).not.toBeInTheDocument();

    AvanzarTiempo(2999);
    expect(screen.getByText(mensajeGasto)).toBeInTheDocument();

    AvanzarTiempo(1);
    expect(screen.queryByText(mensajeGasto)).not.toBeInTheDocument();
    // La región sigue en el DOM, vacía, para anunciar el próximo mensaje.
    expect(screen.getByRole('status')).toBe(region);
    expect(region).toBeEmptyDOMElement();
  });

  it('(E4-3) un segundo MostrarExito a los 2 s reemplaza al primero y cuenta sus propios 3 s (AC-46)', () => {
    RenderizarProveedor();

    fireEvent.click(screen.getByRole('button', { name: 'Éxito Ingreso' }));
    AvanzarTiempo(2000);
    fireEvent.click(screen.getByRole('button', { name: 'Éxito Gasto' }));
    AvanzarTiempo(0); // el texto nuevo se escribe en el tick siguiente

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.queryByText(mensajeIngreso)).not.toBeInTheDocument();
    expect(screen.getByText(mensajeGasto)).toBeInTheDocument();

    AvanzarTiempo(2000); // 4 s desde el primero
    expect(screen.getByText(mensajeGasto)).toBeInTheDocument();

    AvanzarTiempo(1000); // 5 s desde el primero, 3 s desde el segundo
    expect(screen.queryByText(mensajeGasto)).not.toBeInTheDocument();
  });

  it('un mensaje con el mismo texto vacía la región y lo vuelve a escribir para que se anuncie (NFR-07)', () => {
    RenderizarProveedor();
    const region = screen.getByRole('status');

    fireEvent.click(screen.getByRole('button', { name: 'Éxito Gasto' }));
    AvanzarTiempo(1000);
    fireEvent.click(screen.getByRole('button', { name: 'Éxito Gasto' }));

    expect(region).toBeEmptyDOMElement();

    AvanzarTiempo(0);
    expect(region).toHaveTextContent(mensajeGasto);
    expect(screen.getByRole('status')).toBe(region);
  });

  it('MostrarError sigue visible a los 10 s, se cierra con "Aceptar" y devuelve el foco (AC-47, FR-44)', () => {
    const alAceptar = vi.fn();
    RenderizarProveedor(alAceptar);

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar Error' }));

    const dialogo = screen.getByRole('alertdialog');
    expect(dialogo).toHaveTextContent(mensajeMonto);
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('img', { name: 'Error' })).toBeInTheDocument();
    const botonAceptar = screen.getByRole('button', { name: 'Aceptar' });
    expect(botonAceptar).toHaveFocus();

    AvanzarTiempo(10_000);
    expect(screen.getByRole('alertdialog')).toHaveTextContent(mensajeMonto);

    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByText(mensajeMonto)).not.toBeInTheDocument();
    expect(alAceptar).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Monto')).toHaveFocus();
  });

  it('sin elementoFoco, "Aceptar" devuelve el foco al elemento activo al mostrar el error', () => {
    RenderizarProveedor();
    const botonDisparador = screen.getByRole('button', { name: 'Error sin Foco' });

    botonDisparador.focus();
    fireEvent.click(botonDisparador);
    expect(screen.getByRole('button', { name: 'Aceptar' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(botonDisparador).toHaveFocus();
  });

  it('un MostrarError con otro error en pantalla lo reemplaza y devuelve el foco a "Aceptar"', () => {
    RenderizarProveedor();

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar Error' }));
    screen.getByLabelText('Monto').focus();
    fireEvent.click(screen.getByRole('button', { name: 'Error sin Foco' }));

    expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
    expect(screen.getByRole('alertdialog')).toHaveTextContent(mensajeGuardar);
    expect(screen.getByRole('button', { name: 'Aceptar' })).toHaveFocus();
  });
});
