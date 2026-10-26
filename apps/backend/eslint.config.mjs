import base from '../../eslint.config.mjs';

export default [
  ...base,
  {
    files: ['src/**/*.ts'],
    rules: {
      // NestJS usa clases con parámetros de constructor inyectados.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
