import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';

// Cliente de Supabase simulado: cada consulta registra lo que se le pidió
// (tabla, select, order, range) y responde con lo que indique la prueba.
const simulacion = vi.hoisted(() => ({
  consultas: [],
  responderCuenta: null,
  responderMovimientos: null,
}));

vi.mock('../servicios/clienteSupabase.js', () => {
  function CrearConsulta(tabla) {
    const registro = { tabla, select: null, order: [], range: null };
    simulacion.consultas.push(registro);
    const consulta = {
      select(...argumentos) {
        registro.select = argumentos;
        return consulta;
      },
      order(...argumentos) {
        registro.order.push(argumentos);
        return consulta;
      },
      range(desde, hasta) {
        registro.range = [desde, hasta];
        return consulta;
      },
      then(alResolver, alRechazar) {
        const responder =
          tabla === 'bav_cuenta' ? simulacion.responderCuenta : simulacion.responderMovimientos;
        return Promise.resolve()
          .then(() => responder(registro))
          .then(alResolver, alRechazar);
      },
    };
    return consulta;
  }
  return { clienteSupabase: { from: (tabla) => CrearConsulta(tabla) } };
});

import { ProveedorMensajes } from '../mensajes/ProveedorMensajes.jsx';
import { SeccionCuenta } from './SeccionCuenta.jsx';

const mensajeErrorCarga = 'No se pudieron cargar sus movimientos. Vuelva a intentarlo.';
const mensajeSinMovimientos = 'Aquí verá sus movimientos.';
const errorSupabase = { message: 'relation "bav_cuenta" does not exist', code: '42P01' };

function CrearCuenta(saldo) {
  return { id: 'cuenta-a', nombre: 'Mi Cuenta', moneda: 'USD', saldo };
}

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

// N movimientos ya ordenados como los entrega la vista: "Categoría 001" es el
// más reciente. Por defecto todos son del 2026-10-02.
function CrearMovimientos(cantidad, ObtenerFecha = () => '2026-10-02') {
  return Array.from({ length: cantidad }, (_, indice) => {
    const posicion = String(indice + 1).padStart(3, '0');
    return CrearMovimiento(`mov-${posicion}`, ObtenerFecha(indice + 1), 'GASTO', '10.00', `Categoría ${posicion}`);
  });
}

function ConfigurarServidor({ cuenta = CrearCuenta('0.00'), movimientos = [] } = {}) {
  simulacion.responderCuenta = () => ({ data: cuenta ? [cuenta] : [], error: null });
  simulacion.responderMovimientos = (registro) => {
    const [desde, hasta] = registro.range ?? [0, movimientos.length - 1];
    return { data: movimientos.slice(desde, hasta + 1), error: null, count: movimientos.length };
  };
}

function RenderizarSeccion() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <ProveedorMensajes>
        <Routes>
          <Route path="/" element={<SeccionCuenta />} />
          <Route path="/gasto/nuevo" element={<h1>Pantalla Añadir Gasto</h1>} />
          <Route path="/ingreso/nuevo" element={<h1>Pantalla Añadir Ingreso</h1>} />
        </Routes>
      </ProveedorMensajes>
    </MemoryRouter>,
  );
}

// Muestra el estado de la navegación actual, para comprobar que Cuenta lo limpia.
function EstadoNavegacion() {
  const ubicacion = useLocation();
  return <output aria-label="Estado de la navegación">{JSON.stringify(ubicacion.state)}</output>;
}

// Pantalla de formulario simulada con un botón que vuelve con "atrás" del historial.
function PantallaConAtras({ titulo }) {
  const navegar = useNavigate();
  return (
    <>
      <h1>{titulo}</h1>
      <button type="button" onClick={() => navegar(-1)}>
        Atrás del Historial
      </button>
    </>
  );
}

// Cuenta montada como si se volviera de un formulario: la entrada "/" trae
// { tipoFormulario } en el estado de la navegación.
function RenderizarSeccionDesdeFormulario(tipoFormulario) {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/', state: { pagina: 1, tipoFormulario } }]}>
      <ProveedorMensajes>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <SeccionCuenta />
                <EstadoNavegacion />
              </>
            }
          />
          <Route path="/gasto/nuevo" element={<PantallaConAtras titulo="Pantalla Añadir Gasto" />} />
          <Route path="/ingreso/nuevo" element={<PantallaConAtras titulo="Pantalla Añadir Ingreso" />} />
        </Routes>
      </ProveedorMensajes>
    </MemoryRouter>,
  );
}

