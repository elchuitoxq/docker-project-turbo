import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

/**
 * `eslint-config-next` v16 se distribuye como flat config, por lo que se importa
 * directamente en lugar de usar la capa de compatibilidad `FlatCompat`
 * (que falla con "Converting circular structure to JSON").
 */
const nextConfigs = nextCoreWebVitals.default ?? nextCoreWebVitals;

export default [
  ...(Array.isArray(nextConfigs) ? nextConfigs : [nextConfigs]),
  {
    plugins: { prettier },
    rules: {
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      'no-console': 'warn',
      // Deuda técnica pre-existente que queda visible al activar las reglas nuevas
      // de eslint-config-next v16. Las reglas del React Compiler ya se resolvieron en
      // el código, por lo que se fijan en 'error' para evitar regresiones; las
      // advertencias restantes de exhaustive-deps se registran en
      // docs/update/10-PENDIENTES.md (P-07).
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/purity': 'error',
      'react-hooks/incompatible-library': 'error',
    },
  },
  {
    ignores: [
      'node_modules/',
      'dist/',
      '.turbo/',
      '.next/',
      'coverage/',
      'next-env.d.ts',
      'types/api-schema.d.ts',
    ],
  },
];
