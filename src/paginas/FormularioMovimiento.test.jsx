import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router';

// Servidor de Supabase simulado en memoria. La aplicación entera (App con sus
// rutas, la sesión, la sección Cuenta y el formulario) corre con sus servicios
// reales; solo se reemplaza el cliente de supabase-js. Las consultas aplican
// filtros eq y range como PostgREST, y el RPC de alta agrega el movimiento y deja
// el saldo que la prueba indica en `saldoTrasAlta` (el saldo lo calcula la base,
// nunca el navegador: ADR-001).
const servidor = vi.hoisted(() => ({
  cuenta: null,
  movimientos: [],
  categorias: [],
  consultas: [],
  llamadasRpc: [],
  responderRpc: null,
  saldoTrasAlta: null,
  fallar: { sesion: false, cuenta: false, categorias: false },
  // Si es una promesa, la consulta de categorías no responde hasta que se resuelva.
  retenerCategorias: null,
}));

vi.mock('../servicios/clienteSupabase.js', () => {
  const detalleTecnico = {
    code: 'PGRST301',
    message: 'Exception: JWT expired at BASP_AGREGAR_MOVIMIENTO (line 12)',
    details: 'at Object.query (postgrest.js:42)',
  };

  function Responder(registro) {
    if (registro.tabla === 'bav_cuenta') {
      if (servidor.fallar.cuenta) {
        return { data: null, error: detalleTecnico };
      }
      return { data: servidor.cuenta ? [{ ...servidor.cuenta }] : [], error: null };
    }
    if (registro.tabla === 'bav_movimientos') {
      const [desde, hasta] = registro.range ?? [0, servidor.movimientos.length - 1];
      return {
        data: servidor.movimientos.slice(desde, hasta + 1),
        error: null,
        count: servidor.movimientos.length,
      };
    }
    if (registro.tabla === 'bat_categorias') {
      if (servidor.fallar.categorias) {
        return { data: null, error: detalleTecnico };
      }
      const filas = servidor.categorias.filter((categoria) =>
        registro.filtros.every(([columna, valor]) => categoria[columna] === valor),
      );
      return { data: filas, error: null };
    }
    return { data: null, error: detalleTecnico };
  }

  function CrearConsulta(tabla) {
    const registro = { tabla, filtros: [], range: null };
    servidor.consultas.push(registro);
    const consulta = {
      select: () => consulta,
      order: () => consulta,
      eq(columna, valor) {
        registro.filtros.push([columna, valor]);
        return consulta;
      },
      range(desde, hasta) {
        registro.range = [desde, hasta];
        return consulta;
      },
      then(alResolver, alRechazar) {
        const espera = tabla === 'bat_categorias' ? servidor.retenerCategorias : null;
        return Promise.resolve(espera)
          .then(() => Responder(registro))
          .then(alResolver, alRechazar);
      },
    };
    return consulta;
  }

  const sesionPrueba = { access_token: 'token', user: { id: 'usuario-a' } };

  return {
    clienteSupabase: {
      from: (tabla) => CrearConsulta(tabla),
      rpc: (nombre, parametros) => {
        servidor.llamadasRpc.push({ nombre, parametros });
        return Promise.resolve().then(() => servidor.responderRpc(parametros));
      },
      auth: {
        getSession: async () => ({
          data: { session: servidor.fallar.sesion ? null : sesionPrueba },
          error: null,
        }),
        signInAnonymously: async () => ({ data: { session: null, user: null }, error: detalleTecnico }),
      },
    },
  };
});

import App from '../App.jsx';

const ahoraSimulado = new Date(2026, 9, 3, 12, 0, 0); // sábado 03/10/2026, 12:00 local
const hoy = '2026-10-03';

const mensajeGasto = 'Gasto registrado con éxito.';
const mensajeIngreso = 'Ingreso registrado con éxito.';
const mensajeMayorACero = 'El monto debe ser mayor a 0.';
const mensajeMaximo = 'El monto máximo es 999.999.999.999,99.';
const mensajeErrorGuardar = 'No se pudo guardar el movimiento. Vuelva a intentarlo.';
const mensajeErrorCarga = 'No se pudieron cargar sus movimientos. Vuelva a intentarlo.';
const mensajeErrorSesion = 'No se pudo iniciar la sesión. Vuelva a intentarlo.';

function CrearCategoria(id, nombre, tipo, esPorDefecto = false) {
  return { id, nombre, tipo, es_por_defecto: esPorDefecto };
}

const categoriasPorDefecto = [
  CrearCategoria('cat-pago-realizado', 'Pago Realizado', 'GASTO', true),
  CrearCategoria('cat-pago-ingresado', 'Pago Ingresado', 'INGRESO', true),
];
const categoriaMercado = CrearCategoria('cat-mercado', 'Mercado', 'GASTO');
const categoriaSueldo = CrearCategoria('cat-sueldo', 'Sueldo', 'INGRESO');

