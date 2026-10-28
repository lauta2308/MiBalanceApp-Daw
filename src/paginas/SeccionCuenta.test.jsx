import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useParams } from 'react-router';

// Cliente de Supabase simulado: cada consulta registra lo que se le pidió
// (tabla, select, order, range) y responde con lo que indique la prueba. Cada
// llamada RPC se registra (nombre y parámetros) y responde con responderRpc.
const simulacion = vi.hoisted(() => ({
  consultas: [],
  llamadasRpc: [],
  responderCuenta: null,
  responderMovimientos: null,
  responderRpc: null,
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
  function LlamarRpc(nombre, parametros) {
    simulacion.llamadasRpc.push({ nombre, parametros });
    return Promise.resolve().then(() => simulacion.responderRpc(nombre, parametros));
  }
  return { clienteSupabase: { from: (tabla) => CrearConsulta(tabla), rpc: LlamarRpc } };
});

import { FlechaVolver } from '../componentes/FlechaVolver.jsx';
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

// El servidor simulado guarda su propia copia de la cuenta y los movimientos:
// basp_eliminar_movimiento borra el movimiento y le quita su efecto al saldo,
// como la función de la base (los montos de las pruebas son exactos en centavos).
function ConfigurarServidor({ cuenta = CrearCuenta('0.00'), movimientos = [] } = {}) {
  const servidor = { cuenta: cuenta && { ...cuenta }, movimientos: [...movimientos] };
  simulacion.responderCuenta = () => ({ data: servidor.cuenta ? [servidor.cuenta] : [], error: null });
  simulacion.responderMovimientos = (registro) => {
    const [desde, hasta] = registro.range ?? [0, servidor.movimientos.length - 1];
    return {
      data: servidor.movimientos.slice(desde, hasta + 1),
      error: null,
      count: servidor.movimientos.length,
    };
  };
  simulacion.responderRpc = (nombre, { p_id_movimiento: idMovimiento }) => {
    const movimiento = servidor.movimientos.find((candidato) => candidato.id === idMovimiento);
    if (nombre !== 'basp_eliminar_movimiento' || !movimiento) {
      return { data: null, error: { message: 'movimiento inexistente', code: 'BA404' } };
    }
    servidor.movimientos = servidor.movimientos.filter((candidato) => candidato !== movimiento);
    const efectoCentavos = Math.round(Number(movimiento.monto) * 100) * (movimiento.tipo === 'INGRESO' ? 1 : -1);
    const saldoCentavos = Math.round(Number(servidor.cuenta.saldo) * 100) - efectoCentavos;
    servidor.cuenta = { ...servidor.cuenta, saldo: (saldoCentavos / 100).toFixed(2) };
    return { data: idMovimiento, error: null };
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
          <Route path="/movimientos/:idMovimiento/editar" element={<PantallaEditar />} />
        </Routes>
      </ProveedorMensajes>
    </MemoryRouter>,
  );
}

// Cuenta montada sobre una entrada anterior del historial ("/anterior"), con
// un botón "Atrás" del arnés fuera de la sección y del modal, como el Atrás del
// navegador: sale de Cuenta aunque la confirmación esté abierta.
function BotonAtrasNavegador() {
  const navegar = useNavigate();
  return (
    <button type="button" onClick={() => navegar(-1)}>
      Atrás del Navegador
    </button>
  );
}

function RenderizarSeccionConHistorial() {
  render(
    <MemoryRouter initialEntries={['/anterior', '/']} initialIndex={1}>
      <ProveedorMensajes>
        <Routes>
          <Route path="/" element={<SeccionCuenta />} />
          <Route path="/anterior" element={<h1>Pantalla Anterior</h1>} />
        </Routes>
      </ProveedorMensajes>
      <BotonAtrasNavegador />
    </MemoryRouter>,
  );
}

// "Añadir Gasto" simulada: como en FormularioMovimiento, su primer control es
// la flecha para volver atrás (FlechaVolver, primer hijo del encabezado).
function PantallaAnadirGasto() {
  const navegar = useNavigate();
  return (
    <section className="formulario-movimiento">
      <header className="encabezado-formulario">
        <FlechaVolver alVolver={() => navegar('/')} />
        <h1 className="titulo-formulario">Añadir Gasto</h1>
      </header>
      <button type="button">Guardar</button>
    </section>
  );
}

// Cuenta con "Añadir Gasto" como entrada anterior del historial, dentro de un
// <main> como en App; el Atrás del navegador queda fuera de la página.
function RenderizarSeccionDesdeAnadirGasto() {
  render(
    <MemoryRouter initialEntries={['/gasto/nuevo', '/']} initialIndex={1}>
      <main>
        <ProveedorMensajes>
          <Routes>
            <Route path="/" element={<SeccionCuenta />} />
            <Route path="/gasto/nuevo" element={<PantallaAnadirGasto />} />
          </Routes>
        </ProveedorMensajes>
      </main>
      <BotonAtrasNavegador />
    </MemoryRouter>,
  );
}

// Muestra el estado de la navegación actual, para comprobar que Cuenta lo limpia.
function EstadoNavegacion() {
  const ubicacion = useLocation();
  return <output aria-label="Estado de la navegación">{JSON.stringify(ubicacion.state)}</output>;
}

// Pantalla de edición simulada: muestra el id del movimiento que llegó en la ruta.
function PantallaEditar() {
  const { idMovimiento } = useParams();
  return <h1>{`Pantalla Editar ${idMovimiento}`}</h1>;
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
// { tipoFormulario } (alta) o el estado que se indique (edición) en el estado
// de la navegación.
function RenderizarSeccionDesdeFormulario(tipoFormulario, estado = { pagina: 1, tipoFormulario }) {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/', state: estado }]}>
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
          <Route path="/movimientos/:idMovimiento/editar" element={<PantallaConAtras titulo="Pantalla Editar" />} />
        </Routes>
      </ProveedorMensajes>
    </MemoryRouter>,
  );
}

function ConsultasDeMovimientos() {
  return simulacion.consultas.filter((consulta) => consulta.tabla === 'bav_movimientos');
}

// Cada fila de la lista es un botón dentro de su <li>.
function ObtenerFilas() {
  return screen.getAllByRole('listitem').map((elemento) => within(elemento).getByRole('button'));
}

function ObtenerFila(idMovimiento) {
  return ObtenerFilas().find((fila) => fila.dataset.idMovimiento === idMovimiento);
}

function ObtenerSaldo() {
  return screen.getByText(/^USD /);
}

describe('SeccionCuenta', () => {
  beforeEach(() => {
    simulacion.consultas.length = 0;
    simulacion.llamadasRpc.length = 0;
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
    expect(ObtenerFilas().map((fila) => fila.textContent)).toEqual([
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
    const [fila] = ObtenerFilas();
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
    expect(ObtenerFilas()).toHaveLength(50);
    expect(ObtenerFilas()[0]).toHaveTextContent('Categoría 001');
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
    const filasPagina2 = ObtenerFilas();
    expect(filasPagina2).toHaveLength(50);
    expect(filasPagina2[0]).toHaveTextContent('Categoría 051');
    expect(filasPagina2[49]).toHaveTextContent('Categoría 100');

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText('Página 3 de 3')).toBeInTheDocument();
    const filasPagina3 = ObtenerFilas();
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
    expect(ObtenerFilas()[0]).toHaveTextContent('Categoría 001');
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
    expect(ObtenerFilas()).toHaveLength(30);
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
    const filas = ObtenerFilas();
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

  describe('edición desde el menú de la fila', () => {
    const movimientosEdicion = [
      CrearMovimiento('m3', '2026-10-01', 'GASTO', '800.00', 'Café'),
      CrearMovimiento('m2', '2026-10-01', 'INGRESO', '50000.00', 'Sueldo'),
      CrearMovimiento('m1', '2026-09-17', 'GASTO', '1500.00', 'Mercado'),
    ];

    it('"Editar" en el menú de una fila abre la edición de ese movimiento (FR-01)', async () => {
      ConfigurarServidor({ movimientos: movimientosEdicion });
      RenderizarSeccion();
      await screen.findByText('Sueldo');

      fireEvent.click(ObtenerFila('m2'));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Editar' }));

      expect(await screen.findByRole('heading', { name: 'Pantalla Editar m2' })).toBeInTheDocument();
    });

    it('al volver de editar, con el movimiento en la página 1, enfoca su fila y limpia idMovimientoEditado del estado (D5)', async () => {
      ConfigurarServidor({ movimientos: movimientosEdicion });
      RenderizarSeccionDesdeFormulario(null, { pagina: 1, idMovimientoEditado: 'm1' });
      await screen.findByText('Mercado');

      await vi.waitFor(() => expect(document.activeElement).toBe(ObtenerFila('m1')));
      await vi.waitFor(() =>
        expect(screen.getByLabelText('Estado de la navegación').textContent).not.toMatch(
          /idMovimientoEditado/,
        ),
      );
      expect(document.activeElement).toBe(ObtenerFila('m1'));
    });

    it('al volver de editar, si el movimiento no está en la página 1, enfoca la primera fila (D5)', async () => {
      ConfigurarServidor({ movimientos: CrearMovimientos(120) });
      RenderizarSeccionDesdeFormulario(null, { pagina: 1, idMovimientoEditado: 'mov-075' });
      await screen.findByText('Página 1 de 3');

      await vi.waitFor(() => expect(document.activeElement).toBe(ObtenerFilas()[0]));
      expect(ObtenerFilas()[0]).toHaveTextContent('Categoría 001');
    });

    it('al volver de cancelar la edición (sin "pagina" en el estado) también enfoca la fila editada', async () => {
      ConfigurarServidor({ movimientos: movimientosEdicion });
      RenderizarSeccionDesdeFormulario(null, { idMovimientoEditado: 'm3' });
      await screen.findByText('Café');

      await vi.waitFor(() => expect(document.activeElement).toBe(ObtenerFila('m3')));
    });

    it('al volver con "atrás" del historial a la entrada que trajo idMovimientoEditado, no fuerza el foco', async () => {
      ConfigurarServidor({ movimientos: movimientosEdicion });
      RenderizarSeccionDesdeFormulario(null, { pagina: 1, idMovimientoEditado: 'm1' });
      await screen.findByText('Mercado');
      await vi.waitFor(() => expect(document.activeElement).toBe(ObtenerFila('m1')));
      await vi.waitFor(() =>
        expect(screen.getByLabelText('Estado de la navegación').textContent).not.toMatch(
          /idMovimientoEditado/,
        ),
      );

      fireEvent.click(ObtenerFila('m2'));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Editar' }));
      await screen.findByRole('heading', { name: 'Pantalla Editar' });
      document.activeElement.blur();
      fireEvent.click(screen.getByRole('button', { name: 'Atrás del Historial' }));

      await screen.findByText('Mercado');
      expect(document.activeElement).toBe(document.body);
    });

    it('sin movimientos, volver de editar no falla ni fuerza el foco', async () => {
      RenderizarSeccionDesdeFormulario(null, { pagina: 1, idMovimientoEditado: 'm1' });
      await screen.findByText(mensajeSinMovimientos);

      expect(document.activeElement).toBe(document.body);
      await vi.waitFor(() =>
        expect(screen.getByLabelText('Estado de la navegación').textContent).not.toMatch(
          /idMovimientoEditado/,
        ),
      );
    });
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

  it('(AC-70, FR-45) con un movimiento de monto "abc" muestra el error de carga en lugar de quedar vacía, y "Aceptar" con datos válidos muestra la lista y el saldo', async () => {
    const usuario = userEvent.setup();
    ConfigurarServidor({
      cuenta: CrearCuenta('8500.00'),
      movimientos: [
        CrearMovimiento('m1', '2026-09-17', 'GASTO', '1500.00', 'Mercado'),
        CrearMovimiento('m2', '2026-09-16', 'GASTO', 'abc', 'Café'),
      ],
    });
    RenderizarSeccion();

    const dialogo = await screen.findByRole('alertdialog');
    expect(dialogo).toHaveTextContent(mensajeErrorCarga);
    expect(within(dialogo).getByRole('button', { name: 'Aceptar' })).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);

    ConfigurarServidor({
      cuenta: CrearCuenta('8500.00'),
      movimientos: [CrearMovimiento('m1', '2026-09-17', 'GASTO', '1500.00', 'Mercado')],
    });
    await usuario.click(screen.getByRole('button', { name: 'Aceptar' }));

    expect(await screen.findByText('USD 8.500,00')).toBeInTheDocument();
    expect(screen.getByText('-1.500,00')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('(AC-70, FR-45) con la cuenta con saldo "abc" muestra el error de carga en lugar de quedar vacía, y "Aceptar" con datos válidos muestra la lista y el saldo', async () => {
    const usuario = userEvent.setup();
    ConfigurarServidor({
      cuenta: CrearCuenta('abc'),
      movimientos: [CrearMovimiento('m1', '2026-09-17', 'GASTO', '1500.00', 'Mercado')],
    });
    RenderizarSeccion();

    const dialogo = await screen.findByRole('alertdialog');
    expect(dialogo).toHaveTextContent(mensajeErrorCarga);
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

  describe('eliminación desde el menú de la fila', () => {
    const mensajeEliminado = 'Movimiento eliminado con éxito.';
    const mensajeErrorEliminar = 'No se pudo eliminar el movimiento. Vuelva a intentarlo.';
    const textoPregunta = '¿Está seguro que desea eliminar este movimiento?';

    // EliminarMovimiento solo acepta ids con forma de UUID.
    function CrearIdMovimiento(numero) {
      return `00000000-0000-4000-8000-${String(numero).padStart(12, '0')}`;
    }

    const idIngreso = CrearIdMovimiento(2);
    const idGasto = CrearIdMovimiento(1);
    const idCafe = CrearIdMovimiento(3);
    const idVenta = CrearIdMovimiento(4);

    // Saldo 5.000 = ingreso de 1.000 + ingreso de 4.800 − gasto de 800.
    function ConfigurarCuentaAc03() {
      ConfigurarServidor({
        cuenta: CrearCuenta('5000.00'),
        movimientos: [
          CrearMovimiento(idCafe, '2026-10-02', 'GASTO', '800.00', 'Café'),
          CrearMovimiento(idIngreso, '2026-10-01', 'INGRESO', '1000.00', 'Sueldo'),
          CrearMovimiento(idVenta, '2026-09-17', 'INGRESO', '4800.00', 'Venta'),
        ],
      });
    }

    // 120 movimientos con ids UUID; "Categoría 001" es el más reciente.
    function CrearMovimientosEliminables(cantidad) {
      return Array.from({ length: cantidad }, (_, indice) => {
        const posicion = String(indice + 1).padStart(3, '0');
        return CrearMovimiento(CrearIdMovimiento(indice + 1), '2026-10-02', 'GASTO', '10.00', `Categoría ${posicion}`);
      });
    }

    function AbrirConfirmacion(idMovimiento) {
      fireEvent.click(ObtenerFila(idMovimiento));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Eliminar' }));
      return screen.getByRole('alertdialog', { name: textoPregunta });
    }

    function LlamadasEliminar() {
      return simulacion.llamadasRpc.filter((llamada) => llamada.nombre === 'basp_eliminar_movimiento');
    }

    // Retiene la respuesta del RPC hasta que la prueba la libere.
    function RetenerRpc() {
      const responderInmediato = simulacion.responderRpc;
      const retencion = { liberar: null };
      simulacion.responderRpc = (...argumentos) =>
        new Promise((resolver) => {
          retencion.liberar = () => resolver(responderInmediato(...argumentos));
        });
      return retencion;
    }

    it('elegir "Eliminar" muestra la pregunta con "Confirmar" y "Cancelar", con el foco en "Cancelar" (AC-02)', async () => {
      ConfigurarCuentaAc03();
      RenderizarSeccion();
      await screen.findByText('Sueldo');

      const dialogo = AbrirConfirmacion(idIngreso);

      expect(dialogo).toHaveAttribute('aria-modal', 'true');
      expect(within(dialogo).getByText(textoPregunta)).toBeInTheDocument();
      expect(within(dialogo).getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
      expect(document.activeElement).toBe(within(dialogo).getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(LlamadasEliminar()).toHaveLength(0);
    });

    it.each([
      ['un clic en "Cancelar"', () => fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))],
      ['Escape', () => fireEvent.keyDown(document.activeElement, { key: 'Escape' })],
    ])('%s cierra la confirmación sin llamar al RPC; la fila y el saldo siguen y el foco vuelve a la fila (AC-04)', async (_, Cancelar) => {
      ConfigurarCuentaAc03();
      RenderizarSeccion();
      await screen.findByText('Sueldo');
      AbrirConfirmacion(idIngreso);

      Cancelar();

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(LlamadasEliminar()).toHaveLength(0);
      expect(ObtenerFila(idIngreso)).toHaveTextContent('Sueldo+1.000,00');
      expect(ObtenerSaldo()).toHaveTextContent('USD 5.000,00');
      expect(document.activeElement).toBe(ObtenerFila(idIngreso));
    });

    it('dos clics seguidos en "Confirmar" llaman al RPC una sola vez; mientras tanto "Eliminando…" tiene el foco, "Cancelar" está deshabilitado y Escape no cierra (AC-05, E3-2, E3-3)', async () => {
      ConfigurarCuentaAc03();
      RenderizarSeccion();
      await screen.findByText('Sueldo');
      const retencion = RetenerRpc();
      const dialogo = AbrirConfirmacion(idIngreso);
      const confirmar = within(dialogo).getByRole('button', { name: 'Confirmar' });

      confirmar.focus();
      fireEvent.click(confirmar);
      fireEvent.click(confirmar);
      await vi.waitFor(() => expect(retencion.liberar).toBeTypeOf('function'));

      expect(LlamadasEliminar()).toHaveLength(1);
      expect(LlamadasEliminar()[0].parametros).toEqual({ p_id_movimiento: idIngreso });
      const eliminando = within(dialogo).getByRole('button', { name: 'Eliminando…' });
      expect(eliminando).toBe(confirmar);
      expect(eliminando).toHaveAttribute('aria-disabled', 'true');
      expect(eliminando).not.toHaveAttribute('disabled');
      expect(document.activeElement).toBe(eliminando);
      expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
      fireEvent.keyDown(eliminando, { key: 'Escape' });
      fireEvent.click(eliminando);
      expect(screen.getByRole('alertdialog', { name: textoPregunta })).toBe(dialogo);
      expect(LlamadasEliminar()).toHaveLength(1);

      retencion.liberar();

      await vi.waitFor(() => expect(ObtenerSaldo()).toHaveTextContent('USD 4.000,00'));
      expect(LlamadasEliminar()).toHaveLength(1);
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('doble Enter en "Confirmar" llama al RPC una sola vez (AC-05, E3-2)', async () => {
      ConfigurarCuentaAc03();
      RenderizarSeccion();
      await screen.findByText('Sueldo');
      const retencion = RetenerRpc();
      AbrirConfirmacion(idIngreso);
      const usuario = userEvent.setup();

      await usuario.tab();
      expect(document.activeElement).toHaveTextContent('Confirmar');
      await usuario.keyboard('{Enter}');
      await usuario.keyboard('{Enter}');
      await vi.waitFor(() => expect(retencion.liberar).toBeTypeOf('function'));

      expect(LlamadasEliminar()).toHaveLength(1);
      retencion.liberar();
      await vi.waitFor(() => expect(ObtenerSaldo()).toHaveTextContent('USD 4.000,00'));
      expect(LlamadasEliminar()).toHaveLength(1);
    });

    it('estando en la página 1, eliminar vuelve a pedir la página 1 y la cuenta, y el foco queda en la primera fila', async () => {
      ConfigurarCuentaAc03();
      RenderizarSeccion();
      await screen.findByText('Sueldo');
      const consultasAntes = simulacion.consultas.length;

      AbrirConfirmacion(idIngreso);
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

      await vi.waitFor(() => expect(ObtenerFila(idIngreso)).toBeUndefined());
      const consultasRecarga = simulacion.consultas.slice(consultasAntes);
      expect(consultasRecarga.map((consulta) => consulta.tabla).sort()).toEqual([
        'bav_cuenta',
        'bav_movimientos',
      ]);
      expect(consultasRecarga.find((consulta) => consulta.tabla === 'bav_movimientos').range).toEqual([0, 49]);
      expect(ObtenerFilas().map((fila) => fila.textContent)).toEqual(['Café-800,00', 'Venta+4.800,00']);
      await vi.waitFor(() => expect(document.activeElement).toBe(ObtenerFilas()[0]));
    });

    it('con 120 movimientos en la página 2, eliminar uno vuelve a la página 1 con "Página 1 de 3" y el foco en su primera fila (AC-06)', async () => {
      ConfigurarServidor({ movimientos: CrearMovimientosEliminables(120) });
      RenderizarSeccion();
      await screen.findByText('Página 1 de 3');
      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
      await screen.findByText('Página 2 de 3');

      const idPagina2 = CrearIdMovimiento(60);
      AbrirConfirmacion(idPagina2);
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

      expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument();
      expect(ObtenerFilas()[0]).toHaveTextContent('Categoría 001');
      expect(ConsultasDeMovimientos().at(-1).range).toEqual([0, 49]);
      expect(LlamadasEliminar()).toEqual([
        { nombre: 'basp_eliminar_movimiento', parametros: { p_id_movimiento: idPagina2 } },
      ]);
      await vi.waitFor(() => expect(document.activeElement).toBe(ObtenerFilas()[0]));
    });

    it('eliminar el único movimiento muestra "Aquí verá sus movimientos." y "USD 0,00", con el foco en "Añadir Gasto" (AC-07)', async () => {
      ConfigurarServidor({
        cuenta: CrearCuenta('-500.00'),
        movimientos: [CrearMovimiento(idGasto, '2026-10-01', 'GASTO', '500.00', 'Mercado')],
      });
      RenderizarSeccion();
      await screen.findByText('Mercado');

      AbrirConfirmacion(idGasto);
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

      expect(await screen.findByText(mensajeSinMovimientos)).toBeInTheDocument();
      expect(ObtenerSaldo()).toHaveTextContent('USD 0,00');
      await vi.waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Añadir Gasto' })),
      );
    });

    it('(error E3-1) con el RPC rechazado se cierra la confirmación, se muestra el error con "Aceptar", la fila y el saldo siguen y al aceptar el foco vuelve a la fila (AC-08, AC-11)', async () => {
      ConfigurarCuentaAc03();
      simulacion.responderRpc = () => ({ data: null, error: { message: 'falla simulada', code: 'BA500' } });
      RenderizarSeccion();
      await screen.findByText('Sueldo');
      const consultasAntes = simulacion.consultas.length;

      AbrirConfirmacion(idIngreso);
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

      const error = await screen.findByRole('alertdialog', { name: mensajeErrorEliminar });
      expect(screen.queryByRole('alertdialog', { name: textoPregunta })).not.toBeInTheDocument();
      expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
      expect(screen.queryByText(/BA500|falla simulada/)).not.toBeInTheDocument();
      expect(LlamadasEliminar()).toHaveLength(1);
      expect(ObtenerFila(idIngreso)).toHaveTextContent('Sueldo+1.000,00');
      expect(ObtenerSaldo()).toHaveTextContent('USD 5.000,00');
      expect(simulacion.consultas.length).toBe(consultasAntes);

      fireEvent.click(within(error).getByRole('button', { name: 'Aceptar' }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(document.activeElement).toBe(ObtenerFila(idIngreso));
    });

    it('(error E3-1) después de un rechazo se puede volver a eliminar el mismo movimiento', async () => {
      ConfigurarCuentaAc03();
      const responderBien = simulacion.responderRpc;
      simulacion.responderRpc = () => ({ data: null, error: { code: 'BA500' } });
      RenderizarSeccion();
      await screen.findByText('Sueldo');
      AbrirConfirmacion(idIngreso);
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Aceptar' }));

      simulacion.responderRpc = responderBien;
      AbrirConfirmacion(idIngreso);
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

      await vi.waitFor(() => expect(ObtenerSaldo()).toHaveTextContent('USD 4.000,00'));
      expect(LlamadasEliminar()).toHaveLength(2);
    });

    it('(error E3-4) si la recarga posterior al éxito falla, se muestra el error de carga y, tras "Aceptar", la recarga exitosa enfoca la primera fila', async () => {
      ConfigurarCuentaAc03();
      RenderizarSeccion();
      await screen.findByText('Sueldo');
      const responderMovimientos = simulacion.responderMovimientos;
      simulacion.responderMovimientos = () => ({ data: null, error: errorSupabase, count: null });

      AbrirConfirmacion(idIngreso);
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

      const error = await screen.findByRole('alertdialog', { name: mensajeErrorCarga });
      expect(LlamadasEliminar()).toHaveLength(1);
      simulacion.responderMovimientos = responderMovimientos;
      fireEvent.click(within(error).getByRole('button', { name: 'Aceptar' }));

      await vi.waitFor(() => expect(ObtenerFila(idIngreso)).toBeUndefined());
      expect(ObtenerSaldo()).toHaveTextContent('USD 4.000,00');
      await vi.waitFor(() => expect(document.activeElement).toBe(ObtenerFilas()[0]));
      expect(ObtenerFilas()[0]).toHaveTextContent('Café');
    });

    it('(error E3-5) si Cuenta se desmonta durante la eliminación, no hay advertencias, no recarga y el mensaje de éxito se muestra', async () => {
      const espiaErrores = vi.spyOn(console, 'error');
      try {
        ConfigurarCuentaAc03();
        RenderizarSeccionConHistorial();
        await screen.findByText('Sueldo');
        const retencion = RetenerRpc();
        AbrirConfirmacion(idIngreso);
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
        await vi.waitFor(() => expect(retencion.liberar).toBeTypeOf('function'));

        fireEvent.click(screen.getByRole('button', { name: 'Atrás del Navegador' }));
        await screen.findByRole('heading', { name: 'Pantalla Anterior' });
        const consultasAntes = simulacion.consultas.length;
        retencion.liberar();

        expect(await screen.findByText(mensajeEliminado)).toBeInTheDocument();
        expect(simulacion.consultas.length).toBe(consultasAntes);
        expect(espiaErrores).not.toHaveBeenCalled();
      } finally {
        espiaErrores.mockRestore();
      }
    });

    it('(error E3-5, FR-10) si Cuenta se desmonta y el RPC falla, se muestra "No se pudo eliminar el movimiento. Vuelva a intentarlo."', async () => {
      const espiaErrores = vi.spyOn(console, 'error');
      try {
        ConfigurarCuentaAc03();
        simulacion.responderRpc = () => ({ data: null, error: { code: 'BA500' } });
        RenderizarSeccionConHistorial();
        await screen.findByText('Sueldo');
        const retencion = RetenerRpc();
        AbrirConfirmacion(idIngreso);
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
        await vi.waitFor(() => expect(retencion.liberar).toBeTypeOf('function'));

        fireEvent.click(screen.getByRole('button', { name: 'Atrás del Navegador' }));
        await screen.findByRole('heading', { name: 'Pantalla Anterior' });
        retencion.liberar();

        const error = await screen.findByRole('alertdialog', { name: mensajeErrorEliminar });
        expect(screen.queryByText(mensajeEliminado)).not.toBeInTheDocument();
        // La fila ya no está en el DOM: "Aceptar" cierra el error sin fallar.
        fireEvent.click(within(error).getByRole('button', { name: 'Aceptar' }));
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        expect(espiaErrores).not.toHaveBeenCalled();
      } finally {
        espiaErrores.mockRestore();
      }
    });

    it('(AC-71, FR-44) si se vuelve a "Añadir Gasto" con Atrás y la eliminación falla, "Aceptar" deja el foco en la flecha para volver atrás', async () => {
      ConfigurarCuentaAc03();
      simulacion.responderRpc = () => ({ data: null, error: { code: 'BA500' } });
      RenderizarSeccionDesdeAnadirGasto();
      await screen.findByText('Sueldo');
      const retencion = RetenerRpc();
      AbrirConfirmacion(idIngreso);
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
      await vi.waitFor(() => expect(retencion.liberar).toBeTypeOf('function'));

      fireEvent.click(screen.getByRole('button', { name: 'Atrás del Navegador' }));
      await screen.findByRole('heading', { name: 'Añadir Gasto' });
      retencion.liberar();

      const error = await screen.findByRole('alertdialog', { name: mensajeErrorEliminar });
      fireEvent.click(within(error).getByRole('button', { name: 'Aceptar' }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Volver atrás' })).toHaveFocus();
    });

    describe('con temporizadores falsos', () => {
      beforeEach(() => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      async function AvanzarTiempo(milisegundos) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(milisegundos);
        });
      }

      // Deja correr las promesas pendientes (servidor simulado) sin mover el reloj.
      async function EsperarHasta(condicion) {
        for (let intento = 0; intento < 50; intento += 1) {
          if (condicion()) {
            return;
          }
          await AvanzarTiempo(0);
        }
        expect(condicion()).toBe(true);
      }

      it('con saldo 5.000, "Eliminar" → "Confirmar" sobre el ingreso de 1.000 llama al RPC una vez, quita la fila, muestra "USD 4.000,00" y el mensaje con el tic, que se cierra a los 3 s (AC-03)', async () => {
        ConfigurarCuentaAc03();
        RenderizarSeccion();
        await EsperarHasta(() => screen.queryByText('Sueldo') !== null);

        AbrirConfirmacion(idIngreso);
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

        await EsperarHasta(() => ObtenerFila(idIngreso) === undefined);
        expect(LlamadasEliminar()).toEqual([
          { nombre: 'basp_eliminar_movimiento', parametros: { p_id_movimiento: idIngreso } },
        ]);
        expect(ObtenerSaldo()).toHaveTextContent('USD 4.000,00');
        expect(screen.queryByText('+1.000,00')).not.toBeInTheDocument();
        expect(screen.getByText(mensajeEliminado)).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Éxito' })).toBeInTheDocument();

        await AvanzarTiempo(2900);
        expect(screen.getByText(mensajeEliminado)).toBeInTheDocument();
        await AvanzarTiempo(200);
        expect(screen.queryByText(mensajeEliminado)).not.toBeInTheDocument();
      });
    });
  });
});
