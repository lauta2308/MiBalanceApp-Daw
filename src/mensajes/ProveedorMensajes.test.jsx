import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
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

// Muestra un error cuyo elementoFoco sale del DOM antes de "Aceptar", como la
// fila de un movimiento cuando el usuario se va de Cuenta (FR-44).
function ComponenteFocoDesconectado({ conOtrosControles = true }) {
  const { MostrarError } = useMensajes();
  const [mostrarControles, EstablecerMostrarControles] = useState(true);
  const campoTemporal = useRef(null);

  function ManejarError() {
    MostrarError(mensajeGuardar, { elementoFoco: campoTemporal.current });
    EstablecerMostrarControles(false);
  }

  return (
    <>
      <h1>Pantalla Actual</h1>
      {conOtrosControles && (
        <button type="button" disabled>
          Deshabilitado
        </button>
      )}
      {conOtrosControles && <button type="button">Primer Botón</button>}
      {mostrarControles && <input aria-label="Campo Temporal" ref={campoTemporal} />}
      {mostrarControles && (
        <button type="button" onClick={ManejarError}>
          Error y Quitar Campo
        </button>
      )}
    </>
  );
}

// Muestra un error cuyo "Aceptar" cambia de pantalla, como VolverACuenta tras
// un error de carga de la edición; el campo de origen se va con la pantalla.
function ComponenteCambioPantalla() {
  const { MostrarError } = useMensajes();
  const [pantallaNueva, EstablecerPantallaNueva] = useState(false);
  const [mostrarCampo, EstablecerMostrarCampo] = useState(true);
  const campoTemporal = useRef(null);
  const botonOrigen = useRef(null);

  function ManejarError() {
    MostrarError(mensajeGuardar, {
      elementoFoco: campoTemporal.current,
      alAceptar: () => EstablecerPantallaNueva(true),
    });
    EstablecerMostrarCampo(false);
  }

  // El origen sigue en el DOM al aceptar: lo desmonta el cambio de pantalla.
  function ManejarErrorConOrigenConectado() {
    MostrarError(mensajeGuardar, {
      elementoFoco: botonOrigen.current,
      alAceptar: () => EstablecerPantallaNueva(true),
    });
  }

  if (pantallaNueva) {
    // En un <section> para que React no reutilice los nodos de la pantalla anterior.
    return (
      <section>
        <h1>Pantalla Nueva</h1>
        <button type="button">Botón de la Pantalla Nueva</button>
      </section>
    );
  }
  return (
    <>
      <h1>Pantalla Anterior</h1>
      <button type="button">Botón de la Pantalla Anterior</button>
      {mostrarCampo && <input aria-label="Campo Temporal" ref={campoTemporal} />}
      <button type="button" onClick={ManejarError}>
        Error y Cambiar Pantalla
      </button>
      <button type="button" ref={botonOrigen} onClick={ManejarErrorConOrigenConectado}>
        Error con Origen Conectado
      </button>
    </>
  );
}

// Pantalla de origen cuyo "Aceptar" navega con el router real, como
// VolverACuenta: react-router aplica la navegación en una transición, en un
// commit posterior al que cierra el error.
function PantallaOrigenNavegacion() {
  const { MostrarError } = useMensajes();
  const navegar = useNavigate();
  const botonOrigen = useRef(null);
  return (
    <>
      <h1>Pantalla de Origen</h1>
      <button
        type="button"
        ref={botonOrigen}
        onClick={() =>
          MostrarError(mensajeGuardar, { elementoFoco: botonOrigen.current, alAceptar: () => navegar('/destino') })
        }
      >
        Error y Navegar
      </button>
    </>
  );
}

// Un error sin `alAceptar` no navega: la navegación posterior del usuario no
// debe recibir la reserva de foco.
function PantallaErrorSinNavegar() {
  const { MostrarError } = useMensajes();
  const navegar = useNavigate();
  const botonOrigen = useRef(null);
  return (
    <>
      <h1>Pantalla de Origen</h1>
      <button
        type="button"
        ref={botonOrigen}
        onClick={() => MostrarError(mensajeGuardar, { elementoFoco: botonOrigen.current })}
      >
        Error sin Navegar
      </button>
      <button type="button" onClick={() => navegar('/destino')}>
        Ir al Destino
      </button>
    </>
  );
}

