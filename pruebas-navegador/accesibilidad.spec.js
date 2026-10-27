// Accesibilidad (NFR-07, NFR-08): uso solo con teclado y foco visible (AC-61), y contraste de
// textos e íconos medido con axe-core (AC-62). Edición (FEAT-001b NFR-04, NFR-06): el menú de la
// fila y el formulario de edición solo con el teclado (AC-27) y su contraste con axe-core (AC-29).

import AxeBuilder from '@axe-core/playwright';
import {
  CargarCategoria,
  CargarMovimientos,
  CrearClienteAdministrador,
  CrearMovimientosAnteriores,
  ObtenerFechaLocal,
  ObtenerFilaPorId,
  ObtenerFilas,
  expect,
  test,
} from './utilidades/fixtures.js';

test.use({ nombreUsuario: 'accesibilidad' });

// --- Teclado y foco (AC-61) ---

// El elemento con foco debe tener un contorno visible. Las listas de mes y año del calendario son
// <select> transparentes: su contorno se dibuja en la etiqueta que tienen al lado.
async function VerificarFocoVisible(pagina, paso) {
  const foco = await pagina.evaluate(() => {
    const elemento = document.activeElement;
    if (!elemento || elemento === document.body) {
      return { visible: false, elemento: 'body' };
    }
    const dibujado = elemento.matches('.rdp-dropdown')
      ? elemento.parentElement.querySelector('.rdp-caption_label')
      : elemento;
    const estilo = getComputedStyle(dibujado);
    const anchoContorno = Number.parseFloat(estilo.outlineWidth);
    return {
      visible:
        elemento.matches(':focus-visible') && estilo.outlineStyle !== 'none' && anchoContorno >= 2,
      elemento: elemento.outerHTML.slice(0, 120),
      contorno: `${estilo.outlineStyle} ${estilo.outlineWidth} ${estilo.outlineColor}`,
    };
  });
  expect(foco.visible, `${paso}: ${JSON.stringify(foco)}`).toBe(true);
}

async function Presionar(pagina, tecla, paso) {
  await pagina.keyboard.press(tecla);
  await VerificarFocoVisible(pagina, `${paso} (${tecla})`);
}

// Avanza con Tab (o Shift+Tab) hasta que el elemento tenga el foco, verificando el foco visible en
// cada paso.
async function TabularHasta(pagina, elemento, { atras = false, maximo = 10 } = {}) {
  for (let paso = 0; paso < maximo; paso += 1) {
    if (await elemento.evaluate((nodo) => nodo === document.activeElement)) {
      return;
    }
    await Presionar(pagina, atras ? 'Shift+Tab' : 'Tab', `hacia ${await elemento.textContent()}`);
  }
  await expect(elemento).toBeFocused();
}

async function EsperarFocoVisibleEn(pagina, elemento, paso) {
  await expect(elemento).toBeFocused();
  await VerificarFocoVisible(pagina, paso);
}

// Pasos de Tab para recorrer una página entera de la lista: 50 filas más los botones de Cuenta.
const maximoTabsPagina = 60;

