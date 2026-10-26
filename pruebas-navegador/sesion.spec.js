// Persistencia de la sesión anónima (FR-03, AC-04): al cerrar el navegador y volver a abrirlo,
// la app reutiliza la sesión guardada y muestra la misma cuenta, sin crear otro usuario.

import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import {
  CargarMovimientos,
  MarcarUsuariosCreadosPorLaApp,
  ObtenerFechaLocal,
  expect,
  test,
} from './utilidades/fixtures.js';

test.use({ nombreUsuario: 'sesion' });

async function LeerIdUsuarioSesion(pagina) {
  return pagina.evaluate(() => {
    const clave = Object.keys(localStorage).find((nombre) => /^sb-.+-auth-token$/.test(nombre));
    return clave ? JSON.parse(localStorage.getItem(clave))?.user?.id ?? null : null;
  });
}

async function VerificarCuenta(pagina) {
  await expect(pagina.getByRole('heading', { name: 'Mi Cuenta (USD)' })).toBeVisible();
  await expect(pagina.getByText('USD 1.500,00', { exact: true })).toBeVisible();
  await expect(pagina.getByRole('listitem')).toHaveCount(3);
}

test('con saldo USD 1.500,00 y 3 movimientos, cerrar el navegador y volver a abrirlo muestra la misma cuenta, sin crear otro usuario (AC-04)', async ({
  usuario,
}, informacionPrueba) => {
  const saldo = await CargarMovimientos(usuario.idCuenta, [
    { tipo: 'INGRESO', monto: '2000.00', fecha: ObtenerFechaLocal(-3) },
    { tipo: 'GASTO', monto: '300.00', fecha: ObtenerFechaLocal(-2) },
    { tipo: 'GASTO', monto: '200.00', fecha: ObtenerFechaLocal(-1) },
  ]);
  expect(saldo).toBe('1500.00');

  // Perfil persistente en disco: es lo más parecido a cerrar y volver a abrir el navegador.
  const directorioPerfil = informacionPrueba.outputPath('perfil');
  const urlBase = informacionPrueba.project.use.baseURL;
  const opciones = { baseURL: urlBase };
  const idsConocidos = [usuario.idUsuario];
  const estado = JSON.parse(readFileSync(usuario.rutaEstado, 'utf8'));
  const entradasSesion = estado.origins[0].localStorage;

  // Primera apertura: se carga la sesión del usuario de prueba antes de que corra la app (si no,
  // la app iniciaría otra anónima) y queda guardada en el perfil.
  let contexto = await chromium.launchPersistentContext(directorioPerfil, opciones);
  try {
    const pagina = contexto.pages()[0] ?? (await contexto.newPage());
    await pagina.addInitScript((entradas) => {
      for (const { name, value } of entradas) localStorage.setItem(name, value);
    }, entradasSesion);
    await pagina.goto('/');
    await VerificarCuenta(pagina);
    expect(await LeerIdUsuarioSesion(pagina)).toBe(usuario.idUsuario);
  } finally {
    await MarcarUsuariosCreadosPorLaApp(contexto, idsConocidos);
    await contexto.close();
  }

  // Segunda apertura, sin cargar nada: la app debe reutilizar la sesión guardada.
  contexto = await chromium.launchPersistentContext(directorioPerfil, opciones);
  try {
    const pagina = contexto.pages()[0] ?? (await contexto.newPage());
    await pagina.goto('/');
    await VerificarCuenta(pagina);
    expect(await LeerIdUsuarioSesion(pagina)).toBe(usuario.idUsuario);
  } finally {
    await MarcarUsuariosCreadosPorLaApp(contexto, idsConocidos);
    await contexto.close();
  }
});
