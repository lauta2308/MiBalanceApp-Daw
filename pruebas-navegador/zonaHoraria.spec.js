// "Hoy" es la fecha local del dispositivo (FR-20, AC-31): a las 23:30 del 03/10/2026 en UTC-3
// (02:30 del 04/10/2026 en UTC), el gasto queda en el 03/10/2026.

import {
  CargarMovimientos,
  CrearClienteAdministrador,
  ObtenerFilas,
  expect,
  test,
} from './utilidades/fixtures.js';

test.use({ nombreUsuario: 'zonaHoraria', timezoneId: 'America/Argentina/Buenos_Aires' });

// 23:30 del 03/10/2026 en Buenos Aires (UTC-3), expresado como instante UTC.
const instanteLocal2330 = Date.UTC(2026, 9, 4, 2, 30, 0);

test('en UTC-3 a las 23:30 del 03/10/2026, "Añadir Gasto" preselecciona 03/10/2026 y el gasto de 100 queda bajo "03/10/2026" (AC-31)', async ({
  paginaConUsuario: pagina,
  usuario,
}) => {
  await CargarMovimientos(usuario.idCuenta, [
    { tipo: 'INGRESO', monto: '10000.00', fecha: '2026-09-01' },
  ]);
  // Solo se fija la hora: los temporizadores siguen corriendo (mensajes, supabase-js).
  await pagina.clock.setFixedTime(instanteLocal2330);

  await pagina.goto('/');
  await expect(pagina.getByText('USD 10.000,00', { exact: true })).toBeVisible();
  expect(await pagina.evaluate(() => new Date().getHours())).toBe(23);

  await pagina.getByRole('button', { name: 'Añadir Gasto' }).click();
  await expect(pagina.getByRole('option', { name: 'Pago Realizado' })).toBeAttached();
  await expect(pagina.getByLabel('Fecha')).toHaveText('03/10/2026');
  await pagina.getByLabel('Monto').fill('100');
  await pagina.getByRole('button', { name: 'Guardar' }).click();

  await expect(pagina.getByText('Gasto registrado con éxito.')).toBeVisible();
  await expect(pagina.getByText('USD 9.900,00', { exact: true })).toBeVisible();
  const grupo = pagina.locator('.grupo-movimientos').filter({
    has: pagina.getByRole('heading', { level: 2, name: '03/10/2026' }),
  });
  await expect(ObtenerFilas(grupo)).toHaveText(['Pago Realizado-100,00']);

  const { data, error } = await CrearClienteAdministrador()
    .from('bat_movimientos')
    .select('fecha, monto::text')
    .eq('id_cuenta', usuario.idCuenta)
    .eq('tipo', 'GASTO');
  expect(error).toBeNull();
  expect(data).toEqual([{ fecha: '2026-10-03', monto: '100.00' }]);
});
