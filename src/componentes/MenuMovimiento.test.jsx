import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { MenuMovimiento } from './MenuMovimiento.jsx';

// El menú se monta abierto, debajo del botón de la fila que lo abrió, como lo
// usa ListaMovimientos. "Otro Botón" representa cualquier control de afuera.
function RenderizarMenu({ alEditar = vi.fn(), alCerrar = vi.fn() } = {}) {
  function Prueba() {
    const botonFila = useRef(null);
    return (
      <>
        <button type="button" ref={botonFila}>
          Fila Mercado
        </button>
        <MenuMovimiento botonFila={botonFila} alEditar={alEditar} alCerrar={alCerrar} />
        <button type="button">Otro Botón</button>
      </>
    );
  }
  render(<Prueba />);
  return { alEditar, alCerrar, botonFila: screen.getByRole('button', { name: 'Fila Mercado' }) };
}

describe('MenuMovimiento', () => {
  it('es un menú con una sola opción "Editar" y, al abrirse, el foco va a "Editar"', () => {
    RenderizarMenu();

    const menu = screen.getByRole('menu');
    const opciones = screen.getAllByRole('menuitem');
    expect(opciones.map((opcion) => opcion.textContent)).toEqual(['Editar']);
    expect(menu).toContainElement(opciones[0]);
    expect(document.activeElement).toBe(opciones[0]);
  });

  it('no ofrece ninguna opción para eliminar', () => {
    RenderizarMenu();

    expect(screen.queryByRole('menuitem', { name: /eliminar/i })).not.toBeInTheDocument();
  });

  it('elegir "Editar" con un clic o con Enter llama a alEditar', async () => {
    const usuario = userEvent.setup();
    const { alEditar } = RenderizarMenu();

    await usuario.click(screen.getByRole('menuitem', { name: 'Editar' }));
    expect(alEditar).toHaveBeenCalledTimes(1);

    screen.getByRole('menuitem', { name: 'Editar' }).focus();
    await usuario.keyboard('{Enter}');
    expect(alEditar).toHaveBeenCalledTimes(2);
  });

  it('Escape lo cierra y devuelve el foco al botón de la fila', () => {
    const { alCerrar, botonFila } = RenderizarMenu();

    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Editar' }), { key: 'Escape' });

    expect(alCerrar).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(botonFila);
  });

  it('un clic afuera lo cierra y devuelve el foco al botón de la fila', () => {
    const { alCerrar, botonFila } = RenderizarMenu();

    fireEvent.pointerDown(document.body);

    expect(alCerrar).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(botonFila);
  });

  it('un clic en el botón de la fila no lo cierra desde el menú (lo cierra el botón)', () => {
    const { alCerrar, botonFila } = RenderizarMenu();

    fireEvent.pointerDown(botonFila);

    expect(alCerrar).not.toHaveBeenCalled();
  });

  it('las flechas, Inicio y Fin mueven el foco entre las opciones sin salir del menú', () => {
    RenderizarMenu();
    const editar = screen.getByRole('menuitem', { name: 'Editar' });

    for (const tecla of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
      const evento = fireEvent.keyDown(editar, { key: tecla });
      expect(evento).toBe(false); // preventDefault: la página no se desplaza
      expect(document.activeElement).toBe(editar);
    }
  });

  it('Mayús+Tab lo cierra y devuelve el foco al botón de la fila', async () => {
    const usuario = userEvent.setup();
    const { alCerrar, botonFila } = RenderizarMenu();

    await usuario.tab({ shift: true });

    expect(alCerrar).toHaveBeenCalled();
    expect(document.activeElement).toBe(botonFila);
  });

  it('Tab lo cierra sin forzar el foco al botón de la fila', async () => {
    const usuario = userEvent.setup();
    const { alCerrar } = RenderizarMenu();

    await usuario.tab();

    expect(alCerrar).toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Otro Botón' }));
  });
});