function CrearMovimientos(cantidad, fecha = '2026-10-02') {
  return Array.from({ length: cantidad }, (_, indice) => {
    const posicion = String(indice + 1).padStart(3, '0');
    return {
      id: `mov-${posicion}`,
      fecha,
      tipo: 'GASTO',
      monto: '10.00',
      nombre_categoria: `Categoría ${posicion}`,
      creado_en: `${fecha}T12:00:00+00:00`,
    };
  });
}

// Alta simulada: inserta el movimiento en el orden de bav_movimientos (fecha
// desc; dentro de la fecha, el más reciente primero) y deja el saldo indicado.
let contadorAltas = 0;
function AplicarAlta(parametros) {
  contadorAltas += 1;
  const categoria = servidor.categorias.find((elemento) => elemento.id === parametros.p_id_categoria);
  const movimiento = {
    id: `nuevo-${contadorAltas}`,
    fecha: parametros.p_fecha,
    tipo: parametros.p_tipo,
    monto: parametros.p_monto,
    nombre_categoria: categoria.nombre,
    creado_en: `${parametros.p_fecha}T23:59:59+00:00`,
  };
  const posicion = servidor.movimientos.findIndex((elemento) => elemento.fecha <= movimiento.fecha);
  servidor.movimientos.splice(posicion === -1 ? servidor.movimientos.length : posicion, 0, movimiento);
  if (servidor.saldoTrasAlta !== null) {
    servidor.cuenta.saldo = servidor.saldoTrasAlta;
  }
  return { data: movimiento.id, error: null };
}

function ConfigurarServidor({
  saldo = '10000.00',
  categorias = [...categoriasPorDefecto, categoriaMercado, categoriaSueldo],
  movimientos = [],
  saldoTrasAlta = null,
} = {}) {
  servidor.cuenta = { id: 'cuenta-a', nombre: 'Mi Cuenta', moneda: 'USD', saldo };
  servidor.categorias = categorias;
  servidor.movimientos = movimientos;
  servidor.saldoTrasAlta = saldoTrasAlta;
}

function RenderizarApp(ruta = '/') {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  );
}

async function EsperarCuenta() {
  return screen.findByRole('heading', { name: 'Mi Cuenta (USD)' });
}

function ObtenerCampoMonto() {
  return screen.getByLabelText('Monto');
}

function ObtenerSelectorCategoria() {
  return screen.getByLabelText('Categoría');
}

function ObtenerCampoFecha() {
  return screen.getByLabelText('Fecha');
}

function ObtenerOpcionesCategoria() {
  return within(ObtenerSelectorCategoria())
    .getAllByRole('option')
    .map((opcion) => opcion.textContent);
}

// Abre el formulario desde Cuenta y espera a que carguen las categorías.
async function AbrirFormulario(nombreBoton) {
  fireEvent.click(screen.getByRole('button', { name: nombreBoton }));
  await screen.findByRole('heading', { level: 1, name: nombreBoton });
  await waitFor(() => expect(within(ObtenerSelectorCategoria()).getAllByRole('option').length).toBeGreaterThan(0));
}

function EscribirMonto(texto) {
  fireEvent.change(ObtenerCampoMonto(), { target: { value: texto } });
}

function ElegirCategoria(nombre) {
  const opcion = within(ObtenerSelectorCategoria()).getByRole('option', { name: nombre });
  fireEvent.change(ObtenerSelectorCategoria(), { target: { value: opcion.value } });
}

function ObtenerBotonDia(textoFecha) {
  const celda = document.querySelector(`[data-day="${textoFecha}"]`);
  expect(celda).not.toBeNull();
  return within(celda).getByRole('button');
}

function ElegirFecha(textoFecha) {
  fireEvent.click(ObtenerCampoFecha());
  fireEvent.click(ObtenerBotonDia(textoFecha));
}

function Guardar() {
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
}

// Ningún texto visible puede tener detalles técnicos (NFR-06, AC-60).
const expresionDetalleTecnico = /error|code|PGRST|BA4|BA5|Exception|\bat\s+\S+\.jsx?|line \d+/i;

