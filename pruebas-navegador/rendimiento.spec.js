// Rendimiento del alta (NFR-01, AC-50) y de la edición (FEAT-001b NFR-01, AC-22): 100 altas y 100
// ediciones sobre una cuenta con 5.000 movimientos, en Chrome con la CPU ralentizada 4×. Cada
// medición va desde el clic en "Guardar" hasta que la lista y el saldo se muestran actualizados;
// el p95 debe ser menor a 2 s.

import { cantidadMovimientosRendimiento } from './configuracionGlobal.js';
import {
  ConvertirCentavosAMonto,
  ConvertirMontoACentavos,
  CrearClienteAdministrador,
  FormatearMontoPantalla,
  ObtenerFilaPorId,
  ObtenerFilas,
  expect,
  selectorFilaMovimiento,
  test,
} from './utilidades/fixtures.js';

test.use({ nombreUsuario: 'rendimiento' });

const cantidadMediciones = 100;
const limiteP95Ms = 2000;
const ralentizacionCpu = 4;
const tamanoPagina = 50;

function CalcularPercentil(valores, percentil) {
  const ordenados = [...valores].sort((a, b) => a - b);
  const posicion = Math.ceil((percentil / 100) * ordenados.length) - 1;
  return ordenados[Math.max(0, posicion)];
}

// Saldo de la cuenta, leído con la service role, en centavos.
async function LeerSaldoCentavos(idCuenta) {
  const { data: cuenta, error } = await CrearClienteAdministrador()
    .from('bat_cuentas')
    .select('saldo::text')
    .eq('id', idCuenta)
    .single();
  expect(error).toBeNull();
  return ConvertirMontoACentavos(cuenta.saldo);
}

// Deja en el reporte y en la consola p50, p95 y máximo, y devuelve el p95.
function InformarDuraciones(duraciones, descripcion) {
  const p50 = CalcularPercentil(duraciones, 50);
  const p95 = CalcularPercentil(duraciones, 95);
  const maximo = Math.max(...duraciones);
  const resumen = `${descripcion}: ${duraciones.length} mediciones, p50 ${p50.toFixed(0)} ms, p95 ${p95.toFixed(0)} ms, máximo ${maximo.toFixed(0)} ms`;
  console.log(resumen);
  test.info().annotations.push({ type: 'rendimiento', description: resumen });
  return p95;
}

test(`${cantidadMediciones} altas sobre una cuenta de 5.000 movimientos, con la CPU 4× más lenta, tienen p95 < 2 s (AC-50)`, async ({
  paginaConUsuario: pagina,
  usuario,
}) => {
  test.setTimeout(20 * 60_000);

  // La configuración global dejó la cuenta con 5.000 movimientos y el saldo consistente.
  let saldoCentavos = await LeerSaldoCentavos(usuario.idCuenta);

  await pagina.goto('/');
  const totalPaginas = Math.ceil(cantidadMovimientosRendimiento / tamanoPagina);
  await expect(pagina.getByText(`Página 1 de ${totalPaginas}`)).toBeVisible();
  await expect(
    pagina.getByText(`USD ${FormatearMontoPantalla(ConvertirCentavosAMonto(saldoCentavos))}`, {
      exact: true,
    }),
  ).toBeVisible();

  const sesionCdp = await pagina.context().newCDPSession(pagina);
  await sesionCdp.send('Emulation.setCPUThrottlingRate', { rate: ralentizacionCpu });

  const duraciones = [];
  for (let indice = 0; indice < cantidadMediciones; indice += 1) {
    // Gastos e ingresos intercalados, con montos distintos para reconocer la fila nueva.
    const esGasto = indice % 2 === 0;
    const montoEntero = 1000 + indice;
    const monto = `${montoEntero}.00`;
    saldoCentavos += (esGasto ? -1n : 1n) * ConvertirMontoACentavos(monto);
    const textoSaldo = `USD ${FormatearMontoPantalla(ConvertirCentavosAMonto(saldoCentavos))}`;
    const textoMonto = `${esGasto ? '-' : '+'}${FormatearMontoPantalla(monto)}`;
    const categoria = esGasto ? 'Pago Realizado' : 'Pago Ingresado';

    await pagina.getByRole('button', { name: esGasto ? 'Añadir Gasto' : 'Añadir Ingreso' }).click();
    await expect(pagina.getByRole('option', { name: categoria })).toBeAttached();
    await pagina.getByLabel('Monto').fill(String(montoEntero));
    const botonGuardar = pagina.getByRole('button', { name: 'Guardar' });
    await expect(botonGuardar).toBeEnabled();

    const inicio = performance.now();
    await botonGuardar.click();
    // Lista y saldo actualizados: el saldo nuevo y la fila nueva primera en la lista, ya en Cuenta.
    await pagina.waitForFunction(
      ({ textoSaldo: saldoEsperado, textoFila, selectorFila }) => {
        const saldo = document.querySelector('.saldo');
        const primeraFila = document.querySelector(selectorFila);
        return saldo?.textContent === saldoEsperado && primeraFila?.textContent === textoFila;
      },
      { textoSaldo, textoFila: `${categoria}${textoMonto}`, selectorFila: selectorFilaMovimiento },
      { polling: 'raf', timeout: 30_000 },
    );
    duraciones.push(performance.now() - inicio);
  }

  await sesionCdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  const p95 = InformarDuraciones(duraciones, 'AC-50, altas');

  expect(duraciones).toHaveLength(cantidadMediciones);
  expect(p95).toBeLessThan(limiteP95Ms);
});

