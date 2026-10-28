import { afterEach, describe, expect, it } from 'vitest';
import { ObtenerPrimerControlEnfocable } from './foco.js';

function CrearRaiz(html) {
  const raiz = document.createElement('main');
  raiz.innerHTML = html;
  document.body.append(raiz);
  return raiz;
}

describe('ObtenerPrimerControlEnfocable', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('devuelve el primer control en el orden del documento', () => {
    const raiz = CrearRaiz(
      '<p>Texto</p><button type="button" id="primero">Volver Atrás</button><input id="segundo" />',
    );

    expect(ObtenerPrimerControlEnfocable(raiz)).toBe(raiz.querySelector('#primero'));
  });

  it('acepta enlaces con href, select, textarea y elementos con tabindex 0', () => {
    expect(ObtenerPrimerControlEnfocable(CrearRaiz('<a>Sin Href</a><a href="/" id="enlace">Inicio</a>'))).toBe(
      document.querySelector('#enlace'),
    );
    expect(ObtenerPrimerControlEnfocable(CrearRaiz('<select id="lista"></select>'))).toBe(
      document.querySelector('#lista'),
    );
    expect(ObtenerPrimerControlEnfocable(CrearRaiz('<textarea id="nota"></textarea>'))).toBe(
      document.querySelector('#nota'),
    );
    expect(ObtenerPrimerControlEnfocable(CrearRaiz('<div tabindex="0" id="region"></div>'))).toBe(
      document.querySelector('#region'),
    );
  });

  it('salta los botones y campos deshabilitados', () => {
    const raiz = CrearRaiz(
      '<button type="button" disabled>Volver Atrás</button><input disabled /><button type="button" id="habilitado">Guardar</button>',
    );

    expect(ObtenerPrimerControlEnfocable(raiz)).toBe(raiz.querySelector('#habilitado'));
  });

  it('salta los elementos con tabindex="-1", como las opciones de un menú', () => {
    const raiz = CrearRaiz(
      '<ul role="menu"><li role="menuitem" tabindex="-1">Editar</li><li role="menuitem" tabindex="-1">Eliminar</li></ul><button type="button" id="boton">Añadir Gasto</button>',
    );

    expect(ObtenerPrimerControlEnfocable(raiz)).toBe(raiz.querySelector('#boton'));
  });

  it('salta los controles dentro de un fieldset deshabilitado', () => {
    const raiz = CrearRaiz(
      '<fieldset disabled><input id="monto" /><div tabindex="0">Fecha</div></fieldset><button type="button" id="guardar">Guardar</button>',
    );

    expect(ObtenerPrimerControlEnfocable(raiz)).toBe(raiz.querySelector('#guardar'));
  });

  it('devuelve null si no hay ningún control enfocable', () => {
    const raiz = CrearRaiz(
      '<h1>Pantalla</h1><button type="button" disabled>Guardar</button><span tabindex="-1">Opción</span>',
    );

    expect(ObtenerPrimerControlEnfocable(raiz)).toBeNull();
  });
});