describe('FormularioMovimiento', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(ahoraSimulado);
    servidor.consultas.length = 0;
    servidor.llamadasRpc.length = 0;
    servidor.responderRpc = AplicarAlta;
    servidor.fallar = { sesion: false, cuenta: false, categorias: false };
    servidor.retenerCategorias = null;
    ConfigurarServidor();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('selector de categoría', () => {
    it('para un usuario nuevo, "Añadir Gasto" tiene solo "Pago Realizado" y "Añadir Ingreso" solo "Pago Ingresado" (AC-06)', async () => {
      ConfigurarServidor({ saldo: '0.00', categorias: categoriasPorDefecto });
      RenderizarApp();
      await EsperarCuenta();

      await AbrirFormulario('Añadir Gasto');
      expect(ObtenerOpcionesCategoria()).toEqual(['Pago Realizado']);

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      await EsperarCuenta();
      await AbrirFormulario('Añadir Ingreso');
      expect(ObtenerOpcionesCategoria()).toEqual(['Pago Ingresado']);
    });

    it('con "Mercado" (gasto) y "Sueldo" (ingreso), "Añadir Gasto" muestra solo "Pago Realizado" y "Mercado", sin opción vacía (AC-22, FR-15, FR-16)', async () => {
      RenderizarApp('/gasto/nuevo');
      await screen.findByRole('option', { name: 'Mercado' });

      expect(ObtenerOpcionesCategoria()).toEqual(['Pago Realizado', 'Mercado']);
      for (const opcion of within(ObtenerSelectorCategoria()).getAllByRole('option')) {
        expect(opcion.value).not.toBe('');
      }
      expect(ObtenerSelectorCategoria().value).not.toBe('');
    });

    it.each([
      ['/gasto/nuevo', 'Pago Realizado'],
      ['/ingreso/nuevo', 'Pago Ingresado'],
    ])('%s preselecciona "%s" (AC-23, FR-18)', async (ruta, categoriaPorDefecto) => {
      // "Ahorro" va antes que "Pago" en orden alfabético: la preselección no es "la primera que llega".
      ConfigurarServidor({
        categorias: [
          CrearCategoria('cat-ahorro-g', 'Ahorro', 'GASTO'),
          CrearCategoria('cat-ahorro-i', 'Ahorro', 'INGRESO'),
          ...categoriasPorDefecto,
        ],
      });
      RenderizarApp(ruta);
      await screen.findByRole('option', { name: categoriaPorDefecto });

      expect(ObtenerSelectorCategoria()).toHaveDisplayValue(categoriaPorDefecto);
    });

    it('muestra "Pago Realizado", "café", "Mercado" y "Transporte" en ese orden (AC-26, FR-17)', async () => {
      ConfigurarServidor({
        categorias: [
          CrearCategoria('cat-transporte', 'Transporte', 'GASTO'),
          CrearCategoria('cat-cafe', 'café', 'GASTO'),
          categoriaMercado,
          ...categoriasPorDefecto,
        ],
      });
      RenderizarApp('/gasto/nuevo');
      await screen.findByRole('option', { name: 'Transporte' });

      expect(ObtenerOpcionesCategoria()).toEqual(['Pago Realizado', 'café', 'Mercado', 'Transporte']);
    });

    it('(error E6-4) si falla la carga de categorías muestra el error de carga con "Aceptar" y "Guardar" deshabilitado; "Aceptar" reintenta', async () => {
      servidor.fallar.categorias = true;
      RenderizarApp('/gasto/nuevo');

      const dialogo = await screen.findByRole('alertdialog');
      expect(dialogo).toHaveTextContent(mensajeErrorCarga);
      expect(document.body.textContent).not.toMatch(expresionDetalleTecnico);
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();

      servidor.fallar.categorias = false;
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }));

      expect(await screen.findByRole('option', { name: 'Pago Realizado' })).toBeInTheDocument();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
    });
    it('mientras cargan las categorías el combo "Categoría" está deshabilitado, igual que "Guardar", y se habilita al cargar', async () => {
      let liberarCategorias;
      servidor.retenerCategorias = new Promise((resolver) => {
        liberarCategorias = resolver;
      });
      RenderizarApp('/gasto/nuevo');
      await screen.findByRole('heading', { level: 1, name: 'Añadir Gasto' });

      expect(ObtenerSelectorCategoria()).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();

      await act(async () => {
        liberarCategorias();
      });

      expect(await screen.findByRole('option', { name: 'Pago Realizado' })).toBeInTheDocument();
      expect(ObtenerSelectorCategoria()).toBeEnabled();
    });

    it('(error E6-4) si falla la carga de categorías el combo "Categoría" queda deshabilitado y se habilita al reintentar con éxito', async () => {
      servidor.fallar.categorias = true;
      RenderizarApp('/gasto/nuevo');

      const dialogo = await screen.findByRole('alertdialog');
      expect(ObtenerSelectorCategoria()).toBeDisabled();

      servidor.fallar.categorias = false;
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }));

      await screen.findByRole('option', { name: 'Pago Realizado' });
      expect(ObtenerSelectorCategoria()).toBeEnabled();
    });
  });

  describe('campos', () => {
    it('el 03/10/2026 muestra "Monto", "Categoría" y "Fecha" con "03/10/2026" y el calendario de octubre de 2026 en español desde el lunes (AC-67, FR-48)', async () => {
      RenderizarApp('/gasto/nuevo');
      await screen.findByRole('option', { name: 'Pago Realizado' });

      expect(ObtenerCampoMonto()).toHaveValue('');
      expect(ObtenerSelectorCategoria()).toBeInTheDocument();
      expect(ObtenerCampoFecha()).toHaveTextContent('03/10/2026');

      fireEvent.click(ObtenerCampoFecha());
      const calendario = screen.getByRole('grid');
      expect(calendario).toHaveAccessibleName('octubre 2026');
      // react-day-picker oculta el encabezado (thead aria-hidden): cada día ya se
      // anuncia con su nombre completo. Se leen las celdas del DOM.
      const diasSemana = [...calendario.querySelectorAll('thead th')].map((encabezado) =>
        encabezado.getAttribute('aria-label'),
      );
      expect(diasSemana[0]).toBe('lunes');
      expect(diasSemana[6]).toBe('domingo');
    });

    it('el campo de monto del formulario filtra lo que se escribe: "abc50" muestra "50" (AC-18)', async () => {
      RenderizarApp('/gasto/nuevo');
      await screen.findByRole('option', { name: 'Pago Realizado' });

      EscribirMonto('abc50');

      expect(ObtenerCampoMonto()).toHaveValue('50');
    });

    it.each([['/gasto/nuevo'], ['/ingreso/nuevo']])(
      'en %s el calendario solo elige fecha, preselecciona hoy y deshabilita los días posteriores (AC-21)',
      async (ruta) => {
        RenderizarApp(ruta);
        await screen.findByRole('option', { name: /^Pago/ });

        fireEvent.click(ObtenerCampoFecha());

        expect(document.querySelector(`[data-day="${hoy}"]`)).toHaveAttribute('aria-selected', 'true');
        expect(ObtenerBotonDia('2026-10-04')).toBeDisabled();
        fireEvent.click(ObtenerBotonDia('2026-10-04'));
        expect(ObtenerCampoFecha()).toHaveTextContent('03/10/2026');
        expect(document.querySelector('input[type="time"], input[type="datetime-local"]')).toBeNull();
      },
    );

    it('el calendario no permite deseleccionar la fecha (AC-24)', async () => {
      RenderizarApp('/gasto/nuevo');
      await screen.findByRole('option', { name: 'Pago Realizado' });

      ElegirFecha(hoy);

      expect(ObtenerCampoFecha()).toHaveTextContent('03/10/2026');
      fireEvent.click(ObtenerCampoFecha());
      expect(document.querySelector(`[data-day="${hoy}"]`)).toHaveAttribute('aria-selected', 'true');
    });

    it.each([['/gasto/nuevo'], ['/ingreso/nuevo']])('%s muestra el botón "Guardar" (AC-34)', async (ruta) => {
      RenderizarApp(ruta);
      await screen.findByRole('option', { name: /^Pago/ });

      expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('type', 'submit');
    });
  });

  describe('alta', () => {
    it('gasto de 1500 en "Mercado" con la fecha de hoy: envía "1500.00", muestra el éxito y Cuenta muestra "-1.500,00" bajo hoy y "USD 8.500,00" (AC-12)', async () => {
      ConfigurarServidor({ saldoTrasAlta: '8500.00' });
      RenderizarApp();
      await EsperarCuenta();

      await AbrirFormulario('Añadir Gasto');
      EscribirMonto('1500');
      ElegirCategoria('Mercado');
      Guardar();

      expect(await screen.findByText(mensajeGasto)).toBeInTheDocument();
      await EsperarCuenta();
      expect(servidor.llamadasRpc).toEqual([
        {
          nombre: 'basp_agregar_movimiento',
          parametros: { p_tipo: 'GASTO', p_monto: '1500.00', p_id_categoria: 'cat-mercado', p_fecha: hoy },
        },
      ]);
      expect(await screen.findByText('USD 8.500,00')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: '03/10/2026' })).toBeInTheDocument();
      expect(screen.getByRole('listitem')).toHaveTextContent('Mercado-1.500,00');
      expect(screen.getByRole('img', { name: 'Éxito' })).toBeInTheDocument();
    });

    it('ingreso de 1000 en "Sueldo": "Ingreso registrado con éxito.", "+1.000,00" y "USD 11.000,00" (AC-13)', async () => {
      ConfigurarServidor({ saldoTrasAlta: '11000.00' });
      RenderizarApp();
      await EsperarCuenta();

      await AbrirFormulario('Añadir Ingreso');
      EscribirMonto('1000');
      ElegirCategoria('Sueldo');
      Guardar();

      expect(await screen.findByText(mensajeIngreso)).toBeInTheDocument();
      expect(await screen.findByText('USD 11.000,00')).toBeInTheDocument();
      expect(servidor.llamadasRpc[0].parametros).toEqual({
        p_tipo: 'INGRESO',
        p_monto: '1000.00',
        p_id_categoria: 'cat-sueldo',
        p_fecha: hoy,
      });
      expect(screen.getByRole('heading', { level: 2, name: '03/10/2026' })).toBeInTheDocument();
      expect(screen.getByRole('listitem')).toHaveTextContent('Sueldo+1.000,00');
    });

    it('"1500,50" con la categoría y la fecha por defecto envía "1500.50" y Cuenta muestra "-1.500,50" y "USD 8.499,50" (AC-20)', async () => {
      ConfigurarServidor({ saldoTrasAlta: '8499.50' });
      RenderizarApp();
      await EsperarCuenta();

      await AbrirFormulario('Añadir Gasto');
      EscribirMonto('1500,50');
      expect(ObtenerCampoMonto()).toHaveValue('1.500,50');
      Guardar();

      expect(await screen.findByText('USD 8.499,50')).toBeInTheDocument();
      expect(servidor.llamadasRpc[0].parametros).toEqual({
        p_tipo: 'GASTO',
        p_monto: '1500.50',
        p_id_categoria: 'cat-pago-realizado',
        p_fecha: hoy,
      });
      expect(screen.getByRole('listitem')).toHaveTextContent('Pago Realizado-1.500,50');
    });

    it('un gasto de 2000 con saldo 1000 se envía y Cuenta muestra "USD -1.000,00" (AC-27)', async () => {
      ConfigurarServidor({ saldo: '1000.00', saldoTrasAlta: '-1000.00' });
      RenderizarApp();
      await EsperarCuenta();

      await AbrirFormulario('Añadir Gasto');
      EscribirMonto('2000');
      Guardar();

      expect(await screen.findByText('USD -1.000,00')).toHaveClass('saldo-negativo');
      expect(servidor.llamadasRpc).toHaveLength(1);
      expect(servidor.llamadasRpc[0].parametros.p_monto).toBe('2000.00');
    });

    it('elegir 15/03/1990 y monto 100 envía "1990-03-15" y Cuenta muestra el grupo "15/03/1990" y "USD 9.900,00" (AC-30)', async () => {
      ConfigurarServidor({ saldoTrasAlta: '9900.00' });
      RenderizarApp();
      await EsperarCuenta();

      await AbrirFormulario('Añadir Gasto');
      fireEvent.click(ObtenerCampoFecha());
      fireEvent.change(screen.getByRole('combobox', { name: 'Elegir el año' }), { target: { value: '1990' } });
      fireEvent.change(screen.getByRole('combobox', { name: 'Elegir el mes' }), { target: { value: '2' } });
      fireEvent.click(ObtenerBotonDia('1990-03-15'));
      expect(ObtenerCampoFecha()).toHaveTextContent('15/03/1990');
      EscribirMonto('100');
      Guardar();

      expect(await screen.findByText('USD 9.900,00')).toBeInTheDocument();
      expect(servidor.llamadasRpc[0].parametros.p_fecha).toBe('1990-03-15');
      expect(screen.getByRole('heading', { level: 2, name: '15/03/1990' })).toBeInTheDocument();
    });

    it('(error E6-1) monto vacío y 0 no llaman al alta, muestran "El monto debe ser mayor a 0." con la cruz y "Aceptar", y al aceptar conservan "Mercado" y 01/10/2026 con el foco en "Monto" (AC-14)', async () => {
      RenderizarApp('/gasto/nuevo');
      await screen.findByRole('option', { name: 'Mercado' });
      ElegirCategoria('Mercado');
      ElegirFecha('2026-10-01');

      for (const monto of ['', '0']) {
        EscribirMonto(monto);
        Guardar();

        const dialogo = await screen.findByRole('alertdialog');
        expect(dialogo).toHaveTextContent(mensajeMayorACero);
        expect(within(dialogo).getByRole('img', { name: 'Error' })).toBeInTheDocument();
        fireEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }));

        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 1, name: 'Añadir Gasto' })).toBeInTheDocument();
        expect(ObtenerSelectorCategoria()).toHaveDisplayValue('Mercado');
        expect(ObtenerCampoFecha()).toHaveTextContent('01/10/2026');
        expect(document.activeElement).toBe(ObtenerCampoMonto());
      }
      expect(servidor.llamadasRpc).toHaveLength(0);
    });

    it('(error E6-2) 1.000.000.000.000,00 muestra "El monto máximo es 999.999.999.999,99." y no se envía; 999.999.999.999,99 se envía (AC-15)', async () => {
      ConfigurarServidor({ saldo: '0.00', saldoTrasAlta: '999999999999.99' });
      RenderizarApp();
      await EsperarCuenta();
      await AbrirFormulario('Añadir Ingreso');

      EscribirMonto('1000000000000,00');
      expect(ObtenerCampoMonto()).toHaveValue('1.000.000.000.000,00');
      Guardar();

      const dialogo = await screen.findByRole('alertdialog');
      expect(dialogo).toHaveTextContent(mensajeMaximo);
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }));
      expect(document.activeElement).toBe(ObtenerCampoMonto());
      expect(servidor.llamadasRpc).toHaveLength(0);

      EscribirMonto('999999999999,99');
      Guardar();

      expect(await screen.findByText('USD 999.999.999.999,99')).toBeInTheDocument();
      expect(servidor.llamadasRpc).toHaveLength(1);
      expect(servidor.llamadasRpc[0].parametros.p_monto).toBe('999999999999.99');
    });

    it('(error E6-3) si el alta falla muestra "No se pudo guardar el movimiento. Vuelva a intentarlo.", conserva "1.500", la categoría y la fecha, y Cuenta no cambia (AC-49)', async () => {
      servidor.responderRpc = () => {
        throw new Error('Failed to fetch');
      };
      RenderizarApp();
      await EsperarCuenta();
      await AbrirFormulario('Añadir Gasto');
      EscribirMonto('1500');
      ElegirCategoria('Mercado');
      ElegirFecha('2026-10-01');
      Guardar();

      const dialogo = await screen.findByRole('alertdialog');
      expect(dialogo).toHaveTextContent(mensajeErrorGuardar);
      expect(document.body.textContent).not.toMatch(expresionDetalleTecnico);
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }));

      expect(screen.getByRole('heading', { level: 1, name: 'Añadir Gasto' })).toBeInTheDocument();
      expect(ObtenerCampoMonto()).toHaveValue('1.500');
      expect(ObtenerCampoMonto()).toBeEnabled();
      expect(ObtenerSelectorCategoria()).toHaveDisplayValue('Mercado');
      expect(ObtenerCampoFecha()).toHaveTextContent('01/10/2026');
      expect(document.activeElement).toBe(ObtenerCampoMonto());
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      await EsperarCuenta();
      expect(await screen.findByText('USD 10.000,00')).toBeInTheDocument();
      expect(screen.getByText('Aquí verá sus movimientos.')).toBeInTheDocument();
    });

    it('(error E6-3) con la respuesta BA500 (falla simulada) muestra el mismo mensaje y conserva el formulario (AC-57)', async () => {
      servidor.responderRpc = () => ({
        data: null,
        error: { code: 'BA500', message: 'Falla simulada en AGREGAR_MOVIMIENTO', details: null, hint: null },
      });
      RenderizarApp('/gasto/nuevo');
      await screen.findByRole('option', { name: 'Mercado' });
      EscribirMonto('1000');
      Guardar();

      const dialogo = await screen.findByRole('alertdialog');
      expect(dialogo).toHaveTextContent(mensajeErrorGuardar);
      expect(document.body.textContent).not.toMatch(expresionDetalleTecnico);
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }));
      expect(screen.getByRole('heading', { level: 1, name: 'Añadir Gasto' })).toBeInTheDocument();
      expect(ObtenerCampoMonto()).toHaveValue('1.000');
      expect(ObtenerSelectorCategoria()).toHaveDisplayValue('Pago Realizado');
      expect(ObtenerCampoFecha()).toHaveTextContent('03/10/2026');
    });

    it('(error E6-5) dos clics seguidos en "Guardar" llaman una sola vez al alta; mientras procesa dice "Guardando…" deshabilitado y no se puede editar, cancelar ni volver (AC-35, FR-33)', async () => {
      ConfigurarServidor({ saldoTrasAlta: '8500.00' });
      let liberarAlta;
      servidor.responderRpc = (parametros) =>
        new Promise((resolver) => {
          liberarAlta = () => resolver(AplicarAlta(parametros));
        });
      RenderizarApp();
      await EsperarCuenta();
      await AbrirFormulario('Añadir Gasto');
      EscribirMonto('1500');

      const botonGuardar = screen.getByRole('button', { name: 'Guardar' });
      fireEvent.click(botonGuardar);
      fireEvent.click(botonGuardar);
      fireEvent.submit(botonGuardar.closest('form'));
      await waitFor(() => expect(liberarAlta).toBeTypeOf('function'));

      const botonGuardando = screen.getByRole('button', { name: 'Guardando…' });
      expect(botonGuardando).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(botonGuardando);
      expect(servidor.llamadasRpc).toHaveLength(1);

      expect(ObtenerCampoMonto()).toBeDisabled();
      expect(ObtenerSelectorCategoria()).toBeDisabled();
      expect(ObtenerCampoFecha()).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Volver atrás' })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      fireEvent.click(screen.getByRole('button', { name: 'Volver atrás' }));
      expect(screen.getByRole('heading', { level: 1, name: 'Añadir Gasto' })).toBeInTheDocument();

      // NFR-07: el foco no se pierde al deshabilitar los campos.
      expect(document.activeElement).toBe(botonGuardando);

      liberarAlta();
      expect(await screen.findByText('USD 8.500,00')).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(1);
      expect(servidor.llamadasRpc).toHaveLength(1);
    });

    it('(FR-43) si el usuario sale con Atrás mientras guarda, al terminar el alta igual muestra el mensaje de éxito', async () => {
      ConfigurarServidor({ saldoTrasAlta: '9500.00' });
      let liberarAlta;
      servidor.responderRpc = (parametros) =>
        new Promise((resolver) => {
          liberarAlta = () => resolver(AplicarAlta(parametros));
        });
      // El botón "Atrás" del navegador: queda fuera del formulario, así que no
      // lo deshabilita el guardado.
      function BotonAtrasNavegador() {
        const navegar = useNavigate();
        return (
          <button type="button" onClick={() => navegar(-1)}>
            Atrás del Navegador
          </button>
        );
      }
      render(
        <MemoryRouter initialEntries={['/', '/gasto/nuevo']} initialIndex={1}>
          <App />
          <BotonAtrasNavegador />
        </MemoryRouter>,
      );
      await screen.findByRole('option', { name: 'Pago Realizado' });
      EscribirMonto('500');
      Guardar();
      await waitFor(() => expect(liberarAlta).toBeTypeOf('function'));

      fireEvent.click(screen.getByRole('button', { name: 'Atrás del Navegador' }));
      await EsperarCuenta();
      expect(screen.queryByRole('heading', { level: 1, name: 'Añadir Gasto' })).not.toBeInTheDocument();
      liberarAlta();

      expect(await screen.findByText(mensajeGasto)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Mi Cuenta (USD)' })).toBeInTheDocument();
      expect(servidor.llamadasRpc).toHaveLength(1);
    });

    it('(NFR-07) al guardar con Enter desde "Monto", el foco pasa a "Guardando…" en lugar de perderse', async () => {
      let liberarAlta;
      servidor.responderRpc = (parametros) =>
        new Promise((resolver) => {
          liberarAlta = () => resolver(AplicarAlta(parametros));
        });
      RenderizarApp('/gasto/nuevo');
      await screen.findByRole('option', { name: 'Pago Realizado' });
      EscribirMonto('1500');
      ObtenerCampoMonto().focus();

      fireEvent.submit(ObtenerCampoMonto().closest('form'));
      await waitFor(() => expect(liberarAlta).toBeTypeOf('function'));

      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Guardando…' }));
      liberarAlta();
      expect(await screen.findByText(mensajeGasto)).toBeInTheDocument();
    });

    it('con 120 movimientos y la página 2 abierta, un alta vuelve a Cuenta en la página 1 con "Página 1 de 3" y el gasto nuevo primero (AC-44, FR-42)', async () => {
      ConfigurarServidor({ movimientos: CrearMovimientos(120), saldoTrasAlta: '9500.00' });
      RenderizarApp();
      await screen.findByText('Página 1 de 3');
      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
      await screen.findByText('Página 2 de 3');
      expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Categoría 051');

      await AbrirFormulario('Añadir Gasto');
      EscribirMonto('500');
      Guardar();

      expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument();
      expect(await screen.findByText('USD 9.500,00')).toBeInTheDocument();
      const filas = screen.getAllByRole('listitem');
      expect(filas).toHaveLength(50);
      expect(filas[0]).toHaveTextContent('Pago Realizado-500,00');
      expect(screen.getAllByRole('heading', { level: 2 })[0]).toHaveTextContent('03/10/2026');
      const consultasLista = servidor.consultas.filter((consulta) => consulta.tabla === 'bav_movimientos');
      expect(consultasLista.at(-1).range).toEqual([0, 49]);
    });
  });

  describe('salir sin guardar', () => {
    it('con 500, "Sueldo" y 01/10/2026, la flecha vuelve a Cuenta sin llamar al alta, y Cuenta no tiene flecha (AC-32, FR-32)', async () => {
      RenderizarApp();
      await EsperarCuenta();
      expect(screen.queryByRole('button', { name: 'Volver atrás' })).not.toBeInTheDocument();
      await AbrirFormulario('Añadir Ingreso');
      EscribirMonto('500');
      ElegirCategoria('Sueldo');
      ElegirFecha('2026-10-01');

      fireEvent.click(screen.getByRole('button', { name: 'Volver atrás' }));

      await EsperarCuenta();
      expect(await screen.findByText('USD 10.000,00')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Volver atrás' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Volver atrás')).not.toBeInTheDocument();
      expect(servidor.llamadasRpc).toHaveLength(0);
    });

    it('con 500, "Cancelar" cierra el formulario sin llamar al alta y el saldo sigue en "USD 10.000,00" (AC-33, FR-31)', async () => {
      RenderizarApp();
      await EsperarCuenta();
      await AbrirFormulario('Añadir Gasto');
      EscribirMonto('500');

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      await EsperarCuenta();
      expect(await screen.findByText('USD 10.000,00')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 1, name: 'Añadir Gasto' })).not.toBeInTheDocument();
      expect(servidor.llamadasRpc).toHaveLength(0);
    });

    it.each([['la flecha'], ['"Cancelar"'], ['guardar']])(
      'después de salir con %s, "Añadir Ingreso" se abre con monto vacío, "Pago Ingresado" y hoy (AC-25, FR-14)',
      async (salida) => {
        ConfigurarServidor({ saldoTrasAlta: '10500.00' });
        RenderizarApp();
        await EsperarCuenta();
        await AbrirFormulario('Añadir Ingreso');
        EscribirMonto('500');
        ElegirCategoria('Sueldo');
        ElegirFecha('2026-10-01');

        if (salida === 'la flecha') {
          fireEvent.click(screen.getByRole('button', { name: 'Volver atrás' }));
        } else if (salida === '"Cancelar"') {
          fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        } else {
          Guardar();
          await screen.findByText(mensajeIngreso);
        }
        await EsperarCuenta();
        await AbrirFormulario('Añadir Ingreso');

        expect(ObtenerCampoMonto()).toHaveValue('');
        expect(ObtenerSelectorCategoria()).toHaveDisplayValue('Pago Ingresado');
        expect(ObtenerCampoFecha()).toHaveTextContent('03/10/2026');
      },
    );
  });

  it('(AC-60, NFR-06) con fallas simuladas en el inicio de sesión, la carga y el alta, ningún texto mostrado tiene códigos ni trazas', async () => {
    // Inicio de sesión.
    servidor.fallar.sesion = true;
    RenderizarApp();
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(mensajeErrorSesion);
    expect(document.body.textContent).not.toMatch(expresionDetalleTecnico);
    cleanup();

    // Carga de la cuenta y la lista.
    servidor.fallar = { sesion: false, cuenta: true, categorias: false };
    RenderizarApp();
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(mensajeErrorCarga);
    expect(document.body.textContent).not.toMatch(expresionDetalleTecnico);
    cleanup();

    // Alta de un movimiento.
    servidor.fallar.cuenta = false;
    servidor.responderRpc = () => ({
      data: null,
      error: { code: 'BA422', message: 'Exception: monto inválido', details: 'at BASP_AGREGAR_MOVIMIENTO line 40' },
    });
    RenderizarApp('/gasto/nuevo');
    await screen.findByRole('option', { name: 'Pago Realizado' });
    EscribirMonto('100');
    Guardar();
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(mensajeErrorGuardar);
    expect(document.body.textContent).not.toMatch(expresionDetalleTecnico);
  });
});

