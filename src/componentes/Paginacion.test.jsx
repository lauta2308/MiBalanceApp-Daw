import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Paginacion } from './Paginacion.jsx';

const tamanoPagina = 50;

function RenderizarPaginacion({ numeroPagina = 1, total, deshabilitada = false } = {}) {
  const alAnterior = vi.fn();
  const alSiguiente = vi.fn();
  render(
    <Paginacion
      numeroPagina={numeroPagina}
      total={total}
      tamanoPagina={tamanoPagina}
      deshabilitada={deshabilitada}
      alAnterior={alAnterior}
      alSiguiente={alSiguiente}
    />,
  );
  return { alAnterior, alSiguiente };
}

function ObtenerBoton(nombre) {
  return screen.queryByRole('button', { name: nombre });
}

describe('Paginacion', () => {
  it('con total 120 en la página 1 muestra "Página 1 de 3" y "Anterior" deshabilitado (AC-41)', () => {
    RenderizarPaginacion({ numeroPagina: 1, total: 120 });

    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
    expect(ObtenerBoton('Anterior')).toBeDisabled();
    expect(ObtenerBoton('Siguiente')).toBeEnabled();
  });

  it('en la última página "Siguiente" está deshabilitado y "Anterior" habilitado (AC-42)', () => {
    RenderizarPaginacion({ numeroPagina: 3, total: 120 });

    expect(screen.getByText('Página 3 de 3')).toBeInTheDocument();
    expect(ObtenerBoton('Siguiente')).toBeDisabled();
    expect(ObtenerBoton('Anterior')).toBeEnabled();
  });

  it('"Anterior" y "Siguiente" llaman a alAnterior y alSiguiente (FR-40)', () => {
    const { alAnterior, alSiguiente } = RenderizarPaginacion({ numeroPagina: 2, total: 120 });

    fireEvent.click(ObtenerBoton('Siguiente'));
    fireEvent.click(ObtenerBoton('Anterior'));

    expect(alSiguiente).toHaveBeenCalledTimes(1);
    expect(alAnterior).toHaveBeenCalledTimes(1);
  });

  it('con total 30 no muestra "Anterior", "Siguiente" ni el indicador (AC-43)', () => {
    const propiedades = {
      numeroPagina: 1,
      tamanoPagina,
      alAnterior: vi.fn(),
      alSiguiente: vi.fn(),
    };
    const { rerender } = render(<Paginacion {...propiedades} total={30} />);

    expect(ObtenerBoton('Anterior')).not.toBeInTheDocument();
    expect(ObtenerBoton('Siguiente')).not.toBeInTheDocument();
    expect(screen.queryByText(/Página/)).not.toBeInTheDocument();

    // Control: el mismo componente con más de 50 sí se muestra, así que la
    // ausencia anterior se debe al total.
    rerender(<Paginacion {...propiedades} total={120} />);
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
  });

  it('con total 50 no se muestra; con total 51 muestra "Página 1 de 2" y "Siguiente" habilitado (AC-64)', () => {
    const { unmount } = render(
      <Paginacion
        numeroPagina={1}
        total={50}
        tamanoPagina={tamanoPagina}
        alAnterior={vi.fn()}
        alSiguiente={vi.fn()}
      />,
    );
    expect(ObtenerBoton('Siguiente')).not.toBeInTheDocument();
    expect(screen.queryByText(/Página/)).not.toBeInTheDocument();
    unmount();

    RenderizarPaginacion({ numeroPagina: 1, total: 51 });
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
    expect(ObtenerBoton('Siguiente')).toBeEnabled();
  });

  it('deshabilitada (mientras carga) marca ambos botones con aria-disabled, sin disabled, e ignora los clics (NFR-07)', () => {
    const alAnterior = vi.fn();
    const alSiguiente = vi.fn();
    const propiedades = { numeroPagina: 2, total: 120, tamanoPagina, alAnterior, alSiguiente };
    const { rerender } = render(<Paginacion {...propiedades} deshabilitada />);

    for (const nombre of ['Anterior', 'Siguiente']) {
      // Sin disabled real: el botón con el foco lo conserva.
      expect(ObtenerBoton(nombre)).not.toHaveAttribute('disabled');
      expect(ObtenerBoton(nombre)).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(ObtenerBoton(nombre));
    }
    expect(alAnterior).not.toHaveBeenCalled();
    expect(alSiguiente).not.toHaveBeenCalled();

    // Al terminar la carga, aria-disabled desaparece y los clics vuelven a funcionar.
    rerender(<Paginacion {...propiedades} deshabilitada={false} />);
    expect(ObtenerBoton('Anterior')).not.toHaveAttribute('aria-disabled');
    expect(ObtenerBoton('Siguiente')).not.toHaveAttribute('aria-disabled');
    fireEvent.click(ObtenerBoton('Siguiente'));
    expect(alSiguiente).toHaveBeenCalledTimes(1);
  });

  it('deshabilitada en los extremos: "Anterior" de la página 1 y "Siguiente" de la última siguen con disabled real', () => {
    const { unmount } = render(
      <Paginacion
        numeroPagina={1}
        total={120}
        tamanoPagina={tamanoPagina}
        deshabilitada
        alAnterior={vi.fn()}
        alSiguiente={vi.fn()}
      />,
    );
    expect(ObtenerBoton('Anterior')).toBeDisabled();
    expect(ObtenerBoton('Siguiente')).not.toHaveAttribute('disabled');
    unmount();

    RenderizarPaginacion({ numeroPagina: 3, total: 120, deshabilitada: true });
    expect(ObtenerBoton('Siguiente')).toBeDisabled();
    expect(ObtenerBoton('Anterior')).not.toHaveAttribute('disabled');
  });

  it('calcula las páginas con el tamaño que recibe por prop (tamanoPagina)', () => {
    render(
      <Paginacion
        numeroPagina={1}
        total={25}
        tamanoPagina={10}
        alAnterior={vi.fn()}
        alSiguiente={vi.fn()}
      />,
    );

    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
  });
});
