import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { SelectorTipo } from './SelectorTipo.jsx';

// Selector con estado propio, como lo usa el formulario de edición.
function SelectorConEstado({ tipoInicial, alCambiar }) {
  const [tipo, EstablecerTipo] = useState(tipoInicial);
  return (
    <SelectorTipo
      tipo={tipo}
      alCambiar={(tipoNuevo) => {
        EstablecerTipo(tipoNuevo);
        alCambiar(tipoNuevo);
      }}
    />
  );
}

describe('SelectorTipo', () => {
  it('muestra el grupo "Tipo" con "Gasto" e "Ingreso" y, en un gasto, "Gasto" seleccionado (AC-03)', () => {
    render(<SelectorTipo tipo="GASTO" alCambiar={vi.fn()} />);

    const grupo = screen.getByRole('group', { name: 'Tipo' });
    expect(grupo).toBeInTheDocument();
    const opciones = screen.getAllByRole('radio');
    expect(opciones.map((opcion) => opcion.labels[0].textContent)).toEqual(['Gasto', 'Ingreso']);
    expect(screen.getByRole('radio', { name: 'Gasto' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Ingreso' })).not.toBeChecked();
  });

  it('en un ingreso muestra "Ingreso" seleccionado', () => {
    render(<SelectorTipo tipo="INGRESO" alCambiar={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'Ingreso' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Gasto' })).not.toBeChecked();
  });

  it('elegir "Ingreso" llama a alCambiar con "INGRESO"', () => {
    const alCambiar = vi.fn();
    render(<SelectorTipo tipo="GASTO" alCambiar={alCambiar} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Ingreso' }));

    expect(alCambiar).toHaveBeenCalledWith('INGRESO');
  });

  it('con el teclado, las flechas cambian el tipo', async () => {
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    render(<SelectorConEstado tipoInicial="GASTO" alCambiar={alCambiar} />);

    await usuario.tab();
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Gasto' }));
    await usuario.keyboard('{ArrowRight}');

    expect(alCambiar).toHaveBeenLastCalledWith('INGRESO');
    expect(screen.getByRole('radio', { name: 'Ingreso' })).toBeChecked();
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Ingreso' }));
  });

  it('con deshabilitado, las dos opciones quedan deshabilitadas', () => {
    render(<SelectorTipo tipo="GASTO" alCambiar={vi.fn()} deshabilitado />);

    expect(screen.getByRole('radio', { name: 'Gasto' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Ingreso' })).toBeDisabled();
  });
});
