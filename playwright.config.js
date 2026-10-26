import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';

// Solo las variables VITE_* (las que necesita la app) se copian a process.env,
// que hereda el servidor de desarrollo de webServer. Las demás de
// .env.pruebas.local (SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_PASSWORD) nunca
// llegan a `npm run dev`: la configuración global y los fixtures las leen por
// su cuenta con loadEnv. Si la clave de service role ya estuviera en el entorno
// del proceso, también se quita.
Object.assign(process.env, loadEnv('pruebas', process.cwd(), 'VITE_'));
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const puertoDesarrollo = 5173;

export default defineConfig({
  testDir: 'pruebas-navegador',
  // Las pruebas de un mismo archivo corren en serie: anchos.spec.js y
  // accesibilidad.spec.js comparten un usuario por archivo y cada prueba
  // reemplaza sus movimientos, así que en paralelo se pisarían los datos.
  fullyParallel: false,
  // Prepara los usuarios de prueba y sus sesiones antes de correr las pruebas.
  globalSetup: './pruebas-navegador/configuracionGlobal.js',
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
