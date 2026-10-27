import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { SelectorFecha } from './SelectorFecha.jsx';

// "Hoy" es el sábado 03/10/2026 (hora local de Buenos Aires, TZ de las pruebas).
// Solo se simula Date: los timers siguen siendo reales.
const ahoraSimulado = new Date(2026, 9, 3, 12, 0, 0);

function SelectorConEstado({ valorInicial, alCambiar }) {
  const [fecha, EstablecerFecha] = useState(valorInicial);
  return (
    <SelectorFecha
      valor={fecha}
      alCambiar={(fechaNueva) => {
        alCambiar(fechaNueva);
        EstablecerFecha(fechaNueva);
      }}
    />
  );
}

function RenderizarSelector(valorInicial = '2026-10-03') {
  const alCambiar = vi.fn();
  render(<SelectorConEstado valorInicial={valorInicial} alCambiar={alCambiar} />);
  return { alCambiar, campo: screen.getByLabelText('Fecha') };
}

function AbrirCalendario(campo) {
  fireEvent.click(campo);
  return screen.getByRole('grid');
}

// Celda del día "AAAA-MM-DD" en el calendario (react-day-picker la marca con data-day).
function ObtenerCeldaDia(textoFecha) {
  const celda = document.querySelector(`[data-day="${textoFecha}"]`);
  expect(celda).not.toBeNull();
  return celda;
}

function ObtenerBotonDia(textoFecha) {
  return within(ObtenerCeldaDia(textoFecha)).getByRole('button');
}