function FormatearFechaPantalla(textoFecha) {
  const [anio, mes, dia] = textoFecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

test('solo con el teclado se pagina y se registran un gasto y un ingreso, con foco visible en cada paso y los íconos con texto alternativo (AC-61)', async ({
  paginaConUsuario: pagina,
  usuario,
}) => {
  test.setTimeout(120_000);
  await CargarCategoria(usuario.idCuenta, 'Mercado', 'GASTO');
  await CargarMovimientos(usuario.idCuenta, [
    { tipo: 'INGRESO', monto: '10000.00', fecha: '2026-01-01' },
    ...CrearMovimientosAnteriores(120),
  ]);
  const hoy = ObtenerFechaLocal(0);
  const ayer = ObtenerFechaLocal(-1);

  await pagina.goto('/');
  await expect(pagina.getByText('USD 10.000,00', { exact: true })).toBeVisible();
  const botonGasto = pagina.getByRole('button', { name: 'Añadir Gasto' });
  const botonIngreso = pagina.getByRole('button', { name: 'Añadir Ingreso' });

  // Paginación: "Siguiente" conserva el foco mientras carga y después. En la última página
  // "Siguiente" se deshabilita y el foco pasa a "Anterior"; de vuelta en la primera, "Anterior"
  // se deshabilita y el foco pasa a "Siguiente".
  const botonAnterior = pagina.getByRole('button', { name: 'Anterior' });
  const botonSiguiente = pagina.getByRole('button', { name: 'Siguiente' });
  // Las 50 filas de la página son botones (FEAT-001b FR-01): Tab pasa por cada una.
  await TabularHasta(pagina, botonSiguiente, { maximo: maximoTabsPagina });
  await Presionar(pagina, 'Enter', 'Siguiente');
  await expect(pagina.getByText('Página 2 de 3')).toBeVisible();
  await EsperarFocoVisibleEn(pagina, botonSiguiente, 'página 2');
  await pagina.keyboard.press('Enter');
  await expect(pagina.getByText('Página 3 de 3')).toBeVisible();
  await expect(botonSiguiente).toBeDisabled();
  await EsperarFocoVisibleEn(pagina, botonAnterior, 'página 3 (última)');
  await pagina.keyboard.press('Enter');
  await expect(pagina.getByText('Página 2 de 3')).toBeVisible();
  await EsperarFocoVisibleEn(pagina, botonAnterior, 'de vuelta en la página 2');
  await pagina.keyboard.press('Enter');
  await expect(pagina.getByText('Página 1 de 3')).toBeVisible();
  await expect(botonAnterior).toBeDisabled();
  await EsperarFocoVisibleEn(pagina, botonSiguiente, 'de vuelta en la página 1');

  // Gasto: categoría con el selector y fecha con el calendario.
  await TabularHasta(pagina, botonGasto, { atras: true, maximo: maximoTabsPagina });
  await pagina.keyboard.press('Enter');
  await expect(pagina.getByRole('heading', { level: 1, name: 'Añadir Gasto' })).toBeVisible();
  const flecha = pagina.getByRole('button', { name: 'Volver atrás' });
  await expect(flecha).toHaveAccessibleName('Volver atrás');
  await TabularHasta(pagina, flecha);
  const campoMonto = pagina.getByLabel('Monto');
  await TabularHasta(pagina, campoMonto);
  await pagina.keyboard.type('150');
  await expect(campoMonto).toHaveValue('150');
  const selectorCategoria = pagina.getByLabel('Categoría');
  await expect(selectorCategoria).toBeEnabled();
  await TabularHasta(pagina, selectorCategoria);
  await Presionar(pagina, 'ArrowDown', 'categoría');
  await expect(selectorCategoria.locator('option:checked')).toHaveText('Mercado');
  const campoFecha = pagina.getByLabel('Fecha');
  await TabularHasta(pagina, campoFecha);
  await Presionar(pagina, 'Enter', 'abrir el calendario');
  await expect(pagina.getByRole('dialog', { name: 'Calendario' })).toBeVisible();
  await Presionar(pagina, 'ArrowLeft', 'día anterior');
  await pagina.keyboard.press('Enter');
  await expect(pagina.getByRole('dialog', { name: 'Calendario' })).toBeHidden();
  await EsperarFocoVisibleEn(pagina, campoFecha, 'campo Fecha tras elegir el día');
  await expect(campoFecha).toHaveText(FormatearFechaPantalla(ayer));
  await TabularHasta(pagina, pagina.getByRole('button', { name: 'Guardar' }));
  await pagina.keyboard.press('Enter');

  await expect(pagina.getByText('Gasto registrado con éxito.')).toBeVisible();
  await expect(pagina.getByRole('img', { name: 'Éxito' })).toBeVisible();
  await expect(pagina.getByText('USD 9.850,00', { exact: true })).toBeVisible();
  await EsperarFocoVisibleEn(pagina, botonGasto, 'Cuenta tras guardar el gasto');

  // Ingreso: se guarda con Enter desde "Monto".
  await TabularHasta(pagina, botonIngreso);
  await pagina.keyboard.press('Enter');
  await expect(pagina.getByRole('heading', { level: 1, name: 'Añadir Ingreso' })).toBeVisible();
  await expect(pagina.getByLabel('Categoría')).toBeEnabled();
  await TabularHasta(pagina, campoMonto);
  await pagina.keyboard.type('200');
  await pagina.keyboard.press('Enter');

  await expect(pagina.getByText('Ingreso registrado con éxito.')).toBeVisible();
  await expect(pagina.getByText('USD 10.050,00', { exact: true })).toBeVisible();
  await EsperarFocoVisibleEn(pagina, botonIngreso, 'Cuenta tras guardar el ingreso');
  await expect(ObtenerFilas(pagina).nth(0)).toHaveText('Pago Ingresado+200,00');
  const grupoAyer = pagina.locator('.grupo-movimientos').filter({
    has: pagina.getByRole('heading', { level: 2, name: FormatearFechaPantalla(ayer) }),
  });
  await expect(ObtenerFilas(grupoAyer).first()).toHaveText('Mercado-150,00');
  await expect(
    pagina.getByRole('heading', { level: 2, name: FormatearFechaPantalla(hoy) }),
  ).toBeVisible();

  // Mensaje de error: "Aceptar" recibe el foco, Tab no lo saca y al aceptar vuelve a "Monto".
  await TabularHasta(pagina, botonGasto, { atras: true });
  await pagina.keyboard.press('Enter');
  await expect(pagina.getByLabel('Categoría')).toBeEnabled();
  await TabularHasta(pagina, campoMonto);
  await pagina.keyboard.press('Enter');
  const dialogo = pagina.getByRole('alertdialog');
  await expect(dialogo).toContainText('El monto debe ser mayor a 0.');
  await expect(dialogo.getByRole('img', { name: 'Error' })).toBeVisible();
  const botonAceptar = dialogo.getByRole('button', { name: 'Aceptar' });
  await EsperarFocoVisibleEn(pagina, botonAceptar, 'Aceptar');
  await Presionar(pagina, 'Tab', 'Tab dentro del error');
  await expect(botonAceptar).toBeFocused();
  await pagina.keyboard.press('Enter');
  await expect(dialogo).toBeHidden();
  await EsperarFocoVisibleEn(pagina, campoMonto, 'Monto tras aceptar el error');

  // La flecha vuelve a Cuenta con el foco en el botón que abrió el formulario.
  await TabularHasta(pagina, flecha, { atras: true });
  await pagina.keyboard.press('Enter');
  await expect(pagina.getByRole('heading', { name: 'Mi Cuenta (USD)' })).toBeVisible();
  await EsperarFocoVisibleEn(pagina, botonGasto, 'Cuenta tras la flecha');
});

// --- Edición solo con el teclado (FEAT-001b AC-27) ---

// Presiona la flecha hacia abajo en el selector nativo (con el foco, sin abrir la lista) hasta que
// quede elegida la opción, verificando el foco visible en cada paso.
async function ElegirOpcionConFlechas(pagina, selector, textoOpcion, maximo = 5) {
  const opcionElegida = selector.locator('option:checked');
  for (let paso = 0; paso < maximo; paso += 1) {
    if ((await opcionElegida.textContent()) === textoOpcion) {
      return;
    }
    await Presionar(pagina, 'ArrowDown', `categoría hacia ${textoOpcion}`);
  }
  await expect(opcionElegida).toHaveText(textoOpcion);
}

test('solo con el teclado se abre el menú de una fila, se elige "Editar", se cambian el tipo, la categoría, la fecha y el monto y se guarda, con foco visible en cada paso (AC-27)', async ({
  paginaConUsuario: pagina,
  usuario,
}) => {
  test.setTimeout(120_000);
  const idSueldo = await CargarCategoria(usuario.idCuenta, 'Sueldo', 'INGRESO');
  const fechaGasto = ObtenerFechaLocal(-2);
  const fechaNueva = ObtenerFechaLocal(-3);
  await CargarMovimientos(usuario.idCuenta, [
    { tipo: 'INGRESO', monto: '10000.00', fecha: '2026-01-01' },
    { tipo: 'GASTO', monto: '3000.00', fecha: fechaGasto },
  ]);

  await pagina.goto('/');
  await expect(pagina.getByText('USD 7.000,00', { exact: true })).toBeVisible();
  const filaGasto = ObtenerFilas(pagina).first();
  await expect(filaGasto).toHaveText('Pago Realizado-3.000,00');
  const idMovimiento = await filaGasto.getAttribute('data-id-movimiento');
  const filaEditada = ObtenerFilaPorId(pagina, idMovimiento);

  // Menú de la fila: Enter lo abre con el foco en "Editar", Escape lo cierra y vuelve a la fila,
  // y la flecha hacia abajo también lo abre.
  await TabularHasta(pagina, filaGasto);
  await Presionar(pagina, 'Enter', 'abrir el menú de la fila');
  const menu = pagina.getByRole('menu');
  await expect(menu).toBeVisible();
  const opcionEditar = menu.getByRole('menuitem', { name: 'Editar' });
  await EsperarFocoVisibleEn(pagina, opcionEditar, 'Editar al abrir el menú con Enter');
  await Presionar(pagina, 'Escape', 'cerrar el menú');
  await expect(menu).toBeHidden();
  await EsperarFocoVisibleEn(pagina, filaGasto, 'fila tras cerrar el menú con Escape');
  await Presionar(pagina, 'ArrowDown', 'abrir el menú con la flecha');
  await EsperarFocoVisibleEn(pagina, opcionEditar, 'Editar al abrir el menú con la flecha');
  await pagina.keyboard.press('Enter');

  await expect(pagina.getByRole('heading', { level: 1, name: 'Editar Movimiento' })).toBeVisible();
  const selectorCategoria = pagina.getByLabel('Categoría');
  await expect(selectorCategoria).toBeEnabled();
  await expect(selectorCategoria.locator('option:checked')).toHaveText('Pago Realizado');

  // Tipo: radios nativos; la flecha elige "Ingreso" y la categoría pasa a "Pago Ingresado".
  const radioGasto = pagina.getByRole('radio', { name: 'Gasto', exact: true });
  const radioIngreso = pagina.getByRole('radio', { name: 'Ingreso', exact: true });
  await expect(radioGasto).toBeChecked();
  await TabularHasta(pagina, radioGasto);
  await Presionar(pagina, 'ArrowRight', 'tipo Ingreso');
  await expect(radioIngreso).toBeChecked();
  await EsperarFocoVisibleEn(pagina, radioIngreso, 'tipo Ingreso elegido');
  await expect(selectorCategoria).toBeEnabled();
  await expect(selectorCategoria.locator('option:checked')).toHaveText('Pago Ingresado');

  // Monto: Tab hasta el campo, se selecciona todo y se escribe el nuevo.
  const campoMonto = pagina.getByLabel('Monto');
  await expect(campoMonto).toHaveValue('3.000,00');
  await TabularHasta(pagina, campoMonto);
  await Presionar(pagina, 'Control+A', 'seleccionar el monto');
  await pagina.keyboard.type('2500');
  await expect(campoMonto).toHaveValue('2.500');

  // Categoría: el selector nativo con las flechas.
  await TabularHasta(pagina, selectorCategoria);
  await ElegirOpcionConFlechas(pagina, selectorCategoria, 'Sueldo');

  // Fecha: el calendario se abre con el día del movimiento y la flecha elige el anterior.
  const campoFecha = pagina.getByLabel('Fecha');
  await expect(campoFecha).toHaveText(FormatearFechaPantalla(fechaGasto));
  await TabularHasta(pagina, campoFecha);
  await Presionar(pagina, 'Enter', 'abrir el calendario');
  const calendario = pagina.getByRole('dialog', { name: 'Calendario' });
  await expect(calendario).toBeVisible();
  await Presionar(pagina, 'ArrowLeft', 'día anterior');
  await pagina.keyboard.press('Enter');
  await expect(calendario).toBeHidden();
  await EsperarFocoVisibleEn(pagina, campoFecha, 'campo Fecha tras elegir el día');
  await expect(campoFecha).toHaveText(FormatearFechaPantalla(fechaNueva));

  await TabularHasta(pagina, pagina.getByRole('button', { name: 'Guardar' }));
  await pagina.keyboard.press('Enter');

  // Vuelta a Cuenta con el foco visible en la fila editada (D5), ahora un ingreso de 2.500,00.
  await expect(pagina.getByText('Movimiento actualizado con éxito.')).toBeVisible();
  await expect(pagina.getByRole('img', { name: 'Éxito' })).toBeVisible();
  await expect(pagina.getByText('USD 12.500,00', { exact: true })).toBeVisible();
  await expect(filaEditada).toHaveText('Sueldo+2.500,00');
  const grupoNuevo = pagina.locator('.grupo-movimientos').filter({
    has: pagina.getByRole('heading', { level: 2, name: FormatearFechaPantalla(fechaNueva) }),
  });
  await expect(ObtenerFilas(grupoNuevo)).toHaveText(['Sueldo+2.500,00']);
  await EsperarFocoVisibleEn(pagina, filaEditada, 'fila editada tras guardar');

  const { data, error } = await CrearClienteAdministrador()
    .from('bat_movimientos')
    .select('tipo, monto::text, fecha, id_categoria')
    .eq('id', idMovimiento)
    .single();
  expect(error).toBeNull();
  expect(data).toEqual({ tipo: 'INGRESO', monto: '2500.00', fecha: fechaNueva, id_categoria: idSueldo });
});

// MenuMovimiento cierra el menú ante un clic afuera y devuelve el foco a la fila. Con un clic en
// una zona no enfocable, el navegador mueve el foco al documento después del pointerdown: esta
// prueba verifica en un navegador real que el foco no se pierde.
test('un clic afuera del menú, en una zona no enfocable, lo cierra y deja el foco en la fila', async ({
  paginaConUsuario: pagina,
  usuario,
}) => {
  await CargarMovimientos(usuario.idCuenta, [
    { tipo: 'INGRESO', monto: '10000.00', fecha: '2026-01-01' },
    { tipo: 'GASTO', monto: '3000.00', fecha: ObtenerFechaLocal(-2) },
  ]);
  await pagina.goto('/');
  await expect(pagina.getByText('USD 7.000,00', { exact: true })).toBeVisible();
  const fila = ObtenerFilas(pagina).first();
  await fila.click();
  const menu = pagina.getByRole('menu');
  await expect(menu.getByRole('menuitem', { name: 'Editar' })).toBeFocused();

  await pagina.getByRole('heading', { name: 'Mi Cuenta (USD)' }).click();
  await expect(menu).toBeHidden();
  const elementoConFoco = await pagina.evaluate(() => document.activeElement?.tagName);
  await expect(fila, `foco tras el clic afuera: ${elementoConFoco}`).toBeFocused();
});

// --- Contraste (AC-62) ---

function ObtenerLuminancia(colorCss) {
  const [r, g, b] = colorCss.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
  const [rl, gl, bl] = [r, g, b].map((canal) => {
    const c = canal / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function CalcularContraste(colorA, colorB) {
  const [claro, oscuro] = [ObtenerLuminancia(colorA), ObtenerLuminancia(colorB)].sort((a, b) => b - a);
  return (claro + 0.05) / (oscuro + 0.05);
}

// axe-core 4.14 no tiene una regla de contraste de elementos no textuales: el 3:1 de los íconos
// de tic y de cruz se mide con el color del trazo contra el fondo del mensaje.
async function MedirContrasteIcono(icono) {
  const colores = await icono.evaluate((svg) => ({
    trazo: getComputedStyle(svg).stroke,
    fondo: getComputedStyle(svg.closest('.mensaje')).backgroundColor,
  }));
  return { ...colores, contraste: CalcularContraste(colores.trazo, colores.fondo) };
}

async function AnalizarContraste(pagina, descripcion, { incluir } = {}) {
  let analisis = new AxeBuilder({ page: pagina }).withRules(['color-contrast']);
  if (incluir) {
    analisis = analisis.include(incluir);
  }
  const resultado = await analisis.analyze();
  const violaciones = resultado.violations.flatMap((violacion) =>
    violacion.nodes.map((nodo) => `${violacion.id}: ${nodo.target.join(' ')} — ${nodo.failureSummary}`),
  );
  expect(violaciones, `${descripcion}: violaciones de contraste`).toEqual([]);
  const evaluados = resultado.passes.flatMap((regla) => regla.nodes).length;
  const sinDeterminar = resultado.incomplete.flatMap((regla) => regla.nodes).length;
  test.info().annotations.push({
    type: 'axe',
    description: `${descripcion}: ${evaluados} nodos sin violaciones, ${sinDeterminar} sin determinar`,
  });
  return resultado;
}

test.describe('contraste con axe-core (AC-62)', () => {
  for (const [descripcion, saldoInicial, textoSaldo] of [
    ['positivo', { tipo: 'INGRESO', monto: '10000.00' }, 'USD 10.000,00'],
    ['negativo', { tipo: 'GASTO', monto: '500.00' }, 'USD -500,00'],
  ]) {
    test(`Cuenta con saldo ${descripcion}, lista y paginación no tiene violaciones de color-contrast (AC-62)`, async ({
      paginaConUsuario: pagina,
      usuario,
    }) => {
      await CargarMovimientos(usuario.idCuenta, [
        { ...saldoInicial, fecha: '2026-01-01' },
        ...CrearMovimientosAnteriores(120),
      ]);
      await pagina.goto('/');
      await expect(pagina.getByText(textoSaldo, { exact: true })).toBeVisible();
      await expect(pagina.getByText('Página 1 de 3')).toBeVisible();
      await AnalizarContraste(pagina, `Cuenta, saldo ${descripcion}, página 1`);

      await pagina.getByRole('button', { name: 'Siguiente' }).click();
      await expect(pagina.getByText('Página 2 de 3')).toBeVisible();
      await AnalizarContraste(pagina, `Cuenta, saldo ${descripcion}, página 2`);
    });
  }

  test('Cuenta con saldo cero, lista y paginación no tiene violaciones de color-contrast (AC-62)', async ({
    paginaConUsuario: pagina,
    usuario,
  }) => {
    // 120 movimientos de 10,00 que se compensan (ingresos y gastos intercalados): saldo 0,00 y
    // tres páginas.
    await CargarMovimientos(usuario.idCuenta, CrearMovimientosAnteriores(120));
    await pagina.goto('/');
    await expect(pagina.getByText('USD 0,00', { exact: true })).toBeVisible();
    await expect(pagina.getByText('Página 1 de 3')).toBeVisible();
    await expect(ObtenerFilas(pagina)).toHaveCount(50);
    await AnalizarContraste(pagina, 'Cuenta, saldo cero con lista, página 1');

    await pagina.getByRole('button', { name: 'Siguiente' }).click();
    await expect(pagina.getByText('Página 2 de 3')).toBeVisible();
    await AnalizarContraste(pagina, 'Cuenta, saldo cero con lista, página 2');
  });

  test('Cuenta con saldo cero y sin movimientos no tiene violaciones de color-contrast (AC-62)', async ({
    paginaConUsuario: pagina,
    usuario,
  }) => {
    await CargarMovimientos(usuario.idCuenta, []);
    await pagina.goto('/');
    await expect(pagina.getByText('USD 0,00', { exact: true })).toBeVisible();
    await expect(pagina.getByText('Aquí verá sus movimientos.')).toBeVisible();
    await AnalizarContraste(pagina, 'Cuenta, saldo cero');
  });

  for (const [nombreBoton, mensajeExito] of [
    ['Añadir Gasto', 'Gasto registrado con éxito.'],
    ['Añadir Ingreso', 'Ingreso registrado con éxito.'],
  ]) {
    test(`"${nombreBoton}" con el calendario y el selector abiertos, y sus mensajes de error y de éxito, no tienen violaciones de contraste y los íconos tienen al menos 3:1 (AC-62)`, async ({
      paginaConUsuario: pagina,
      usuario,
    }) => {
      await CargarCategoria(usuario.idCuenta, 'Mercado', 'GASTO');
      await CargarCategoria(usuario.idCuenta, 'Sueldo', 'INGRESO');
      await CargarMovimientos(usuario.idCuenta, [
        { tipo: 'INGRESO', monto: '10000.00', fecha: '2026-01-01' },
      ]);
      await pagina.goto('/');
      await pagina.getByRole('button', { name: nombreBoton }).click();
      await expect(pagina.getByRole('heading', { level: 1, name: nombreBoton })).toBeVisible();
      const selectorCategoria = pagina.getByLabel('Categoría');
      await expect(selectorCategoria).toBeEnabled();

      // Selector con el foco (la lista nativa abierta no forma parte del documento) y calendario
      // abierto.
      await selectorCategoria.focus();
      await AnalizarContraste(pagina, `${nombreBoton}, selector de categoría`);
      await pagina.getByLabel('Fecha').click();
      await expect(pagina.getByRole('dialog', { name: 'Calendario' })).toBeVisible();
      await AnalizarContraste(pagina, `${nombreBoton}, calendario abierto`);
      await pagina.keyboard.press('Escape');

      // Mensaje de error (monto vacío).
      await pagina.getByRole('button', { name: 'Guardar' }).click();
      const dialogo = pagina.getByRole('alertdialog');
      await expect(dialogo).toBeVisible();
      await AnalizarContraste(pagina, `${nombreBoton}, mensaje de error`, {
        incluir: '[role="alertdialog"]',
      });
      const contrasteCruz = await MedirContrasteIcono(dialogo.getByRole('img', { name: 'Error' }));
      expect(contrasteCruz.contraste, JSON.stringify(contrasteCruz)).toBeGreaterThanOrEqual(3);
      await dialogo.getByRole('button', { name: 'Aceptar' }).click();

      // Mensaje de éxito.
      await pagina.getByLabel('Monto').fill('100');
      await pagina.getByRole('button', { name: 'Guardar' }).click();
      const mensaje = pagina.getByText(mensajeExito);
      await expect(mensaje).toBeVisible();
      await AnalizarContraste(pagina, `${nombreBoton}, mensaje de éxito`);
      const contrasteTic = await MedirContrasteIcono(pagina.getByRole('img', { name: 'Éxito' }));
      expect(contrasteTic.contraste, JSON.stringify(contrasteTic)).toBeGreaterThanOrEqual(3);
      test.info().annotations.push({
        type: 'contraste de íconos',
        description: `cruz ${contrasteCruz.contraste.toFixed(2)}:1, tic ${contrasteTic.contraste.toFixed(2)}:1`,
      });
    });
  }

  test('el menú de la fila abierto y el formulario de edición con el selector de tipo, el de categoría y el calendario abiertos no tienen violaciones de color-contrast (AC-29)', async ({
    paginaConUsuario: pagina,
    usuario,
  }) => {
    const idMercado = await CargarCategoria(usuario.idCuenta, 'Mercado', 'GASTO');
    await CargarMovimientos(usuario.idCuenta, [
      { tipo: 'INGRESO', monto: '10000.00', fecha: '2026-01-01' },
      { tipo: 'GASTO', monto: '1500.00', fecha: ObtenerFechaLocal(-1), idCategoria: idMercado },
    ]);
    await pagina.goto('/');
    await expect(pagina.getByText('USD 8.500,00', { exact: true })).toBeVisible();

    await ObtenerFilas(pagina).first().click();
    const menu = pagina.getByRole('menu');
    await expect(menu).toBeVisible();
    await AnalizarContraste(pagina, 'Cuenta con el menú de la fila abierto');
    await AnalizarContraste(pagina, 'menú de la fila', { incluir: '[role="menu"]' });

    await menu.getByRole('menuitem', { name: 'Editar' }).click();
    await expect(pagina.getByRole('heading', { level: 1, name: 'Editar Movimiento' })).toBeVisible();
    const selectorCategoria = pagina.getByLabel('Categoría');
    await expect(selectorCategoria).toBeEnabled();
    await AnalizarContraste(pagina, 'Editar Movimiento');

    // Selector de tipo con el foco, después de elegir "Ingreso" (la categoría pasa a la del tipo).
    const radioIngreso = pagina.getByRole('radio', { name: 'Ingreso', exact: true });
    await radioIngreso.check();
    await expect(selectorCategoria.locator('option:checked')).toHaveText('Pago Ingresado');
    await radioIngreso.focus();
    await AnalizarContraste(pagina, 'Editar Movimiento, selector de tipo');

    // Selector de categoría con el foco (la lista nativa abierta no forma parte del documento) y
    // calendario abierto.
    await expect(selectorCategoria).toBeEnabled();
    await selectorCategoria.focus();
    await AnalizarContraste(pagina, 'Editar Movimiento, selector de categoría');
    await pagina.getByLabel('Fecha').click();
    await expect(pagina.getByRole('dialog', { name: 'Calendario' })).toBeVisible();
    await AnalizarContraste(pagina, 'Editar Movimiento, calendario abierto');
    await pagina.keyboard.press('Escape');

    await pagina.getByRole('button', { name: 'Guardar' }).click();
    await expect(pagina.getByText('Movimiento actualizado con éxito.')).toBeVisible();
    await expect(pagina.getByText('USD 11.500,00', { exact: true })).toBeVisible();
    await AnalizarContraste(pagina, 'Cuenta tras editar, mensaje de éxito');
  });
});