// Con timers simulados se usa fireEvent y se avanza el reloj a mano: waitFor y
// findBy esperan con setTimeout, que acá está simulado.
describe('FormularioMovimiento con el mensaje de éxito en pantalla', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(ahoraSimulado);
    servidor.consultas.length = 0;
    servidor.llamadasRpc.length = 0;
    servidor.responderRpc = AplicarAlta;
    servidor.fallar = { sesion: false, cuenta: false, categorias: false };
    ConfigurarServidor({ saldoTrasAlta: '8500.00' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function AvanzarTiempo(milisegundos) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(milisegundos);
    });
  }

  // Deja correr las promesas pendientes (servicios simulados) sin mover el reloj.
  async function EsperarHasta(condicion) {
    for (let intento = 0; intento < 50; intento += 1) {
      if (condicion()) {
        return;
      }
      await AvanzarTiempo(0);
    }
    expect(condicion()).toBe(true);
  }

  function HayCategorias() {
    return screen.queryAllByRole('option').length > 0;
  }

  function EstaEnCuenta() {
    return screen.queryByRole('heading', { name: 'Mi Cuenta (USD)' }) !== null;
  }

  function MensajesExito() {
    return screen.queryAllByText(mensajeGasto);
  }

  it('"Añadir Gasto" → 500 → "Guardar" registra el segundo gasto en 3 interacciones y el mensaje nuevo reemplaza al anterior y dura 3 s (AC-46)', async () => {
    RenderizarApp();
    await EsperarHasta(EstaEnCuenta);

    // Primer gasto: el mensaje aparece en t = 0.
    fireEvent.click(screen.getByRole('button', { name: 'Añadir Gasto' }));
    await EsperarHasta(HayCategorias);
    EscribirMonto('1500');
    Guardar();
    await EsperarHasta(() => MensajesExito().length === 1 && EstaEnCuenta());

    // t = 1 s: el primer mensaje sigue en pantalla.
    await AvanzarTiempo(1000);
    expect(MensajesExito()).toHaveLength(1);

    // Segundo gasto en 3 interacciones, sin cerrar el primer mensaje.
    fireEvent.click(screen.getByRole('button', { name: 'Añadir Gasto' })); // 1
    await EsperarHasta(HayCategorias);
    expect(MensajesExito()).toHaveLength(1);
    EscribirMonto('500'); // 2
    Guardar(); // 3
    await EsperarHasta(() => servidor.llamadasRpc.length === 2 && EstaEnCuenta());
    await EsperarHasta(() => MensajesExito().length === 1);

    expect(servidor.llamadasRpc[1].parametros).toEqual({
      p_tipo: 'GASTO',
      p_monto: '500.00',
      p_id_categoria: 'cat-pago-realizado',
      p_fecha: hoy,
    });
    expect(screen.getAllByRole('img', { name: 'Éxito' })).toHaveLength(1);

    // t = 3,5 s desde el primero (2,5 s desde el segundo): sigue visible.
    await AvanzarTiempo(2500);
    expect(MensajesExito()).toHaveLength(1);

    // A los 3 s del segundo se cierra solo.
    await AvanzarTiempo(600);
    expect(MensajesExito()).toHaveLength(0);
  });
});
