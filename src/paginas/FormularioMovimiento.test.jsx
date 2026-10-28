import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router';

// Servidor de Supabase simulado en memoria. La aplicación entera (App con sus
// rutas, la sesión, la sección Cuenta y el formulario) corre con sus servicios
// reales; solo se reemplaza el cliente de supabase-js. Las consultas aplican
// filtros eq y range como PostgREST, y el RPC de alta agrega el movimiento y deja
// el saldo que la prueba indica en `saldoTrasAlta` (el saldo lo calcula la base,
// nunca el navegador: ADR-001). La lectura de un movimiento por id
// (`maybeSingle`) y el RPC de edición responden como la vista y la función de
// FEAT-001b; la edición recalcula el saldo en el servidor simulado.
const servidor = vi.hoisted(() => ({
  cuenta: null,
  movimientos: [],
  categorias: [],
  consultas: [],
  llamadasRpc: [],
  responderRpc: null,
  saldoTrasAlta: null,
  fallar: { sesion: false, cuenta: false, categorias: false, movimiento: false },
  // Si es una promesa, la consulta de categorías no responde hasta que se resuelva.
  retenerCategorias: null,
  // Igual, para la lectura de un movimiento por id.
  retenerMovimiento: null,
  // Si no es null, la lectura por id devuelve este monto (la lista no cambia).
  montoLecturaPorId: null,
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
    if (registro.tabla === 'bav_movimientos' && registro.unico) {
      if (servidor.fallar.movimiento) {
        return { data: null, error: detalleTecnico };
      }
      const fila = servidor.movimientos.find((movimiento) =>
        registro.filtros.every(([columna, valor]) => movimiento[columna] === valor),
      );
      if (!fila) {
        return { data: null, error: null };
      }
      const { id, fecha, tipo, monto, id_categoria } = fila;
      const montoLeido = servidor.montoLecturaPorId ?? monto;
      return { data: { id, fecha, tipo, monto: montoLeido, id_categoria }, error: null };
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
    const registro = { tabla, filtros: [], range: null, unico: false };
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
      maybeSingle() {
        registro.unico = true;
        return consulta;
      },
      then(alResolver, alRechazar) {
        const espera =
          tabla === 'bat_categorias'
            ? servidor.retenerCategorias
            : registro.unico
              ? servidor.retenerMovimiento
              : null;
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
        return Promise.resolve().then(() => servidor.responderRpc(parametros, nombre));
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
const mensajeEdicion = 'Movimiento actualizado con éxito.';
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

const categoriaTransporte = CrearCategoria('cat-transporte', 'Transporte', 'GASTO');
const categoriaAlquiler = CrearCategoria('cat-alquiler', 'Alquiler', 'INGRESO');

// Los ids de los movimientos tienen forma de uuid: ObtenerMovimiento rechaza
// cualquier otro sin consultar.
function CrearIdMovimiento(numero) {
  return `00000000-0000-4000-8000-${String(numero).padStart(12, '0')}`;
}

function CrearMovimientos(cantidad, fecha = '2026-10-02') {
  return Array.from({ length: cantidad }, (_, indice) => {
    const posicion = String(indice + 1).padStart(3, '0');
    return {
      id: CrearIdMovimiento(indice + 1),
      fecha,
      tipo: 'GASTO',
      monto: '10.00',
      nombre_categoria: `Categoría ${posicion}`,
      id_categoria: 'cat-pago-realizado',
      creado_en: `${fecha}T12:00:00+00:00`,
    };
  });
}

// Un movimiento como lo devuelve bav_movimientos, con su categoría.
function CrearMovimiento(numero, { fecha, tipo = 'GASTO', monto, categoria, creadoEn }) {
  return {
    id: CrearIdMovimiento(numero),
    fecha,
    tipo,
    monto,
    nombre_categoria: categoria.nombre,
    id_categoria: categoria.id,
    creado_en: creadoEn ?? `${fecha}T12:00:00+00:00`,
  };
}

// Orden de bav_movimientos: fecha desc, creado_en desc, id desc.
function OrdenarComoLaVista(movimientos) {
  movimientos.sort(
    (uno, otro) =>
      otro.fecha.localeCompare(uno.fecha) ||
      otro.creado_en.localeCompare(uno.creado_en) ||
      otro.id.localeCompare(uno.id),
  );
}

// Centavos solo dentro del servidor simulado: el navegador nunca hace cuentas
// con montos (ADR-001).
function ACentavos(textoApi) {
  return Math.round(Number(textoApi) * 100);
}

function EfectoEnSaldo(tipo, monto) {
  return tipo === 'INGRESO' ? ACentavos(monto) : -ACentavos(monto);
}

// Edición simulada: cambia el movimiento sin tocar creado_en y ajusta el saldo
// restando el efecto anterior y sumando el nuevo, como BASP_EDITAR_MOVIMIENTO.
function AplicarEdicion(parametros) {
  const movimiento = servidor.movimientos.find((elemento) => elemento.id === parametros.p_id_movimiento);
  const categoria = servidor.categorias.find((elemento) => elemento.id === parametros.p_id_categoria);
  if (!movimiento || !categoria || categoria.tipo !== parametros.p_tipo) {
    return { data: null, error: { code: 'BA404', message: 'Movimiento inexistente' } };
  }
  const saldo =
    ACentavos(servidor.cuenta.saldo) -
    EfectoEnSaldo(movimiento.tipo, movimiento.monto) +
    EfectoEnSaldo(parametros.p_tipo, parametros.p_monto);
  servidor.cuenta.saldo = (saldo / 100).toFixed(2);
  Object.assign(movimiento, {
    tipo: parametros.p_tipo,
    monto: parametros.p_monto,
    id_categoria: categoria.id,
    nombre_categoria: categoria.nombre,
    fecha: parametros.p_fecha,
  });
  OrdenarComoLaVista(servidor.movimientos);
  return { data: movimiento.id, error: null };
}

function ResponderRpc(parametros, nombre) {
  return nombre === 'basp_editar_movimiento' ? AplicarEdicion(parametros) : AplicarAlta(parametros);
}

function LlamadasEdicion() {
  return servidor.llamadasRpc.filter((llamada) => llamada.nombre === 'basp_editar_movimiento');
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

// Cada fila de la lista es un botón dentro de su <li>.
function ObtenerFilas() {
  return screen.getAllByRole('listitem').map((elemento) => within(elemento).getByRole('button'));
}

function ObtenerFila(idMovimiento) {
  return ObtenerFilas().find((fila) => fila.dataset.idMovimiento === idMovimiento);
}

// Desde Cuenta: abre el menú de la fila, elige "Editar" y espera a que el
// formulario cargue el movimiento y las categorías ("Guardar" habilitado).
async function AbrirEdicion(idMovimiento) {
  await waitFor(() => expect(ObtenerFila(idMovimiento)).toBeDefined());
  fireEvent.click(ObtenerFila(idMovimiento));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Editar' }));
  await EsperarEdicionCargada();
}

async function EsperarEdicionCargada() {
  await screen.findByRole('heading', { level: 1, name: 'Editar Movimiento' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled());
}

function ElegirTipo(nombre) {
  fireEvent.click(screen.getByRole('radio', { name: nombre }));
}

async function EsperarCategorias(primeraOpcion) {
  await waitFor(() => expect(ObtenerOpcionesCategoria()[0]).toBe(primeraOpcion));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled());
}

function Pegar(texto) {
  fireEvent.paste(ObtenerCampoMonto(), { clipboardData: { getData: () => texto } });
}

// Elige una fecha de otro mes con las listas de mes y año del calendario.
function ElegirFechaDeOtroMes(textoFecha) {
  const [anio, mes] = textoFecha.split('-');
  fireEvent.click(ObtenerCampoFecha());
  fireEvent.change(screen.getByRole('combobox', { name: 'Elegir el año' }), { target: { value: anio } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Elegir el mes' }), {
    target: { value: String(Number(mes) - 1) },
  });
  fireEvent.click(ObtenerBotonDia(textoFecha));
}

// Ningún texto visible puede tener detalles técnicos (NFR-06, AC-60).
const expresionDetalleTecnico = /error|code|PGRST|BA4|BA5|Exception|\bat\s+\S+\.jsx?|line \d+/i;

describe('FormularioMovimiento', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(ahoraSimulado);
    servidor.consultas.length = 0;
    servidor.llamadasRpc.length = 0;
    servidor.responderRpc = ResponderRpc;
    servidor.fallar = { sesion: false, cuenta: false, categorias: false, movimiento: false };
    servidor.retenerCategorias = null;
    servidor.retenerMovimiento = null;
    servidor.montoLecturaPorId = null;
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
      expect(ObtenerFilas()[0]).toHaveTextContent('Mercado-1.500,00');
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
      expect(ObtenerFilas()[0]).toHaveTextContent('Sueldo+1.000,00');
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
      expect(ObtenerFilas()[0]).toHaveTextContent('Pago Realizado-1.500,50');
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
      expect(ObtenerFilas()).toHaveLength(1);
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
      expect(ObtenerFilas()[0]).toHaveTextContent('Categoría 051');

      await AbrirFormulario('Añadir Gasto');
      EscribirMonto('500');
      Guardar();

      expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument();
      expect(await screen.findByText('USD 9.500,00')).toBeInTheDocument();
      const filas = ObtenerFilas();
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

  // Al volver a Cuenta desde el formulario, Cuenta se monta de nuevo: el foco no
  // puede quedar en <body>, sino en el botón desde el que se abrió (NFR-07, AC-61).
  describe('foco al volver a Cuenta (NFR-07, AC-61)', () => {
    it.each([
      ['Añadir Gasto', mensajeGasto],
      ['Añadir Ingreso', mensajeIngreso],
    ])('tras guardar desde "%s", el foco vuelve a ese botón y "%s" se anuncia en la región viva', async (nombreBoton, mensaje) => {
      RenderizarApp();
      await EsperarCuenta();
      await AbrirFormulario(nombreBoton);
      EscribirMonto('500');
      Guardar();

      expect(await screen.findByText(mensaje)).toBeInTheDocument();
      await EsperarCuenta();
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('button', { name: nombreBoton })),
      );
      expect(screen.getByRole('status')).toHaveTextContent(mensaje);
    });

    it.each([
      ['Añadir Gasto', 'Cancelar'],
      ['Añadir Ingreso', 'Cancelar'],
      ['Añadir Gasto', 'Volver atrás'],
      ['Añadir Ingreso', 'Volver atrás'],
    ])('tras salir de "%s" con "%s", el foco queda en el botón que lo abrió', async (nombreBoton, salida) => {
      RenderizarApp();
      await EsperarCuenta();
      await AbrirFormulario(nombreBoton);

      fireEvent.click(screen.getByRole('button', { name: salida }));

      await EsperarCuenta();
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('button', { name: nombreBoton })),
      );
    });
  });

  describe('edición', () => {
    const idGasto = CrearIdMovimiento(1);
    const todasLasCategorias = [
      ...categoriasPorDefecto,
      categoriaMercado,
      categoriaTransporte,
      categoriaSueldo,
      categoriaAlquiler,
    ];

    // Saldo USD 10.000,00, que ya incluye un gasto del 17/09/2026.
    function ConfigurarGasto({ monto = '3000.00', categoria = categoriaMercado, fecha = '2026-09-17' } = {}) {
      ConfigurarServidor({
        categorias: todasLasCategorias,
        movimientos: [CrearMovimiento(1, { fecha, monto, categoria })],
      });
    }

    async function AbrirEdicionDesdeCuenta(idMovimiento = idGasto) {
      RenderizarApp();
      await EsperarCuenta();
      await AbrirEdicion(idMovimiento);
    }

    it('elegir "Editar" en un gasto de 1.500 en "Mercado" del 17/09/2026 abre el formulario con "1.500,00" sin signo, "Mercado" y 17/09/2026 (AC-02)', async () => {
      ConfigurarGasto({ monto: '1500.00' });
      await AbrirEdicionDesdeCuenta();

      expect(screen.getByRole('heading', { level: 1, name: 'Editar Movimiento' })).toBeInTheDocument();
      expect(ObtenerCampoMonto()).toHaveValue('1.500,00');
      expect(ObtenerSelectorCategoria()).toHaveDisplayValue('Mercado');
      expect(ObtenerCampoFecha()).toHaveTextContent('17/09/2026');
    });

    it('en un gasto muestra el selector "Tipo" con "Gasto" e "Ingreso" y "Gasto" seleccionado (AC-03)', async () => {
      ConfigurarGasto();
      await AbrirEdicionDesdeCuenta();

      expect(screen.getByRole('group', { name: 'Tipo' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Gasto' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Ingreso' })).not.toBeChecked();
    });

    it('en un ingreso muestra "Ingreso" seleccionado y solo las categorías de ingresos', async () => {
      ConfigurarServidor({
        categorias: todasLasCategorias,
        movimientos: [CrearMovimiento(1, { fecha: '2026-09-17', tipo: 'INGRESO', monto: '50000.00', categoria: categoriaSueldo })],
      });
      await AbrirEdicionDesdeCuenta();

      expect(screen.getByRole('radio', { name: 'Ingreso' })).toBeChecked();
      expect(ObtenerSelectorCategoria()).toHaveDisplayValue('Sueldo');
      expect(ObtenerOpcionesCategoria()).toEqual(['Pago Ingresado', 'Alquiler', 'Sueldo']);
      expect(ObtenerCampoMonto()).toHaveValue('50.000,00');
    });

    it('muestra "Guardar" y ninguna opción para eliminar el movimiento (AC-18)', async () => {
      ConfigurarGasto();
      await AbrirEdicionDesdeCuenta();

      expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('type', 'submit');
      expect(screen.queryByRole('button', { name: /eliminar|borrar/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/eliminar|borrar/i)).not.toBeInTheDocument();
    });

    it('editar a 2000, "Mercado" y 16/09/2026 un gasto de 3.000 en "Transporte" envía esos valores, muestra el éxito con el tic verde y Cuenta muestra "-2.000,00" bajo 16/09/2026 y "USD 11.000,00" (AC-04)', async () => {
      ConfigurarGasto({ categoria: categoriaTransporte });
      await AbrirEdicionDesdeCuenta();

      EscribirMonto('2000');
      ElegirCategoria('Mercado');
      ElegirFecha('2026-09-16');
      Guardar();

      expect(await screen.findByText(mensajeEdicion)).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Éxito' })).toBeInTheDocument();
      await EsperarCuenta();
      expect(LlamadasEdicion()).toEqual([
        {
          nombre: 'basp_editar_movimiento',
          parametros: {
            p_id_movimiento: idGasto,
            p_tipo: 'GASTO',
            p_monto: '2000.00',
            p_id_categoria: 'cat-mercado',
            p_fecha: '2026-09-16',
          },
        },
      ]);
      expect(await screen.findByText('USD 11.000,00')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: '16/09/2026' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 2, name: '17/09/2026' })).not.toBeInTheDocument();
      expect(ObtenerFilas().map((fila) => fila.textContent)).toEqual(['Mercado-2.000,00']);
    });

    it('cambiar el tipo a "Ingreso" sin elegir categoría envía "Pago Ingresado" y Cuenta muestra "+3.000,00" y "USD 16.000,00" (AC-05)', async () => {
      ConfigurarGasto();
      await AbrirEdicionDesdeCuenta();

      ElegirTipo('Ingreso');
      await EsperarCategorias('Pago Ingresado');
      Guardar();

      expect(await screen.findByText('USD 16.000,00')).toBeInTheDocument();
      expect(LlamadasEdicion()[0].parametros).toEqual({
        p_id_movimiento: idGasto,
        p_tipo: 'INGRESO',
        p_monto: '3000.00',
        p_id_categoria: 'cat-pago-ingresado',
        p_fecha: '2026-09-17',
      });
      expect(ObtenerFilas()[0]).toHaveTextContent('Pago Ingresado+3.000,00');
    });

    it('al seleccionar "Ingreso" la categoría pasa a "Pago Ingresado", el selector muestra solo "Pago Ingresado", "Alquiler" y "Sueldo" y el monto no cambia (AC-06, FR-07)', async () => {
      ConfigurarGasto();
      await AbrirEdicionDesdeCuenta();
      expect(ObtenerOpcionesCategoria()).toEqual(['Pago Realizado', 'Mercado', 'Transporte']);

      ElegirTipo('Ingreso');
      await EsperarCategorias('Pago Ingresado');

      expect(ObtenerSelectorCategoria()).toHaveDisplayValue('Pago Ingresado');
      expect(ObtenerOpcionesCategoria()).toEqual(['Pago Ingresado', 'Alquiler', 'Sueldo']);
      expect(ObtenerCampoMonto()).toHaveValue('3.000,00');
    });

    it('volver a "Gasto" después de "Ingreso" elige "Pago Realizado", no la categoría original (FR-08)', async () => {
      ConfigurarGasto();
      await AbrirEdicionDesdeCuenta();

      ElegirTipo('Ingreso');
      await EsperarCategorias('Pago Ingresado');
      ElegirTipo('Gasto');
      await EsperarCategorias('Pago Realizado');

      expect(ObtenerSelectorCategoria()).toHaveDisplayValue('Pago Realizado');
    });

    it('cambiar a "Ingreso" y elegir "Sueldo" envía "Sueldo" y Cuenta muestra "+3.000,00" y "USD 16.000,00" (AC-07)', async () => {
      ConfigurarGasto();
      await AbrirEdicionDesdeCuenta();

      ElegirTipo('Ingreso');
      await EsperarCategorias('Pago Ingresado');
      ElegirCategoria('Sueldo');
      Guardar();

      expect(await screen.findByText('USD 16.000,00')).toBeInTheDocument();
      expect(LlamadasEdicion()[0].parametros).toMatchObject({ p_tipo: 'INGRESO', p_id_categoria: 'cat-sueldo' });
      expect(ObtenerFilas()[0]).toHaveTextContent('Sueldo+3.000,00');
    });

    it('el calendario de un movimiento del 17/09/2026 lo muestra preseleccionado y los días posteriores a hoy deshabilitados (AC-08)', async () => {
      ConfigurarGasto();
      await AbrirEdicionDesdeCuenta();

      fireEvent.click(ObtenerCampoFecha());
      expect(document.querySelector('[data-day="2026-09-17"]')).toHaveAttribute('aria-selected', 'true');

      fireEvent.change(screen.getByRole('combobox', { name: 'Elegir el mes' }), { target: { value: '9' } });
      expect(ObtenerBotonDia('2026-10-04')).toBeDisabled();
      fireEvent.click(ObtenerBotonDia('2026-10-04'));
      expect(ObtenerCampoFecha()).toHaveTextContent('17/09/2026');
    });

    it('el 03/10/2026, en un gasto del 17/09/2026, "Fecha" muestra "17/09/2026" y el calendario de septiembre de 2026 en español desde el lunes (AC-32)', async () => {
      ConfigurarGasto();
      await AbrirEdicionDesdeCuenta();

      expect(ObtenerCampoFecha()).toHaveTextContent('17/09/2026');
      fireEvent.click(ObtenerCampoFecha());
      const calendario = screen.getByRole('grid');
      expect(calendario).toHaveAccessibleName('septiembre 2026');
      const diasSemana = [...calendario.querySelectorAll('thead th')].map((encabezado) =>
        encabezado.getAttribute('aria-label'),
      );
      expect(diasSemana[0]).toBe('lunes');
      expect(diasSemana[6]).toBe('domingo');
    });

    it('elegir 15/03/1990 envía "1990-03-15" y Cuenta muestra el grupo "15/03/1990" y "USD 10.000,00" (AC-30)', async () => {
      ConfigurarGasto();
      await AbrirEdicionDesdeCuenta();

      ElegirFechaDeOtroMes('1990-03-15');
      expect(ObtenerCampoFecha()).toHaveTextContent('15/03/1990');
      Guardar();

      expect(await screen.findByText(mensajeEdicion)).toBeInTheDocument();
      await EsperarCuenta();
      expect(await screen.findByRole('heading', { level: 2, name: '15/03/1990' })).toBeInTheDocument();
      expect(LlamadasEdicion()[0].parametros.p_fecha).toBe('1990-03-15');
      expect(screen.getByText('USD 10.000,00')).toBeInTheDocument();
    });

    it('(error E4-1) monto 0 y monto vacío no llaman a la edición, muestran "El monto debe ser mayor a 0." con "Aceptar" y Cuenta sigue con "-3.000,00" y "USD 10.000,00" (AC-09)', async () => {
      ConfigurarGasto();
      await AbrirEdicionDesdeCuenta();

      for (const monto of ['0', '']) {
        EscribirMonto(monto);
        Guardar();

        const dialogo = await screen.findByRole('alertdialog');
        expect(dialogo).toHaveTextContent(mensajeMayorACero);
        fireEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }));
        expect(document.activeElement).toBe(ObtenerCampoMonto());
      }
      expect(LlamadasEdicion()).toHaveLength(0);

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      await EsperarCuenta();
      expect(await screen.findByText('USD 10.000,00')).toBeInTheDocument();
      expect(ObtenerFilas()[0]).toHaveTextContent('Mercado-3.000,00');
    });

    it('(error E4-2) 1.000.000.000.000,00 muestra "El monto máximo es 999.999.999.999,99." y no se envía (AC-10)', async () => {
      ConfigurarGasto();
      await AbrirEdicionDesdeCuenta();

      EscribirMonto('1000000000000,00');
      Guardar();

      expect(await screen.findByRole('alertdialog')).toHaveTextContent(mensajeMaximo);
      fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));
      expect(LlamadasEdicion()).toHaveLength(0);

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      await EsperarCuenta();
      expect(await screen.findByText('USD 10.000,00')).toBeInTheDocument();
      expect(ObtenerFilas()[0]).toHaveTextContent('Mercado-3.000,00');
    });

    it.each([
      ['-50', '50'],
      ['abc50', '50'],
      ['10,555', '10,55'],
      ['1500000', '1.500.000'],
    ])('en el monto de la edición, escribir "%s" muestra "%s" (AC-11)', async (texto, esperado) => {
      ConfigurarGasto();
      await AbrirEdicionDesdeCuenta();

      EscribirMonto('');
      EscribirMonto(texto);

      expect(ObtenerCampoMonto()).toHaveValue(esperado);
    });

    it('pegar "$ 1.500,50" en el monto vacío y después "abc" muestra "1.500,50" en ambos casos (AC-31)', async () => {
      ConfigurarGasto();
      await AbrirEdicionDesdeCuenta();

      EscribirMonto('');
      Pegar('$ 1.500,50');
      expect(ObtenerCampoMonto()).toHaveValue('1.500,50');
      Pegar('abc');
      expect(ObtenerCampoMonto()).toHaveValue('1.500,50');
    });

    it('después de editar el monto de "Café", "Mercado" (dado de alta después) sigue antes que "Café" en el grupo 01/10/2026 (AC-12)', async () => {
      const categoriaCafe = CrearCategoria('cat-cafe', 'Café', 'GASTO');
      ConfigurarServidor({
        categorias: [...todasLasCategorias, categoriaCafe],
        movimientos: [
          CrearMovimiento(2, { fecha: '2026-10-01', monto: '500.00', categoria: categoriaMercado, creadoEn: '2026-10-01T15:00:00+00:00' }),
          CrearMovimiento(1, { fecha: '2026-10-01', monto: '800.00', categoria: categoriaCafe, creadoEn: '2026-10-01T09:00:00+00:00' }),
        ],
      });
      await AbrirEdicionDesdeCuenta(CrearIdMovimiento(1));

      EscribirMonto('900');
      Guardar();

      expect(await screen.findByText(mensajeEdicion)).toBeInTheDocument();
      await waitFor(() => expect(ObtenerFilas()[1]).toHaveTextContent('Café-900,00'));
      expect(ObtenerFilas().map((fila) => fila.textContent)).toEqual(['Mercado-500,00', 'Café-900,00']);
      expect(screen.getAllByRole('heading', { level: 2 }).map((encabezado) => encabezado.textContent)).toEqual([
        '01/10/2026',
      ]);
    });

    it('"Cancelar" con el monto cambiado a 2000 no llama a la edición y Cuenta muestra "-3.000,00" y "USD 10.000,00" (AC-15)', async () => {
      ConfigurarGasto();
      await AbrirEdicionDesdeCuenta();

      EscribirMonto('2000');
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      await EsperarCuenta();
      expect(screen.queryByRole('heading', { level: 1, name: 'Editar Movimiento' })).not.toBeInTheDocument();
      expect(await screen.findByText('USD 10.000,00')).toBeInTheDocument();
      expect(ObtenerFilas()[0]).toHaveTextContent('Mercado-3.000,00');
      expect(LlamadasEdicion()).toHaveLength(0);
    });

    it('la flecha con el monto cambiado vuelve a Cuenta sin guardar, con "-3.000,00" y "USD 10.000,00" (AC-16)', async () => {
      ConfigurarGasto();
      await AbrirEdicionDesdeCuenta();

      EscribirMonto('2000');
      fireEvent.click(screen.getByRole('button', { name: 'Volver atrás' }));

      await EsperarCuenta();
      expect(await screen.findByText('USD 10.000,00')).toBeInTheDocument();
      expect(ObtenerFilas()[0]).toHaveTextContent('Mercado-3.000,00');
      expect(LlamadasEdicion()).toHaveLength(0);
    });

    it.each([['Cancelar'], ['Volver atrás']])(
      'después de descartar con "%s" el cambio a 2000, reabrir muestra "3.000,00" y "Mercado" (AC-17)',
      async (salida) => {
        ConfigurarGasto();
        await AbrirEdicionDesdeCuenta();
        EscribirMonto('2000');
        ElegirCategoria('Transporte');

        fireEvent.click(screen.getByRole('button', { name: salida }));
        await EsperarCuenta();
        await AbrirEdicion(idGasto);

        expect(ObtenerCampoMonto()).toHaveValue('3.000,00');
        expect(ObtenerSelectorCategoria()).toHaveDisplayValue('Mercado');
      },
    );

    it('(error E4-6) dos clics seguidos en "Guardar" llaman una sola vez a la edición; mientras procesa dice "Guardando…" y no se puede editar ni cerrar; Cuenta muestra "USD 11.000,00" (AC-19)', async () => {
      ConfigurarGasto();
      let liberarEdicion;
      servidor.responderRpc = (parametros, nombre) =>
        new Promise((resolver) => {
          liberarEdicion = () => resolver(ResponderRpc(parametros, nombre));
        });
      await AbrirEdicionDesdeCuenta();
      EscribirMonto('2000');

      const botonGuardar = screen.getByRole('button', { name: 'Guardar' });
      fireEvent.click(botonGuardar);
      fireEvent.click(botonGuardar);
      fireEvent.submit(botonGuardar.closest('form'));
      await waitFor(() => expect(liberarEdicion).toBeTypeOf('function'));

      const botonGuardando = screen.getByRole('button', { name: 'Guardando…' });
      expect(botonGuardando).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(botonGuardando);
      expect(LlamadasEdicion()).toHaveLength(1);
      expect(ObtenerCampoMonto()).toBeDisabled();
      expect(screen.getByRole('radio', { name: 'Ingreso' })).toBeDisabled();
      expect(ObtenerSelectorCategoria()).toBeDisabled();
      expect(ObtenerCampoFecha()).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Volver atrás' })).toBeDisabled();
      expect(document.activeElement).toBe(botonGuardando);

      liberarEdicion();
      expect(await screen.findByText('USD 11.000,00')).toBeInTheDocument();
      expect(LlamadasEdicion()).toHaveLength(1);
    });

    it('(error E4-3) si la edición falla muestra "No se pudo guardar el movimiento. Vuelva a intentarlo.", conserva "2.000" y Cuenta sigue con "-3.000,00" y "USD 10.000,00", también al cambiar a ingreso (AC-21, AC-25)', async () => {
      ConfigurarGasto();
      servidor.responderRpc = () => ({
        data: null,
        error: { code: 'BA500', message: 'Falla simulada en EDITAR_MOVIMIENTO', details: null, hint: null },
      });
      await AbrirEdicionDesdeCuenta();

      EscribirMonto('2000');
      Guardar();
      let dialogo = await screen.findByRole('alertdialog');
      expect(dialogo).toHaveTextContent(mensajeErrorGuardar);
      expect(document.body.textContent).not.toMatch(expresionDetalleTecnico);
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }));
      expect(screen.getByRole('heading', { level: 1, name: 'Editar Movimiento' })).toBeInTheDocument();
      expect(ObtenerCampoMonto()).toHaveValue('2.000');
      expect(ObtenerCampoMonto()).toBeEnabled();

      ElegirTipo('Ingreso');
      await EsperarCategorias('Pago Ingresado');
      Guardar();
      dialogo = await screen.findByRole('alertdialog');
      expect(dialogo).toHaveTextContent(mensajeErrorGuardar);
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }));
      expect(screen.getByRole('radio', { name: 'Ingreso' })).toBeChecked();

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      await EsperarCuenta();
      expect(await screen.findByText('USD 10.000,00')).toBeInTheDocument();
      expect(ObtenerFilas()[0]).toHaveTextContent('Mercado-3.000,00');
    });

    it('(error E4-4) si no se puede leer el movimiento muestra "No se pudieron cargar sus movimientos. Vuelva a intentarlo." y "Aceptar" vuelve a Cuenta', async () => {
      ConfigurarGasto();
      servidor.fallar.movimiento = true;
      RenderizarApp();
      await EsperarCuenta();
      await waitFor(() => expect(ObtenerFila(idGasto)).toBeDefined());
      fireEvent.click(ObtenerFila(idGasto));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Editar' }));

      const dialogo = await screen.findByRole('alertdialog');
      expect(dialogo).toHaveTextContent(mensajeErrorCarga);
      expect(document.body.textContent).not.toMatch(expresionDetalleTecnico);
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();

      fireEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }));
      await EsperarCuenta();
      expect(screen.queryByRole('heading', { level: 1, name: 'Editar Movimiento' })).not.toBeInTheDocument();
      expect(LlamadasEdicion()).toHaveLength(0);
    });

    it('(error E4-4) si la lectura trae un monto con formato inesperado muestra el error de carga y "Aceptar" vuelve a Cuenta', async () => {
      ConfigurarGasto();
      servidor.montoLecturaPorId = '1.500,00';
      RenderizarApp(`/movimientos/${idGasto}/editar`);

      const dialogo = await screen.findByRole('alertdialog');
      expect(dialogo).toHaveTextContent(mensajeErrorCarga);
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }));

      await EsperarCuenta();
      expect(screen.queryByRole('heading', { level: 1, name: 'Editar Movimiento' })).not.toBeInTheDocument();
    });

    it.each([
      ['un id inexistente', `/movimientos/${CrearIdMovimiento(99)}/editar`],
      ['un id mal formado', '/movimientos/abc/editar'],
    ])('(error E4-4) con %s en la ruta muestra el error de carga y "Aceptar" vuelve a Cuenta', async (_, ruta) => {
      ConfigurarGasto();
      RenderizarApp(ruta);

      const dialogo = await screen.findByRole('alertdialog');
      expect(dialogo).toHaveTextContent(mensajeErrorCarga);
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }));

      await EsperarCuenta();
      expect(await screen.findByText('USD 10.000,00')).toBeInTheDocument();
    });

    it('(error E4-5) si falla la carga de categorías muestra el error de carga y "Guardar" sigue deshabilitado; "Aceptar" reintenta', async () => {
      ConfigurarGasto();
      servidor.fallar.categorias = true;
      RenderizarApp(`/movimientos/${idGasto}/editar`);

      const dialogo = await screen.findByRole('alertdialog');
      expect(dialogo).toHaveTextContent(mensajeErrorCarga);
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();

      servidor.fallar.categorias = false;
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }));
      await EsperarEdicionCargada();
      expect(ObtenerSelectorCategoria()).toHaveDisplayValue('Mercado');
    });

    it('"Guardar" y los campos quedan deshabilitados hasta que el movimiento y las categorías están cargados', async () => {
      ConfigurarGasto();
      let liberarMovimiento;
      servidor.retenerMovimiento = new Promise((resolver) => {
        liberarMovimiento = resolver;
      });
      let liberarCategorias;
      servidor.retenerCategorias = new Promise((resolver) => {
        liberarCategorias = resolver;
      });
      RenderizarApp(`/movimientos/${idGasto}/editar`);
      await screen.findByRole('heading', { level: 1, name: 'Editar Movimiento' });

      expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
      expect(ObtenerCampoMonto()).toBeDisabled();
      Guardar();

      await act(async () => {
        liberarMovimiento();
      });
      expect(await screen.findByDisplayValue('3.000,00')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();

      await act(async () => {
        liberarCategorias();
      });
      await EsperarEdicionCargada();
      expect(ObtenerSelectorCategoria()).toHaveDisplayValue('Mercado');
      expect(LlamadasEdicion()).toHaveLength(0);
    });

    it.each([['guardar'], ['Cancelar'], ['Volver atrás']])(
      'al volver a Cuenta después de %s, el foco queda en la fila del movimiento editado (D5)',
      async (salida) => {
        ConfigurarServidor({
          categorias: todasLasCategorias,
          movimientos: [
            CrearMovimiento(2, { fecha: '2026-10-01', monto: '500.00', categoria: categoriaMercado }),
            CrearMovimiento(1, { fecha: '2026-09-17', monto: '3000.00', categoria: categoriaMercado }),
          ],
        });
        await AbrirEdicionDesdeCuenta(idGasto);

        if (salida === 'guardar') {
          EscribirMonto('2000');
          Guardar();
          await screen.findByText(mensajeEdicion);
        } else {
          fireEvent.click(screen.getByRole('button', { name: salida }));
        }

        await EsperarCuenta();
        await waitFor(() => expect(document.activeElement).toBe(ObtenerFila(idGasto)));
      },
    );

    it('con solo el teclado se abre el menú, se elige "Editar", se cambian el tipo, la categoría, la fecha y el monto y se guarda (AC-27)', async () => {
      const usuario = userEvent.setup();
      ConfigurarGasto();
      RenderizarApp();
      await EsperarCuenta();
      await waitFor(() => expect(ObtenerFila(idGasto)).toBeDefined());

      // Tab hasta la fila: "Añadir Gasto", "Añadir Ingreso" y la fila.
      await usuario.tab();
      await usuario.tab();
      await usuario.tab();
      expect(document.activeElement).toBe(ObtenerFila(idGasto));

      // Espacio abre el menú y Escape lo cierra; Enter lo abre (el foco ya
      // está en "Editar", la primera opción) y Enter lo elige.
      await usuario.keyboard(' ');
      expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Editar' }));
      await usuario.keyboard('{Escape}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(document.activeElement).toBe(ObtenerFila(idGasto));
      await usuario.keyboard('{Enter}');
      expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Editar' }));
      await usuario.keyboard('{Enter}');
      await EsperarEdicionCargada();

      // "Volver atrás" y el tipo: la flecha derecha elige "Ingreso".
      await usuario.tab();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Volver atrás' }));
      await usuario.tab();
      expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Gasto' }));
      await usuario.keyboard('{ArrowRight}');
      expect(screen.getByRole('radio', { name: 'Ingreso' })).toBeChecked();
      await EsperarCategorias('Pago Ingresado');
      expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Ingreso' }));

      // Monto: se borra y se escribe 2000.
      await usuario.tab();
      expect(document.activeElement).toBe(ObtenerCampoMonto());
      await usuario.keyboard('{Backspace>8/}2000');
      expect(ObtenerCampoMonto()).toHaveValue('2.000');

      // Categoría: jsdom no cambia un <select> nativo con las flechas, así que
      // se simula el cambio con el foco en el combo (el navegador real lo
      // prueba Playwright en el Block 5).
      await usuario.tab();
      expect(document.activeElement).toBe(ObtenerSelectorCategoria());
      ElegirCategoria('Sueldo');

      // Fecha: Enter abre el calendario en el día elegido, la flecha izquierda
      // va al 16 y Enter lo elige.
      await usuario.tab();
      expect(document.activeElement).toBe(ObtenerCampoFecha());
      await usuario.keyboard('{Enter}');
      await waitFor(() =>
        expect(document.activeElement).toBe(ObtenerBotonDia('2026-09-17')),
      );
      await usuario.keyboard('{ArrowLeft}');
      expect(document.activeElement).toBe(ObtenerBotonDia('2026-09-16'));
      await usuario.keyboard('{Enter}');
      expect(ObtenerCampoFecha()).toHaveTextContent('16/09/2026');
      expect(document.activeElement).toBe(ObtenerCampoFecha());

      // "Guardar" con Enter.
      await usuario.tab();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Guardar' }));
      await usuario.keyboard('{Enter}');

      expect(await screen.findByText(mensajeEdicion)).toBeInTheDocument();
      await EsperarCuenta();
      expect(LlamadasEdicion()[0].parametros).toEqual({
        p_id_movimiento: idGasto,
        p_tipo: 'INGRESO',
        p_monto: '2000.00',
        p_id_categoria: 'cat-sueldo',
        p_fecha: '2026-09-16',
      });
      expect(await screen.findByText('USD 15.000,00')).toBeInTheDocument();
      await waitFor(() => expect(document.activeElement).toBe(ObtenerFila(idGasto)));
    });
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
    servidor.responderRpc = ResponderRpc;
    servidor.fallar = { sesion: false, cuenta: false, categorias: false, movimiento: false };
    servidor.retenerCategorias = null;
    servidor.retenerMovimiento = null;
    servidor.montoLecturaPorId = null;
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

  it('con 120 movimientos y la página 2 abierta, editar y guardar vuelve a la página 1 con "Página 1 de 3" y el mensaje, que se cierra a los 3 segundos (AC-20)', async () => {
    ConfigurarServidor({ movimientos: CrearMovimientos(120) });
    const idMovimientoPagina2 = CrearIdMovimiento(60);
    RenderizarApp();
    await EsperarHasta(() => screen.queryByText('Página 1 de 3') !== null);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await EsperarHasta(() => screen.queryByText('Página 2 de 3') !== null);

    const fila = ObtenerFila(idMovimientoPagina2);
    expect(fila).toHaveTextContent('Categoría 060');
    fireEvent.click(fila);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar' }));
    await EsperarHasta(
      () => screen.queryByRole('button', { name: 'Guardar' })?.disabled === false,
    );
    expect(ObtenerCampoMonto()).toHaveValue('10,00');
    EscribirMonto('20');
    Guardar();

    await EsperarHasta(() => EstaEnCuenta() && screen.queryByText('Página 1 de 3') !== null);
    expect(screen.getByText(mensajeEdicion)).toBeInTheDocument();
    expect(LlamadasEdicion()).toHaveLength(1);
    const consultasLista = servidor.consultas.filter(
      (consulta) => consulta.tabla === 'bav_movimientos' && !consulta.unico,
    );
    expect(consultasLista.at(-1).range).toEqual([0, 49]);

    await AvanzarTiempo(2900);
    expect(screen.getByText(mensajeEdicion)).toBeInTheDocument();
    await AvanzarTiempo(200);
    expect(screen.queryByText(mensajeEdicion)).not.toBeInTheDocument();
  });
});
