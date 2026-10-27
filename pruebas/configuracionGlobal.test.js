// Errores de la preparación de las pruebas en navegador (spec FEAT-001a, Block 7): E7-1 y E7-2.
// Prueban los ayudantes de pruebas-navegador/ sin abrir un navegador ni llamar a Supabase.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ConfigurarPruebasNavegador, {
  IniciarSesionAnonimaPrueba,
} from '../pruebas-navegador/configuracionGlobal.js';
import { ObtenerUsuarioPreparado } from '../pruebas-navegador/utilidades/fixtures.js';

const mensajeFaltaClave = 'Falta SUPABASE_SERVICE_ROLE_KEY en .env.pruebas.local.';
const mensajeLimite = 'Límite de inicios anónimos de Supabase alcanzado; reintente más tarde.';

let directorioTemporal;
let claveEnEntorno;

beforeEach(() => {
  directorioTemporal = mkdtempSync(join(tmpdir(), 'mibalance-pruebas-'));
  // El proyecto supabase de Vitest copia la clave a process.env, y loadEnv también la lee de ahí:
  // se quita durante cada prueba para simular un .env.pruebas.local sin la clave.
  claveEnEntorno = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

afterEach(() => {
  if (claveEnEntorno !== undefined) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = claveEnEntorno;
  }
  rmSync(directorioTemporal, { recursive: true, force: true });
});

describe('configuracionGlobal.js', () => {
  it('(error E7-1) sin SUPABASE_SERVICE_ROLE_KEY en .env.pruebas.local corta con el mensaje indicado antes de preparar nada', async () => {
    writeFileSync(join(directorioTemporal, '.env.pruebas.local'), 'SUPABASE_DB_PASSWORD=algo\n');
    const directorioSesiones = join(directorioTemporal, 'sesiones');

    await expect(
      ConfigurarPruebasNavegador(undefined, { directorio: directorioTemporal, directorioSesiones }),
    ).rejects.toThrow(mensajeFaltaClave);
  });

  it('(error E7-2) si Supabase responde 429 al inicio anónimo, informa el límite de inicios', async () => {
    const clienteLimitado = {
      auth: {
        signInAnonymously: async () => ({
          data: { user: null, session: null },
          error: { status: 429, message: 'Request rate limit reached' },
        }),
      },
    };

    await expect(IniciarSesionAnonimaPrueba(clienteLimitado)).rejects.toThrow(mensajeLimite);
  });
});

describe('fixtures.js', () => {
  it('(error E7-2) si la preparación no pudo crear la sesión por el límite, la prueba falla con el mensaje del límite', () => {
    const rutaRegistro = join(directorioTemporal, 'usuarios.json');
    writeFileSync(rutaRegistro, JSON.stringify({ anchos: { limite: true } }));

    expect(() => ObtenerUsuarioPreparado('anchos', rutaRegistro)).toThrow(mensajeLimite);
  });
});
