import base from '../../eslint.config.mjs';

export default [
  ...base,
  {
    // Generado por `openapi-typescript`; no se lintea ni se formatea.
    ignores: ['src/api-types.ts', 'openapi.json'],
  },
];
