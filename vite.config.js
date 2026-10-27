import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Lee .env, .env.local y .env.[mode].local. El tercer argumento vacío carga
  // todas las variables (no solo VITE_*) para las pruebas; Vite igual expone al
  // navegador únicamente las que llevan el prefijo VITE_.
  const variablesEntorno = loadEnv(mode, process.cwd(), '');
  const variablesPruebas = loadEnv('pruebas', process.cwd(), '');
  const entornoPruebas = { ...variablesEntorno, ...variablesPruebas };

  return {
    plugins: [react()],
    test: {
      exclude: ['pruebas-navegador/**', 'node_modules/**'],
      projects: [
        {
          extends: true,
          test: {
            name: 'unitarias',
            environment: 'jsdom',
            include: ['src/**/*.test.{js,jsx}'],
            setupFiles: ['src/pruebas/configuracion.js'],
            env: { TZ: 'America/Argentina/Buenos_Aires' },
          },
        },
        {
          extends: true,
          test: {
            name: 'supabase',
            environment: 'node',
            include: ['pruebas/**/*.test.js'],
            env: entornoPruebas,
          },
        },
      ],
    },
  };
});