test(`${cantidadMediciones} ediciones sobre una cuenta de 5.000 movimientos, con la CPU 4× más lenta, tienen p95 < 2 s (AC-22)`, async ({
  paginaConUsuario: pagina,
  usuario,
}) => {
  test.setTimeout(30 * 60_000);

  // La cuenta tiene los 5.000 movimientos de la configuración global (más las altas de la prueba
  // anterior, si corrió). Se edita siempre el primer movimiento de la página 1: la edición no
  // cambia su fecha, así que sigue primero y se reconoce por su id.
  let saldoCentavos = await LeerSaldoCentavos(usuario.idCuenta);
  await pagina.goto('/');
  await expect(pagina.getByText(/^Página 1 de \d+$/)).toBeVisible();
  await expect(
    pagina.getByText(`USD ${FormatearMontoPantalla(ConvertirCentavosAMonto(saldoCentavos))}`, {
      exact: true,
    }),
  ).toBeVisible();

  const primeraFila = ObtenerFilas(pagina).first();
  const idMovimiento = await primeraFila.getAttribute('data-id-movimiento');
  const categoria = await primeraFila.locator('.categoria-movimiento').textContent();
  const { data: movimiento, error } = await CrearClienteAdministrador()
    .from('bat_movimientos')
    .select('tipo, monto::text')
    .eq('id', idMovimiento)
    .single();
  expect(error).toBeNull();
  const esGasto = movimiento.tipo === 'GASTO';
  let montoActual = movimiento.monto;
  const filaEditada = ObtenerFilaPorId(pagina, idMovimiento);

  const sesionCdp = await pagina.context().newCDPSession(pagina);
  await sesionCdp.send('Emulation.setCPUThrottlingRate', { rate: ralentizacionCpu });

  const duraciones = [];
  for (let indice = 0; indice < cantidadMediciones; indice += 1) {
    // Un monto distinto en cada edición, para reconocer la fila actualizada. El saldo cambia en
    // la diferencia entre el monto nuevo y el anterior, con el signo del tipo.
    const montoEntero = 2000 + indice;
    const monto = `${montoEntero}.00`;
    const diferencia = ConvertirMontoACentavos(monto) - ConvertirMontoACentavos(montoActual);
    saldoCentavos += esGasto ? -diferencia : diferencia;
    const textoSaldo = `USD ${FormatearMontoPantalla(ConvertirCentavosAMonto(saldoCentavos))}`;
    const textoFila = `${categoria}${esGasto ? '-' : '+'}${FormatearMontoPantalla(monto)}`;

    await filaEditada.click();
    await pagina.getByRole('menuitem', { name: 'Editar' }).click();
    const campoMonto = pagina.getByLabel('Monto');
    await expect(campoMonto).toHaveValue(FormatearMontoPantalla(montoActual));
    const botonGuardar = pagina.getByRole('button', { name: 'Guardar' });
    await expect(botonGuardar).toBeEnabled();
    await campoMonto.fill(String(montoEntero));

    const inicio = performance.now();
    await botonGuardar.click();
    // Lista y saldo actualizados: de vuelta en Cuenta, el saldo nuevo y la fila con el monto nuevo.
    await pagina.waitForFunction(
      ({ textoSaldo: saldoEsperado, textoFila: filaEsperada, idMovimiento: id, selectorFila }) => {
        const saldo = document.querySelector('.saldo');
        const fila = [...document.querySelectorAll(selectorFila)].find(
          (boton) => boton.dataset.idMovimiento === id,
        );
        return saldo?.textContent === saldoEsperado && fila?.textContent === filaEsperada;
      },
      { textoSaldo, textoFila, idMovimiento, selectorFila: selectorFilaMovimiento },
      { polling: 'raf', timeout: 30_000 },
    );
    duraciones.push(performance.now() - inicio);
    montoActual = monto;
  }

  await sesionCdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  const p95 = InformarDuraciones(duraciones, 'AC-22, ediciones');

  expect(duraciones).toHaveLength(cantidadMediciones);
  expect(p95).toBeLessThan(limiteP95Ms);
});