describe('SelectorFecha', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(ahoraSimulado);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('muestra el campo "Fecha" con la fecha en DD/MM/AAAA y el calendario cerrado', () => {
    const { campo } = RenderizarSelector('2026-09-17');

    expect(campo).toHaveTextContent('17/09/2026');
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('abre el calendario de octubre de 2026 en español, con la semana desde el lunes (AC-67, FR-48)', () => {
    const { campo } = RenderizarSelector();

    const calendario = AbrirCalendario(campo);

    expect(campo).toHaveTextContent('03/10/2026');
    expect(calendario).toHaveAccessibleName('octubre 2026');
    // react-day-picker oculta el encabezado (thead aria-hidden): cada día ya se
    // anuncia con su nombre completo. Se leen las celdas del DOM.
    const diasSemana = [...calendario.querySelectorAll('thead th')].map((encabezado) =>
      encabezado.getAttribute('aria-label'),
    );
    expect(diasSemana).toEqual(['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']);
    // El 1 de octubre de 2026 es jueves: la primera semana empieza el lunes 28/09.
    const primeraCelda = within(calendario).getAllByRole('gridcell')[0];
    expect(primeraCelda).toHaveAttribute('data-day', '2026-09-28');
  });

  it('preselecciona el día del valor (hoy) y deshabilita los días posteriores a hoy (AC-21, FR-20, FR-21)', () => {
    const { campo, alCambiar } = RenderizarSelector();
    AbrirCalendario(campo);

    expect(ObtenerCeldaDia('2026-10-03')).toHaveAttribute('aria-selected', 'true');
    for (const dia of ['2026-10-04', '2026-10-15', '2026-10-31']) {
      expect(ObtenerBotonDia(dia)).toBeDisabled();
    }
    expect(ObtenerBotonDia('2026-10-02')).toBeEnabled();

    fireEvent.click(ObtenerBotonDia('2026-10-04'));
    expect(alCambiar).not.toHaveBeenCalled();
    expect(campo).toHaveTextContent('03/10/2026');

    // No se puede pasar a un mes posterior a hoy.
    expect(screen.getByRole('button', { name: 'Ir al mes siguiente' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('solo selecciona la fecha, sin hora (AC-21, FR-19)', () => {
    const { campo } = RenderizarSelector();
    AbrirCalendario(campo);

    expect(document.querySelector('input[type="time"], input[type="datetime-local"]')).toBeNull();
    expect(screen.queryByLabelText(/hora/i)).not.toBeInTheDocument();
  });

  it('elegir el 01/10/2026 guarda "2026-10-01", cierra el calendario y devuelve el foco al campo', () => {
    const { campo, alCambiar } = RenderizarSelector();
    AbrirCalendario(campo);

    fireEvent.click(ObtenerBotonDia('2026-10-01'));

    expect(alCambiar).toHaveBeenCalledWith('2026-10-01');
    expect(campo).toHaveTextContent('01/10/2026');
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(campo);
  });

  it('no permite deseleccionar la fecha: presionar el día elegido la mantiene (AC-24)', () => {
    const { campo, alCambiar } = RenderizarSelector();
    AbrirCalendario(campo);

    fireEvent.click(ObtenerBotonDia('2026-10-03'));

    for (const [valor] of alCambiar.mock.calls) {
      expect(valor).toBe('2026-10-03');
    }
    expect(campo).toHaveTextContent('03/10/2026');
    AbrirCalendario(campo);
    expect(ObtenerCeldaDia('2026-10-03')).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: /borrar|limpiar|sin fecha/i })).not.toBeInTheDocument();
  });

  it('acepta cualquier fecha pasada: el 15/03/1990 con los selectores de año y mes (FR-23)', () => {
    const { campo, alCambiar } = RenderizarSelector();
    AbrirCalendario(campo);

    fireEvent.change(screen.getByRole('combobox', { name: 'Elegir el año' }), {
      target: { value: '1990' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Elegir el mes' }), {
      target: { value: '2' },
    });
    expect(screen.getByRole('grid')).toHaveAccessibleName('marzo 1990');
    fireEvent.click(ObtenerBotonDia('1990-03-15'));

    expect(alCambiar).toHaveBeenCalledWith('1990-03-15');
    expect(campo).toHaveTextContent('15/03/1990');
  });

  it('Escape cierra el calendario sin cambiar la fecha y devuelve el foco al campo (NFR-07)', () => {
    const { campo, alCambiar } = RenderizarSelector();
    const calendario = AbrirCalendario(campo);

    fireEvent.keyDown(calendario, { key: 'Escape' });

    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(alCambiar).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(campo);
  });

  it('Escape desde el campo "Fecha" también cierra el calendario y deja el foco en el campo (NFR-07)', () => {
    const { campo, alCambiar } = RenderizarSelector();
    AbrirCalendario(campo);
    campo.focus();

    fireEvent.keyDown(campo, { key: 'Escape' });

    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(alCambiar).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(campo);
  });

  it('Tab hacia afuera cierra el calendario sin mover el foco (NFR-07)', () => {
    const alCambiar = vi.fn();
    render(
      <>
        <SelectorConEstado valorInicial="2026-10-03" alCambiar={alCambiar} />
        <button type="button">Otro Control</button>
      </>,
    );
    AbrirCalendario(screen.getByLabelText('Fecha'));
    const otroControl = screen.getByRole('button', { name: 'Otro Control' });

    // focus() no pasa por fireEvent: se envuelve en act para que React aplique
    // el cierre antes de las aserciones.
    act(() => {
      otroControl.focus();
    });

    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(otroControl);
    expect(alCambiar).not.toHaveBeenCalled();
  });

  it('un clic afuera, en una zona no enfocable, cierra el calendario; un clic adentro no (NFR-07)', () => {
    const { campo, alCambiar } = RenderizarSelector();
    const calendario = AbrirCalendario(campo);

    fireEvent.pointerDown(calendario);
    expect(screen.getByRole('grid')).toBeInTheDocument();

    const quitarEscucha = vi.spyOn(document, 'removeEventListener');
    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(alCambiar).not.toHaveBeenCalled();
    // Al cerrarse deja de escuchar los clics del documento.
    expect(quitarEscucha).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    quitarEscucha.mockRestore();
  });

  it('al abrir, el foco pasa al día elegido para poder moverse con el teclado (NFR-07)', () => {
    const { campo } = RenderizarSelector();
    AbrirCalendario(campo);

    expect(document.activeElement).toBe(ObtenerBotonDia('2026-10-03'));
  });
});
