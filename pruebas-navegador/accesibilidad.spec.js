// Accesibilidad (NFR-07, NFR-08): uso solo con teclado y foco visible (AC-61), y contraste de
// textos e íconos medido con axe-core (AC-62).

import AxeBuilder from '@axe-core/playwright';
import {
  CargarCategoria,
  CargarMovimientos,
  CrearMovimientosAnteriores,
  ObtenerFechaLocal,
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
  await TabularHasta(pagina, botonSiguiente);
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
  await TabularHasta(pagina, botonGasto, { atras: true });
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
  await expect(pagina.getByRole('listitem').nth(0)).toHaveText('Pago Ingresado+200,00');
  const grupoAyer = pagina.locator('.grupo-movimientos').filter({
    has: pagina.getByRole('heading', { level: 2, name: FormatearFechaPantalla(ayer) }),
  });
  await expect(grupoAyer.getByRole('listitem').first()).toHaveText('Mercado-150,00');
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
    await expect(pagina.getByRole('listitem')).toHaveCount(50);
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
});
