import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const autenticacion = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInAnonymously: vi.fn(),
}));

vi.mock('../servicios/clienteSupabase.js', () => ({
  clienteSupabase: { auth: autenticacion },
}));

import { ProveedorSesion, useSesion } from './ProveedorSesion.jsx';

const mensajeErrorSesion = 'No se pudo iniciar la sesión. Vuelva a intentarlo.';
const sesionPrueba = { access_token: 'token-de-prueba', user: { id: 'usuario-prueba' } };
const respuestaSinSesion = { data: { session: null }, error: null };
const respuestaInicioExitoso = {
  data: { session: sesionPrueba, user: sesionPrueba.user },
  error: null,
};
const respuestaInicioFallido = {
  data: { session: null, user: null },
  error: { message: 'Anonymous sign-ins are disabled', code: 'anonymous_provider_disabled' },
};

function RenderizarProveedor() {
  return render(
    <ProveedorSesion>
      <h1>Sección Cuenta</h1>
    </ProveedorSesion>,
  );
}

describe('ProveedorSesion', () => {
  beforeEach(() => {
    autenticacion.getSession.mockReset();
    autenticacion.signInAnonymously.mockReset();
    autenticacion.getSession.mockResolvedValue(respuestaSinSesion);
  });

  it('con el inicio anónimo exitoso muestra los hijos sin pedir ninguna acción (AC-01)', async () => {
    autenticacion.signInAnonymously.mockResolvedValue(respuestaInicioExitoso);

    RenderizarProveedor();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
    expect(
      await screen.findByRole('heading', { name: 'Sección Cuenta' }),
    ).toBeInTheDocument();
    expect(autenticacion.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Aceptar' })).not.toBeInTheDocument();
  });

  it('con una sesión existente no llama a signInAnonymously (FR-03)', async () => {
    autenticacion.getSession.mockResolvedValue({ data: { session: sesionPrueba }, error: null });

    RenderizarProveedor();

    expect(
      await screen.findByRole('heading', { name: 'Sección Cuenta' }),
    ).toBeInTheDocument();
    expect(autenticacion.signInAnonymously).not.toHaveBeenCalled();
  });

  it('en StrictMode inicia una sola sesión anónima aunque el efecto corra dos veces', async () => {
    autenticacion.signInAnonymously.mockResolvedValue(respuestaInicioExitoso);

    render(
      <StrictMode>
        <ProveedorSesion>
          <h1>Sección Cuenta</h1>
        </ProveedorSesion>
      </StrictMode>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Sección Cuenta' }),
    ).toBeInTheDocument();
    expect(autenticacion.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('(E4-1) con el inicio anónimo fallido muestra el error con la cruz y "Aceptar", sin los hijos (AC-02)', async () => {
    autenticacion.signInAnonymously.mockResolvedValue(respuestaInicioFallido);

    RenderizarProveedor();

    expect(await screen.findByText(mensajeErrorSesion)).toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Error' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aceptar' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sección Cuenta' })).not.toBeInTheDocument();
    // R11: nunca se muestra el mensaje de Supabase.
    expect(screen.queryByText(/anonymous/i)).not.toBeInTheDocument();
  });

  it('(E4-1) si signInAnonymously lanza una excepción muestra el mismo mensaje', async () => {
    autenticacion.signInAnonymously.mockRejectedValue(new TypeError('Failed to fetch'));

    RenderizarProveedor();

    expect(await screen.findByText(mensajeErrorSesion)).toBeInTheDocument();
    expect(screen.queryByText(/fetch/i)).not.toBeInTheDocument();
  });

  it('"Aceptar" reintenta y, con éxito, muestra los hijos (AC-03)', async () => {
    const usuario = userEvent.setup();
    autenticacion.signInAnonymously
      .mockResolvedValueOnce(respuestaInicioFallido)
      .mockResolvedValueOnce(respuestaInicioExitoso);

    RenderizarProveedor();
    await usuario.click(await screen.findByRole('button', { name: 'Aceptar' }));

    expect(
      await screen.findByRole('heading', { name: 'Sección Cuenta' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(mensajeErrorSesion)).not.toBeInTheDocument();
    expect(autenticacion.signInAnonymously).toHaveBeenCalledTimes(2);
  });

  it('(E4-2) si el reintento falla vuelve a mostrar el mensaje', async () => {
    const usuario = userEvent.setup();
    autenticacion.signInAnonymously.mockResolvedValue(respuestaInicioFallido);

    RenderizarProveedor();
    await usuario.click(await screen.findByRole('button', { name: 'Aceptar' }));

    expect(await screen.findByText(mensajeErrorSesion)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aceptar' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sección Cuenta' })).not.toBeInTheDocument();
    expect(autenticacion.signInAnonymously).toHaveBeenCalledTimes(2);
  });

  it('useSesion entrega la sesión iniciada a los hijos', async () => {
    autenticacion.signInAnonymously.mockResolvedValue(respuestaInicioExitoso);
    function HijoConSesion() {
      const { sesion } = useSesion();
      return <p>Usuario {sesion.user.id}</p>;
    }

    render(
      <ProveedorSesion>
        <HijoConSesion />
      </ProveedorSesion>,
    );

    expect(await screen.findByText('Usuario usuario-prueba')).toBeInTheDocument();
  });

  it('IniciarSesion: si getSession devuelve un error, da { ok: false } sin llamar a signInAnonymously', async () => {
    autenticacion.getSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Auth session missing' },
    });
    const { IniciarSesion } = await import('./sesionAnonima.js');

    await expect(IniciarSesion()).resolves.toEqual({ ok: false });
    expect(autenticacion.signInAnonymously).not.toHaveBeenCalled();
  });
});
