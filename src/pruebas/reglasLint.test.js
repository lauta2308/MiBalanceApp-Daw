import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';

// La primera carga de ESLint y sus plugins puede tardar en discos lentos.
const tiempoMaximoMs = 60_000;

const componenteConHtmlPeligroso = `
export function ComponentePeligroso({ contenido }) {
  return <div dangerouslySetInnerHTML={{ __html: contenido }} />;
}
`;

describe('reglas de ESLint', () => {
  it('marca como error el uso de dangerouslySetInnerHTML (react/no-danger)', async () => {
    const eslint = new ESLint({ cwd: process.cwd() });

    const [resultado] = await eslint.lintText(componenteConHtmlPeligroso, {
      filePath: 'src/componentes/ComponentePeligroso.jsx',
    });

    const errores = resultado.messages.filter(
      (mensaje) => mensaje.ruleId === 'react/no-danger' && mensaje.severity === 2,
    );
    expect(errores).toHaveLength(1);
  }, tiempoMaximoMs);
});