function PantallaDestinoNavegacion() {
  return (
    <section>
      <h1>Pantalla de Destino</h1>
      <button type="button">Botón de Destino</button>
    </section>
  );
}

// El proveedor usa la ubicación del router (FR-44), como en App.
function RenderizarProveedor(alAceptar = vi.fn()) {
  render(
    <MemoryRouter>
      <ProveedorMensajes>
        <ComponentePrueba alAceptar={alAceptar} />
      </ProveedorMensajes>
    </MemoryRouter>,
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

  it('(FR-44) si elementoFoco ya no está en el DOM, "Aceptar" lleva el foco al primer botón de la pantalla, no a <body> ni al mensaje', () => {
    render(
      <MemoryRouter>
        <ProveedorMensajes>
          <ComponenteFocoDesconectado />
        </ProveedorMensajes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Error y Quitar Campo' }));
    expect(screen.queryByLabelText('Campo Temporal')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aceptar' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getByRole('button', { name: 'Primer Botón' })).toHaveFocus();
  });

  it('(FR-44) sin ningún control enfocable fuera del mensaje, "Aceptar" cierra el error sin lanzar', () => {
    render(
      <MemoryRouter>
        <ProveedorMensajes>
          <ComponenteFocoDesconectado conOtrosControles={false} />
        </ProveedorMensajes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Error y Quitar Campo' }));

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }))).not.toThrow();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pantalla Actual' })).toBeInTheDocument();
  });

  it('(FR-44) si "Aceptar" cambia de pantalla y elementoFoco ya no está, el foco va al primer control de la pantalla nueva', () => {
    render(
      <MemoryRouter>
        <ProveedorMensajes>
          <ComponenteCambioPantalla />
        </ProveedorMensajes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Error y Cambiar Pantalla' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pantalla Nueva' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Botón de la Pantalla Nueva' })).toHaveFocus();
  });

  it('(FR-44) un error mostrado con el foco en <body> deja el foco, al aceptar, en el primer control de la pantalla', () => {
    RenderizarProveedor();

    // fireEvent.click no mueve el foco: el error se muestra con el foco en <body>.
    expect(document.activeElement).toBe(document.body);
    fireEvent.click(screen.getByRole('button', { name: 'Error sin Foco' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Monto')).toHaveFocus();
  });

  it('(FR-44) si elementoFoco está conectado al aceptar pero "Aceptar" cambia de pantalla y lo desmonta, el foco va al primer control de la pantalla nueva', () => {
    render(
      <MemoryRouter>
        <ProveedorMensajes>
          <ComponenteCambioPantalla />
        </ProveedorMensajes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Error con Origen Conectado' }));
    expect(screen.getByRole('button', { name: 'Error con Origen Conectado' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Error con Origen Conectado' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Botón de la Pantalla Nueva' })).toHaveFocus();
  });

  it('(FR-44) si "Aceptar" navega con el router y desmonta elementoFoco, el foco va al primer control de la pantalla nueva', async () => {
    render(
      <MemoryRouter initialEntries={['/origen']}>
        <main>
          <ProveedorMensajes>
            <Routes>
              <Route path="/origen" element={<PantallaOrigenNavegacion />} />
              <Route path="/destino" element={<PantallaDestinoNavegacion />} />
            </Routes>
          </ProveedorMensajes>
        </main>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Error y Navegar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pantalla de Destino' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Botón de Destino' })).toHaveFocus();
  });

  it('(FR-44) tras cerrar un error sin "alAceptar", una navegación posterior del usuario no recibe la reserva de foco', async () => {
    render(
      <MemoryRouter initialEntries={['/origen']}>
        <main>
          <ProveedorMensajes>
            <Routes>
              <Route path="/origen" element={<PantallaErrorSinNavegar />} />
              <Route path="/destino" element={<PantallaDestinoNavegacion />} />
            </Routes>
          </ProveedorMensajes>
        </main>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Error sin Navegar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));
    expect(screen.getByRole('button', { name: 'Error sin Navegar' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Ir al Destino' }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByRole('heading', { name: 'Pantalla de Destino' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Botón de Destino' })).not.toHaveFocus();
  });
});
