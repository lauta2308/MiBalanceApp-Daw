import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { MenuMovimiento } from './MenuMovimiento.jsx';
import { AntesDeEfectosPasivos } from '../pruebas/antesDeEfectosPasivos.jsx';

// El menú se monta abierto, debajo del botón de la fila que lo abrió, como lo
// usa ListaMovimientos. "Otro Botón" representa cualquier control de afuera;
// el título, el botón deshabilitado, la etiqueta sin control y el enlace sin
// destino son zonas de afuera que no pueden recibir el foco.
function RenderizarMenu({ alEditar = vi.fn(), alEliminar = vi.fn(), alCerrar = vi.fn() } = {}) {
  function Prueba() {
    const botonFila = useRef(null);
    return (
      <>
        <h1>Mi Cuenta (USD)</h1>
        <button type="button" disabled>
          Anterior
        </button>
        <label>Sin Control</label>
        <a>Enlace sin Destino</a>
        <button type="button" ref={botonFila}>
          Fila Mercado
        </button>
        <MenuMovimiento
          botonFila={botonFila}
          alEditar={alEditar}
          alEliminar={alEliminar}
          alCerrar={alCerrar}
        />
        <button type="button">Otro Botón</button>
      </>
    );
  }
  render(<Prueba />);
  return {
    alEditar,
    alEliminar,
    alCerrar,
    botonFila: screen.getByRole('button', { name: 'Fila Mercado' }),
  };
}

// El menú con su fila, envuelto en AntesDeEfectosPasivos.
function MenuAntesDeEfectosPasivos({ alComprometer }) {
  const botonFila = useRef(null);
  return (
    <AntesDeEfectosPasivos alComprometer={alComprometer}>
      <button type="button" ref={botonFila}>
        Fila Mercado
      </button>
      <MenuMovimiento botonFila={botonFila} alEditar={vi.fn()} alEliminar={vi.fn()} alCerrar={vi.fn()} />
    </AntesDeEfectosPasivos>
  );
}

describe('MenuMovimiento', () => {
  it('es un menú con las opciones "Editar" y "Eliminar" y, al abrirse, el foco va a "Editar" (AC-01)', () => {
    RenderizarMenu();

    const menu = screen.getByRole('menu');
    const opciones = screen.getAllByRole('menuitem');
    expect(opciones.map((opcion) => opcion.textContent)).toEqual(['Editar', 'Eliminar']);
    opciones.forEach((opcion) => expect(menu).toContainElement(opcion));
    expect(document.activeElement).toBe(opciones[0]);
  });

  it('elegir "Eliminar" con un clic o con Enter llama a alEliminar y no a alEditar', async () => {
    const usuario = userEvent.setup();
    const { alEditar, alEliminar } = RenderizarMenu();

    await usuario.click(screen.getByRole('menuitem', { name: 'Eliminar' }));
    expect(alEliminar).toHaveBeenCalledTimes(1);

    screen.getByRole('menuitem', { name: 'Eliminar' }).focus();
    await usuario.keyboard('{Enter}');
    expect(alEliminar).toHaveBeenCalledTimes(2);
    expect(alEditar).not.toHaveBeenCalled();
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

    fireEvent.mouseDown(document.body);

    expect(alCerrar).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(botonFila);
  });

  // El mousedown cancelado es lo que, en todos los navegadores, impide que el
  // clic le quite el foco a la fila y lo deje en <body>.
  it.each([
    ['el título', () => screen.getByRole('heading', { name: 'Mi Cuenta (USD)' })],
    ['un botón deshabilitado', () => screen.getByRole('button', { name: 'Anterior' })],
    ['una etiqueta sin control', () => screen.getByText('Sin Control')],
    ['un enlace sin destino', () => screen.getByText('Enlace sin Destino')],
  ])('un clic afuera en %s (no enfocable) lo cierra, cancela el mousedown y devuelve el foco a la fila', (_, ObtenerZona) => {
    const { alCerrar, botonFila } = RenderizarMenu();

    const evento = fireEvent.mouseDown(ObtenerZona());

    expect(evento).toBe(false);
    expect(alCerrar).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(botonFila);
  });

  it('un clic afuera sobre un control enfocable lo cierra sin cancelar el mousedown, para que el foco quede en ese control', () => {
    const { alCerrar } = RenderizarMenu();

    const evento = fireEvent.mouseDown(screen.getByRole('button', { name: 'Otro Botón' }));

    expect(evento).toBe(true);
    expect(alCerrar).toHaveBeenCalledTimes(1);
  });

  it('un clic en el botón de la fila no lo cierra desde el menú (lo cierra el botón)', () => {
    const { alCerrar, botonFila } = RenderizarMenu();

    fireEvent.mouseDown(botonFila);

    expect(alCerrar).not.toHaveBeenCalled();
  });

  it('las flechas, Inicio y Fin recorren "Editar" y "Eliminar" sin salir del menú (AC-01)', () => {
    RenderizarMenu();
    const editar = screen.getByRole('menuitem', { name: 'Editar' });
    const eliminar = screen.getByRole('menuitem', { name: 'Eliminar' });

    // Desde "Editar": abajo pasa a "Eliminar"; abajo de nuevo vuelve a
    // "Editar"; arriba da la vuelta a "Eliminar"; Inicio y Fin van a los extremos.
    for (const [tecla, esperado] of [
      ['ArrowDown', eliminar],
      ['ArrowDown', editar],
      ['ArrowUp', eliminar],
      ['ArrowUp', editar],
      ['End', eliminar],
      ['Home', editar],
    ]) {
      const evento = fireEvent.keyDown(document.activeElement, { key: tecla });
      expect(evento).toBe(false); // preventDefault: la página no se desplaza
      expect(document.activeElement).toBe(esperado);
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

  function RenderizarMenuAntesDeEfectosPasivos(alComprometer) {
    render(<MenuAntesDeEfectosPasivos alComprometer={alComprometer} />);
  }

  it('(regresión 4) "Editar" ya tiene el foco en el commit que abre el menú, antes de los efectos pasivos', () => {
    let focoEnElCommit = null;
    RenderizarMenuAntesDeEfectosPasivos(() => {
      focoEnElCommit = document.activeElement;
    });

    expect(focoEnElCommit).toBe(screen.getByRole('menuitem', { name: 'Editar' }));
  });

  it('(regresión 4) Fin presionado antes de los efectos pasivos deja el foco en "Eliminar"', () => {
    RenderizarMenuAntesDeEfectosPasivos(() => {
      screen
        .getByRole('menu')
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    });

    expect(screen.getByRole('menuitem', { name: 'Eliminar' })).toHaveFocus();
  });
});
