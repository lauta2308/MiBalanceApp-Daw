// Rendimiento del alta (NFR-01, AC-50): 100 altas sobre una cuenta con 5.000 movimientos, en
// Chrome con la CPU ralentizada 4×. Cada medición va desde el clic en "Guardar" hasta que la
// lista y el saldo se muestran actualizados; el p95 debe ser menor a 2 s.

import { cantidadMovimientosRendimiento } from './configuracionGlobal.js';
import {
  ConvertirCentavosAMonto,
  ConvertirMontoACentavos,
  CrearClienteAdministrador,
  FormatearMontoPantalla,
  expect,
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

test(`${cantidadMediciones} altas sobre una cuenta de 5.000 movimientos, con la CPU 4× más lenta, tienen p95 < 2 s (AC-50)`, async ({
  paginaConUsuario: pagina,
  usuario,
}) => {
  test.setTimeout(20 * 60_000);

  // La configuración global dejó la cuenta con 5.000 movimientos y el saldo consistente.
  const { data: cuenta, error } = await CrearClienteAdministrador()
    .from('bat_cuentas')
    .select('saldo::text')
    .eq('id', usuario.idCuenta)
    .single();
  expect(error).toBeNull();
  let saldoCentavos = ConvertirMontoACentavos(cuenta.saldo);

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
      ({ textoSaldo: saldoEsperado, textoFila }) => {
        const saldo = document.querySelector('.saldo');
        const primeraFila = document.querySelector('.fila-movimiento');
        return saldo?.textContent === saldoEsperado && primeraFila?.textContent === textoFila;
      },
      { textoSaldo, textoFila: `${categoria}${textoMonto}` },
      { polling: 'raf', timeout: 30_000 },
    );
    duraciones.push(performance.now() - inicio);
  }

  await sesionCdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  const p50 = CalcularPercentil(duraciones, 50);
  const p95 = CalcularPercentil(duraciones, 95);
  const maximo = Math.max(...duraciones);
  const resumen = `AC-50: ${duraciones.length} altas, p50 ${p50.toFixed(0)} ms, p95 ${p95.toFixed(0)} ms, máximo ${maximo.toFixed(0)} ms`;
  console.log(resumen);
  test.info().annotations.push({ type: 'rendimiento', description: resumen });

  expect(duraciones).toHaveLength(cantidadMediciones);
  expect(p95).toBeLessThan(limiteP95Ms);
});
