import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';

// Variables de las pruebas en navegador. SUPABASE_SERVICE_ROLE_KEY se separa y
// no se copia a process.env: así el servidor de desarrollo que levanta
// webServer (que hereda process.env) nunca recibe la clave secreta. La
// configuración global y los fixtures la leen por su cuenta con loadEnv.
const variablesPruebas = loadEnv('pruebas', process.cwd(), '');
delete variablesPruebas.SUPABASE_SERVICE_ROLE_KEY;
Object.assign(process.env, variablesPruebas);
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const rutaConfiguracionGlobal = './pruebas-navegador/configuracionGlobal.js';
const puertoDesarrollo = 5173;

export default defineConfig({
  testDir: 'pruebas-navegador',
  // La configuración global se agrega con las pruebas en navegador; mientras no
  // exista, Playwright corre sin ella.
  globalSetup: existsSync(rutaConfiguracionGlobal) ? rutaConfiguracionGlobal : undefined,
  use: {
    baseURL: `http://localhost:${puertoDesarrollo}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${puertoDesarrollo}`,
    reuseExistingServer: !process.env.CI,
  },
});
