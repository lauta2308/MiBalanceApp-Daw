import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const carpetaSrc = join(process.cwd(), 'src');

function ListarArchivosFuente(carpeta) {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(carpeta, entrada.name);
    if (entrada.isDirectory()) {
      return ListarArchivosFuente(ruta);
    }
    return /\.(js|jsx)$/.test(entrada.name) && !/\.test\.(js|jsx)$/.test(entrada.name)
      ? [ruta]
      : [];
  });
}

describe('sesionAnonima', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('sin variables de entorno de Supabase devuelve { ok: false } en lugar de lanzar (FR-02)', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.resetModules();
    const { IniciarSesion, ObtenerSesionActual } = await import('./sesionAnonima.js');

    await expect(IniciarSesion()).resolves.toEqual({ ok: false });
    await expect(ObtenerSesionActual()).resolves.toEqual({ ok: false });
  });

  it('es el único archivo de src/ que llama a signInAnonymously', () => {
    const archivosQueLoLlaman = ListarArchivosFuente(carpetaSrc)
      .filter((ruta) => readFileSync(ruta, 'utf8').includes('signInAnonymously'))
      .map((ruta) => relative(carpetaSrc, ruta).split(sep).join('/'));

    expect(archivosQueLoLlaman).toEqual(['sesion/sesionAnonima.js']);
  });
});