function ConsultasDeMovimientos() {
  return simulacion.consultas.filter((consulta) => consulta.tabla === 'bav_movimientos');
}

function ObtenerSaldo() {
  return screen.getByText(/^USD /);
}

describe('SeccionCuenta', () => {
  beforeEach(() => {
    simulacion.consultas.length = 0;
    ConfigurarServidor();
  });

  it('con "Mi Cuenta"/USD/"0.00" y sin movimientos muestra "Mi Cuenta (USD)", "USD 0,00" y "Aquí verá sus movimientos." (AC-05, AC-40)', async () => {
    RenderizarSeccion();

    expect(await screen.findByRole('heading', { name: 'Mi Cuenta (USD)' })).toBeInTheDocument();
    expect(screen.getByText('USD 0,00')).toBeInTheDocument();
    expect(screen.getByText(mensajeSinMovimientos)).toBeInTheDocument();
  });

  it('con saldo "10000.00" muestra "USD 10.000,00" (AC-10)', async () => {
    ConfigurarServidor({ cuenta: CrearCuenta('10000.00') });
    RenderizarSeccion();

    expect(await screen.findByText('USD 10.000,00')).toBeInTheDocument();
  });

  it.each([
    ['8500.00', 'USD 8.500,00', 'saldo-positivo'],
    ['-1000.00', 'USD -1.000,00', 'saldo-negativo'],
    ['0.00', 'USD 0,00', 'saldo-cero'],
  ])('con saldo "%s" muestra "%s" con la clase %s (AC-11)', async (saldo, textoSaldo, clase) => {
    ConfigurarServidor({ cuenta: CrearCuenta(saldo) });
    RenderizarSeccion();

    const elementoSaldo = await screen.findByText(textoSaldo);
    expect(elementoSaldo).toHaveClass(clase);
    for (const otraClase of ['saldo-positivo', 'saldo-negativo', 'saldo-cero']) {
      if (otraClase !== clase) {
        expect(elementoSaldo).not.toHaveClass(otraClase);
      }
    }
  });

  it('con los tres movimientos de AC-36 muestra "01/10/2026" (Café, Sueldo) y después "17/09/2026" (Mercado) (AC-36)', async () => {
    ConfigurarServidor({
      cuenta: CrearCuenta('47700.00'),
      movimientos: [
        CrearMovimiento('m3', '2026-10-01', 'GASTO', '800.00', 'Café'),
        CrearMovimiento('m2', '2026-10-01', 'INGRESO', '50000.00', 'Sueldo'),
        CrearMovimiento('m1', '2026-09-17', 'GASTO', '1500.00', 'Mercado'),
      ],
    });
    RenderizarSeccion();

    await screen.findByRole('heading', { name: '01/10/2026' });
    const encabezadosFecha = screen
      .getAllByRole('heading', { level: 2 })
      .map((encabezado) => encabezado.textContent);
    expect(encabezadosFecha).toEqual(['01/10/2026', '17/09/2026']);
    expect(screen.getAllByRole('listitem').map((fila) => fila.textContent)).toEqual([
      'Café-800,00',
      'Sueldo+50.000,00',
      'Mercado-1.500,00',
    ]);
  });

  it('la fila de un gasto de "1500.00" en Mercado del 2026-09-17 va bajo "17/09/2026", sin el tipo (AC-37)', async () => {
    ConfigurarServidor({
      cuenta: CrearCuenta('8500.00'),
      movimientos: [CrearMovimiento('m1', '2026-09-17', 'GASTO', '1500.00', 'Mercado')],
    });
    RenderizarSeccion();

    expect(await screen.findByRole('heading', { name: '17/09/2026' })).toBeInTheDocument();
    const fila = screen.getByRole('listitem');
    expect(fila.children[0]).toHaveTextContent('Mercado');
    expect(fila.children[1]).toHaveTextContent('-1.500,00');
    expect(fila).not.toHaveTextContent(/gasto/i);
  });

  it('muestra "-1.500,00", "+520,50" y "+1.000,00" sin código de moneda, con sus colores (AC-38, AC-39)', async () => {
    ConfigurarServidor({
      cuenta: CrearCuenta('20.50'),
      movimientos: [
        CrearMovimiento('m3', '2026-10-01', 'INGRESO', '1000.00', 'Sueldo'),
        CrearMovimiento('m2', '2026-10-01', 'INGRESO', '520.50', 'Sueldo'),
        CrearMovimiento('m1', '2026-10-01', 'GASTO', '1500.00', 'Mercado'),
      ],
    });
    RenderizarSeccion();

    expect(await screen.findByText('-1.500,00')).toHaveClass('monto-gasto');
    expect(screen.getByText('+520,50')).toHaveClass('monto-ingreso');
    expect(screen.getByText('+1.000,00')).toHaveClass('monto-ingreso');
    expect(within(screen.getByRole('list')).queryByText(/USD/)).not.toBeInTheDocument();
  });

  it('con total 120 en la página 1 muestra 50 filas, "Página 1 de 3" y "Anterior" deshabilitado (AC-41)', async () => {
    ConfigurarServidor({ movimientos: CrearMovimientos(120) });
    RenderizarSeccion();

    expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(50);
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Categoría 001');
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
    expect(ConsultasDeMovimientos().map((consulta) => consulta.range)).toEqual([[0, 49]]);
  });

  it('con total 120, dos "Siguiente" piden las páginas 2 y 3 y la última tiene 20 filas y "Siguiente" deshabilitado (AC-42)', async () => {
    const usuario = userEvent.setup();
    ConfigurarServidor({ movimientos: CrearMovimientos(120) });
    RenderizarSeccion();
    await screen.findByText('Página 1 de 3');

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument();
    const filasPagina2 = screen.getAllByRole('listitem');
    expect(filasPagina2).toHaveLength(50);
    expect(filasPagina2[0]).toHaveTextContent('Categoría 051');
    expect(filasPagina2[49]).toHaveTextContent('Categoría 100');

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText('Página 3 de 3')).toBeInTheDocument();
    const filasPagina3 = screen.getAllByRole('listitem');
    expect(filasPagina3).toHaveLength(20);
    expect(filasPagina3[0]).toHaveTextContent('Categoría 101');
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled();

    expect(ConsultasDeMovimientos().map((consulta) => consulta.range)).toEqual([
      [0, 49],
      [50, 99],
      [100, 149],
    ]);
  });

  it('"Anterior" en la página 2 vuelve a la página 1 (FR-40)', async () => {
    const usuario = userEvent.setup();
    ConfigurarServidor({ movimientos: CrearMovimientos(120) });
    RenderizarSeccion();
    await screen.findByText('Página 1 de 3');

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('Página 2 de 3');
    await usuario.click(screen.getByRole('button', { name: 'Anterior' }));

    expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Categoría 001');
  });

  it('mientras carga la página siguiente, "Siguiente" conserva el foco y un segundo clic no pide otra página (NFR-07)', async () => {
    const usuario = userEvent.setup();
    const movimientos = CrearMovimientos(120);
    ConfigurarServidor({ movimientos });
    const responderInmediato = simulacion.responderMovimientos;
    let liberarPagina2;
    simulacion.responderMovimientos = (registro) => {
      if (registro.range?.[0] === 50) {
        return new Promise((resolver) => {
          liberarPagina2 = () => resolver(responderInmediato(registro));
        });
      }
      return responderInmediato(registro);
    };
    RenderizarSeccion();
    await screen.findByText('Página 1 de 3');

    const botonSiguiente = screen.getByRole('button', { name: 'Siguiente' });
    await usuario.click(botonSiguiente);
    await vi.waitFor(() => expect(liberarPagina2).toBeTypeOf('function'));

    expect(botonSiguiente).toHaveAttribute('aria-disabled', 'true');
    expect(botonSiguiente).not.toHaveAttribute('disabled');
    expect(document.activeElement).toBe(botonSiguiente);

    await usuario.click(botonSiguiente);
    expect(ConsultasDeMovimientos().map((consulta) => consulta.range)).toEqual([
      [0, 49],
      [50, 99],
    ]);

    liberarPagina2();
    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Siguiente' }));
    expect(ConsultasDeMovimientos()).toHaveLength(2);
  });

  it('con "Siguiente" hasta la última página el foco pasa a "Anterior", y con "Anterior" hasta la primera vuelve a "Siguiente" (NFR-07)', async () => {
    ConfigurarServidor({ movimientos: CrearMovimientos(120) });
    RenderizarSeccion();
    await screen.findByText('Página 1 de 3');

    async function Presionar(nombre, textoEsperado) {
      const boton = screen.getByRole('button', { name: nombre });
      boton.focus();
      fireEvent.click(boton);
      await screen.findByText(textoEsperado);
    }

    await Presionar('Siguiente', 'Página 2 de 3');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Siguiente' }));
    await Presionar('Siguiente', 'Página 3 de 3');
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Anterior' }));

    await Presionar('Anterior', 'Página 2 de 3');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Anterior' }));
    await Presionar('Anterior', 'Página 1 de 3');
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Siguiente' }));
  });

  it('con total 30 muestra las 30 filas sin "Anterior", "Siguiente" ni el indicador (AC-43)', async () => {
    ConfigurarServidor({ movimientos: CrearMovimientos(30) });
    RenderizarSeccion();

    await screen.findByText('Categoría 001');
    expect(screen.getAllByRole('listitem')).toHaveLength(30);
    expect(screen.queryByRole('button', { name: 'Anterior' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Página \d+ de \d+/)).not.toBeInTheDocument();
  });

  it('con total 50 no muestra la paginación (AC-64)', async () => {
    ConfigurarServidor({ movimientos: CrearMovimientos(50) });
    RenderizarSeccion();

    await screen.findByText('Categoría 050');
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Página \d+ de \d+/)).not.toBeInTheDocument();
  });

  it('con total 51 muestra "Página 1 de 2" y "Siguiente" habilitado (AC-64)', async () => {
    ConfigurarServidor({ movimientos: CrearMovimientos(51) });
    RenderizarSeccion();

    expect(await screen.findByText('Página 1 de 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
  });

  it('la página 2 del ejemplo de AC-63 empieza con el encabezado "01/10/2026" (AC-63, FR-47)', async () => {
    const usuario = userEvent.setup();
    // 55 movimientos: los lugares 48 a 55 son del 01/10/2026; los anteriores, del 02/10/2026.
    ConfigurarServidor({
      movimientos: CrearMovimientos(55, (posicion) => (posicion >= 48 ? '2026-10-01' : '2026-10-02')),
    });
    RenderizarSeccion();
    await screen.findByText('Página 1 de 2');

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByText('Página 2 de 2');

    const encabezadosFecha = screen.getAllByRole('heading', { level: 2 });
    expect(encabezadosFecha).toHaveLength(1);
    expect(encabezadosFecha[0]).toHaveTextContent('01/10/2026');
    const filas = screen.getAllByRole('listitem');
    expect(filas.map((fila) => fila.children[0].textContent)).toEqual([
      'Categoría 051',
      'Categoría 052',
      'Categoría 053',
      'Categoría 054',
      'Categoría 055',
    ]);
  });

  it('muestra "Añadir Gasto" y "Añadir Ingreso", que abren sus formularios, y no muestra la flecha para volver atrás (FR-32)', async () => {
    const usuario = userEvent.setup();
    RenderizarSeccion();
    await screen.findByRole('heading', { name: 'Mi Cuenta (USD)' });

    expect(screen.queryByRole('button', { name: 'Volver atrás' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Volver atrás')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Añadir Ingreso' })).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Añadir Gasto' }));
    expect(await screen.findByRole('heading', { name: 'Pantalla Añadir Gasto' })).toBeInTheDocument();
  });

  it('al montarse por primera vez (sin venir de un formulario) no fuerza el foco en ningún botón (NFR-07)', async () => {
    RenderizarSeccion();
    await screen.findByRole('heading', { name: 'Mi Cuenta (USD)' });

    expect(document.activeElement).toBe(document.body);
  });

  it.each([
    ['GASTO', 'Añadir Gasto'],
    ['INGRESO', 'Añadir Ingreso'],
  ])('al volver de un formulario %s enfoca "%s" y limpia tipoFormulario del estado de la navegación, para que una recarga no vuelva a forzar el foco (NFR-07)', async (tipoFormulario, nombreBoton) => {
    RenderizarSeccionDesdeFormulario(tipoFormulario);
    await screen.findByRole('heading', { name: 'Mi Cuenta (USD)' });

    expect(document.activeElement).toBe(screen.getByRole('button', { name: nombreBoton }));
    await vi.waitFor(() =>
      expect(screen.getByLabelText('Estado de la navegación').textContent).not.toMatch(/tipoFormulario/),
    );
  });

  it('al volver a Cuenta con "atrás" del historial a la entrada que trajo tipoFormulario, no fuerza el foco (NFR-07)', async () => {
    RenderizarSeccionDesdeFormulario('GASTO');
    await screen.findByRole('heading', { name: 'Mi Cuenta (USD)' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Añadir Gasto' }));

    fireEvent.click(screen.getByRole('button', { name: 'Añadir Ingreso' }));
    await screen.findByRole('heading', { name: 'Pantalla Añadir Ingreso' });
    document.activeElement.blur();
    fireEvent.click(screen.getByRole('button', { name: 'Atrás del Historial' }));

    await screen.findByRole('heading', { name: 'Mi Cuenta (USD)' });
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Añadir Gasto' }));
    expect(document.activeElement).toBe(document.body);
  });

  it('"Añadir Ingreso" abre el formulario de ingreso', async () => {
    const usuario = userEvent.setup();
    RenderizarSeccion();
    await screen.findByRole('heading', { name: 'Mi Cuenta (USD)' });

    await usuario.click(screen.getByRole('button', { name: 'Añadir Ingreso' }));
    expect(await screen.findByRole('heading', { name: 'Pantalla Añadir Ingreso' })).toBeInTheDocument();
  });

  it('(error E5-1) con la carga fallida muestra el error de carga sin detalles técnicos y "Aceptar" reintenta y muestra saldo y lista (AC-48)', async () => {
    const usuario = userEvent.setup();
    simulacion.responderCuenta = () => ({ data: null, error: errorSupabase });
    simulacion.responderMovimientos = () => ({ data: null, error: errorSupabase, count: null });
    RenderizarSeccion();

    const dialogo = await screen.findByRole('alertdialog');
    expect(dialogo).toHaveTextContent(mensajeErrorCarga);
    expect(screen.queryByText(/42P01|does not exist/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^USD /)).not.toBeInTheDocument();

    ConfigurarServidor({
      cuenta: CrearCuenta('8500.00'),
      movimientos: [CrearMovimiento('m1', '2026-09-17', 'GASTO', '1500.00', 'Mercado')],
    });
    await usuario.click(screen.getByRole('button', { name: 'Aceptar' }));

    expect(await screen.findByText('USD 8.500,00')).toBeInTheDocument();
    expect(screen.getByText('-1.500,00')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('(error E5-1) si solo falla la lista también muestra el error de carga, y "Aceptar" reintenta ambas cargas (AC-48)', async () => {
    const usuario = userEvent.setup();
    simulacion.responderMovimientos = () => {
      throw new Error('Failed to fetch');
    };
    RenderizarSeccion();

    expect(await screen.findByRole('alertdialog')).toHaveTextContent(mensajeErrorCarga);
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
    const consultasAntes = simulacion.consultas.length;

    ConfigurarServidor({ cuenta: CrearCuenta('10000.00') });
    await usuario.click(screen.getByRole('button', { name: 'Aceptar' }));

    expect(await screen.findByText('USD 10.000,00')).toBeInTheDocument();
    expect(screen.getByText(mensajeSinMovimientos)).toBeInTheDocument();
    const tablasReintento = simulacion.consultas.slice(consultasAntes).map((consulta) => consulta.tabla);
    expect(tablasReintento).toEqual(expect.arrayContaining(['bav_cuenta', 'bav_movimientos']));
  });

  it('(error E5-2) sin cuenta (bav_cuenta con 0 filas) muestra el mismo mensaje de carga', async () => {
    ConfigurarServidor({ cuenta: null });
    RenderizarSeccion();

    expect(await screen.findByRole('alertdialog')).toHaveTextContent(mensajeErrorCarga);
    expect(screen.queryByText(/^USD /)).not.toBeInTheDocument();
  });

  it('nunca pide más de 50 filas al servidor', async () => {
    ConfigurarServidor({ movimientos: CrearMovimientos(120) });
    RenderizarSeccion();
    await screen.findByText('Página 1 de 3');

    for (const consulta of ConsultasDeMovimientos()) {
      expect(consulta.range).not.toBeNull();
      expect(consulta.range[1] - consulta.range[0] + 1).toBe(50);
    }
    expect(ObtenerSaldo()).toHaveTextContent('USD 0,00');
  });
});
