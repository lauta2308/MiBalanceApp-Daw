import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

// Cada fila es un botón (con la categoría y el monto) dentro de su <li>.
function ObtenerFilas(contenedor = screen) {
  return contenedor.getAllByRole('button', { expanded: false });
}

function ObtenerTextosFilas() {
  return ObtenerFilas().map((fila) => fila.textContent);
}

function ObtenerFila(nombreCategoria) {
  return ObtenerFilas().find((fila) => fila.textContent.startsWith(nombreCategoria));
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
    const filasOctubre = ObtenerFilas(within(grupoOctubre));
    expect(filasOctubre.map((fila) => fila.textContent)).toEqual([
      'Café-800,00',
      'Sueldo+50.000,00',
    ]);
    expect(ObtenerFilas(within(grupoSeptiembre))[0]).toHaveTextContent(
      'Mercado-1.500,00',
    );
    expect(screen.queryByText(mensajeSinMovimientos)).not.toBeInTheDocument();
  });

  it('la fila de un gasto muestra la categoría a la izquierda y el monto a la derecha, sin el tipo (AC-37)', () => {
    const movimientos = [CrearMovimiento('m1', '2026-09-17', 'GASTO', '1500.00', 'Mercado')];
    render(<ListaMovimientos movimientos={movimientos} total={1} />);

    expect(screen.getByRole('heading', { name: '17/09/2026' })).toBeInTheDocument();
    const [fila] = ObtenerFilas();
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
    expect(ObtenerFilas()).toHaveLength(5);
  });

  describe('menú de la fila', () => {
    it('cada fila es un botón dentro de su <li>, con aria-haspopup="menu", aria-expanded y el id del movimiento', () => {
      render(<ListaMovimientos movimientos={movimientosAc36} total={3} alEditar={vi.fn()} />);

      const filas = ObtenerFilas();
      expect(filas).toHaveLength(3);
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
      filas.forEach((fila, indice) => {
        expect(fila.tagName).toBe('BUTTON');
        expect(fila).toHaveAttribute('type', 'button');
        expect(fila.closest('li')).toHaveClass('fila-movimiento');
        expect(fila).toHaveAttribute('aria-haspopup', 'menu');
        expect(fila).toHaveAttribute('aria-expanded', 'false');
        expect(fila).toHaveAttribute('data-id-movimiento', movimientosAc36[indice].id);
      });
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('presionar la fila con un clic abre un menú con "Editar" y "Eliminar" debajo de la fila y le pasa el foco a "Editar" (AC-01)', async () => {
      const usuario = userEvent.setup();
      render(<ListaMovimientos movimientos={movimientosAc36} total={3} alEditar={vi.fn()} />);

      const fila = ObtenerFila('Sueldo');
      await usuario.click(fila);

      const menu = screen.getByRole('menu');
      expect(within(menu).getAllByRole('menuitem').map((opcion) => opcion.textContent)).toEqual([
        'Editar',
        'Eliminar',
      ]);
      expect(fila).toHaveAttribute('aria-expanded', 'true');
      expect(fila.closest('li')).toContainElement(menu);
      expect(fila.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'Editar' }));
    });

    it('el menú se nombra con el texto de su fila (aria-labelledby) y la fila lo controla mientras está abierto (patrón APG de botón de menú)', () => {
      render(<ListaMovimientos movimientos={movimientosAc36} total={3} alEditar={vi.fn()} />);
      const fila = ObtenerFila('Sueldo');
      expect(fila).toHaveAttribute('id');
      expect(fila).not.toHaveAttribute('aria-controls');

      fireEvent.click(fila);

      const menu = screen.getByRole('menu', { name: 'Sueldo+50.000,00' });
      expect(menu).toHaveAttribute('aria-labelledby', fila.id);
      expect(menu).toHaveAttribute('id');
      expect(fila).toHaveAttribute('aria-controls', menu.id);
    });

    it('presionar la fila con un toque (evento de puntero) abre el menú con "Editar" (AC-01)', async () => {
      const usuario = userEvent.setup();
      render(<ListaMovimientos movimientos={movimientosAc36} total={3} alEditar={vi.fn()} />);

      await usuario.pointer({ keys: '[TouchA]', target: ObtenerFila('Café') });

      expect(screen.getByRole('menuitem', { name: 'Editar' })).toBeInTheDocument();
    });

    it('presionar la fila con Enter abre el menú con "Editar" (AC-01)', async () => {
      const usuario = userEvent.setup();
      render(<ListaMovimientos movimientos={movimientosAc36} total={3} alEditar={vi.fn()} />);

      await usuario.tab();
      expect(document.activeElement).toBe(ObtenerFila('Café'));
      await usuario.keyboard('{Enter}');

      expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Editar' }));
    });

    it('la flecha hacia abajo sobre la fila también abre el menú', () => {
      render(<ListaMovimientos movimientos={movimientosAc36} total={3} alEditar={vi.fn()} />);

      const fila = ObtenerFila('Café');
      fila.focus();
      fireEvent.keyDown(fila, { key: 'ArrowDown' });

      expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Editar' }));
    });

    it('Escape cierra el menú y el foco vuelve a la fila', async () => {
      const usuario = userEvent.setup();
      render(<ListaMovimientos movimientos={movimientosAc36} total={3} alEditar={vi.fn()} />);
      const fila = ObtenerFila('Mercado');
      await usuario.click(fila);

      await usuario.keyboard('{Escape}');

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(fila).toHaveAttribute('aria-expanded', 'false');
      expect(document.activeElement).toBe(fila);
    });

    it('presionar de nuevo la misma fila cierra su menú', async () => {
      const usuario = userEvent.setup();
      render(<ListaMovimientos movimientos={movimientosAc36} total={3} alEditar={vi.fn()} />);
      const fila = ObtenerFila('Mercado');
      await usuario.click(fila);

      await usuario.click(fila);

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('abrir el menú de otra fila cierra el anterior: nunca hay más de un menú abierto', async () => {
      const usuario = userEvent.setup();
      render(<ListaMovimientos movimientos={movimientosAc36} total={3} alEditar={vi.fn()} />);
      const filaCafe = ObtenerFila('Café');
      const filaMercado = ObtenerFila('Mercado');
      await usuario.click(filaCafe);

      await usuario.click(filaMercado);

      expect(screen.getAllByRole('menu')).toHaveLength(1);
      expect(filaCafe).toHaveAttribute('aria-expanded', 'false');
      expect(filaMercado).toHaveAttribute('aria-expanded', 'true');
      expect(filaMercado.closest('li')).toContainElement(screen.getByRole('menu'));
    });

    it('elegir "Editar" llama a alEditar con el id del movimiento de la fila y cierra el menú', async () => {
      const usuario = userEvent.setup();
      const alEditar = vi.fn();
      render(<ListaMovimientos movimientos={movimientosAc36} total={3} alEditar={alEditar} />);
      await usuario.click(ObtenerFila('Sueldo'));

      await usuario.click(screen.getByRole('menuitem', { name: 'Editar' }));

      expect(alEditar).toHaveBeenCalledTimes(1);
      expect(alEditar).toHaveBeenCalledWith('m2');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('elegir "Eliminar" llama a alEliminar con el id del movimiento y el botón de su fila, y cierra el menú', async () => {
      const usuario = userEvent.setup();
      const alEditar = vi.fn();
      const alEliminar = vi.fn();
      render(
        <ListaMovimientos
          movimientos={movimientosAc36}
          total={3}
          alEditar={alEditar}
          alEliminar={alEliminar}
        />,
      );
      const fila = ObtenerFila('Sueldo');
      await usuario.click(fila);

      await usuario.click(screen.getByRole('menuitem', { name: 'Eliminar' }));

      expect(alEliminar).toHaveBeenCalledTimes(1);
      expect(alEliminar).toHaveBeenCalledWith('m2', fila);
      expect(alEditar).not.toHaveBeenCalled();
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(fila).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
