import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ListaMovimientos } from './ListaMovimientos.jsx';

const mensajeSinMovimientos = 'Aquí verá sus movimientos.';

function CrearMovimiento(id, fecha, tipo, monto, nombreCategoria) {
  return {
    id,
    fecha,
    tipo,
    monto,
    nombre_categoria: nombreCategoria,
    creado_en: `${fecha}T12:00:00+00:00`,
  };
}

// Orden en que los entrega bav_movimientos (fecha desc, creado_en desc, id desc).
const movimientosAc36 = [
  CrearMovimiento('m3', '2026-10-01', 'GASTO', '800.00', 'Café'),
  CrearMovimiento('m2', '2026-10-01', 'INGRESO', '50000.00', 'Sueldo'),
  CrearMovimiento('m1', '2026-09-17', 'GASTO', '1500.00', 'Mercado'),
];

function ObtenerTextosFilas() {
  return screen.getAllByRole('listitem').map((fila) => fila.textContent);
}

describe('ListaMovimientos', () => {
  it('sin movimientos muestra "Aquí verá sus movimientos." en lugar de la lista (AC-40)', () => {
    render(<ListaMovimientos movimientos={[]} total={0} />);

    expect(screen.getByText(mensajeSinMovimientos)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('agrupa por fecha: "01/10/2026" con Café y luego Sueldo, después "17/09/2026" con Mercado (AC-36)', () => {
    render(<ListaMovimientos movimientos={movimientosAc36} total={3} />);

    const encabezados = screen.getAllByRole('heading').map((encabezado) => encabezado.textContent);
    expect(encabezados).toEqual(['01/10/2026', '17/09/2026']);

    const [grupoOctubre, grupoSeptiembre] = screen.getAllByRole('list');
    const filasOctubre = within(grupoOctubre).getAllByRole('listitem');
    expect(filasOctubre.map((fila) => fila.textContent)).toEqual([
      'Café-800,00',
      'Sueldo+50.000,00',
    ]);
    expect(within(grupoSeptiembre).getAllByRole('listitem')[0]).toHaveTextContent(
      'Mercado-1.500,00',
    );
    expect(screen.queryByText(mensajeSinMovimientos)).not.toBeInTheDocument();
  });

  it('la fila de un gasto muestra la categoría a la izquierda y el monto a la derecha, sin el tipo (AC-37)', () => {
    const movimientos = [CrearMovimiento('m1', '2026-09-17', 'GASTO', '1500.00', 'Mercado')];
    render(<ListaMovimientos movimientos={movimientos} total={1} />);

    expect(screen.getByRole('heading', { name: '17/09/2026' })).toBeInTheDocument();
    const fila = screen.getByRole('listitem');
    const [categoria, monto] = fila.children;
    expect(categoria).toHaveTextContent('Mercado');
    expect(monto).toHaveTextContent('-1.500,00');
    expect(fila.textContent).toBe('Mercado-1.500,00');
    expect(fila).not.toHaveTextContent(/gasto/i);
  });

  it('muestra "-1.500,00", "+520,50" y "+1.000,00" sin código de moneda (AC-38)', () => {
    const movimientos = [
      CrearMovimiento('m3', '2026-10-01', 'INGRESO', '1000.00', 'Sueldo'),
      CrearMovimiento('m2', '2026-10-01', 'INGRESO', '520.5', 'Sueldo'),
      CrearMovimiento('m1', '2026-10-01', 'GASTO', '1500.00', 'Mercado'),
    ];
    render(<ListaMovimientos movimientos={movimientos} total={3} />);

    expect(ObtenerTextosFilas()).toEqual(['Sueldo+1.000,00', 'Sueldo+520,50', 'Mercado-1.500,00']);
    expect(screen.queryByText(/USD/)).not.toBeInTheDocument();
  });

  it('el monto del gasto tiene monto-gasto y el del ingreso monto-ingreso (AC-39)', () => {
    const movimientos = [
      CrearMovimiento('m2', '2026-10-01', 'INGRESO', '1000.00', 'Sueldo'),
      CrearMovimiento('m1', '2026-10-01', 'GASTO', '1500.00', 'Mercado'),
    ];
    render(<ListaMovimientos movimientos={movimientos} total={2} />);

    expect(screen.getByText('-1.500,00')).toHaveClass('monto-gasto');
    expect(screen.getByText('-1.500,00')).not.toHaveClass('monto-ingreso');
    expect(screen.getByText('+1.000,00')).toHaveClass('monto-ingreso');
    expect(screen.getByText('+1.000,00')).not.toHaveClass('monto-gasto');
  });

  it('una página que empieza a mitad de un grupo lo encabeza con su fecha (AC-63, FR-47)', () => {
    const movimientosPagina2 = ['m55', 'm54', 'm53', 'm52', 'm51'].map((id) =>
      CrearMovimiento(id, '2026-10-01', 'GASTO', '10.00', 'Café'),
    );
    render(<ListaMovimientos movimientos={movimientosPagina2} total={55} />);

    const encabezados = screen.getAllByRole('heading');
    expect(encabezados).toHaveLength(1);
    expect(encabezados[0]).toHaveTextContent('01/10/2026');
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });
});
