import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
// `root` es packages/shared-types: hay que subir dos niveles para llegar a la raíz del monorepo.
const backendOpenapi = resolve(root, '..', '..', 'apps', 'backend', 'docs', 'openapi.json');
const localOpenapi = join(root, 'openapi.json');
const outTypes = join(root, 'src', 'api-types.ts');

if (!existsSync(backendOpenapi)) {
  console.error(`[shared-types] OpenAPI not found at ${backendOpenapi}`);
  console.error('[shared-types] Run: pnpm --filter backend openapi:export');
  process.exit(1);
}

mkdirSync(dirname(outTypes), { recursive: true });
copyFileSync(backendOpenapi, localOpenapi);
console.log(`[shared-types] Copied OpenAPI spec to ${localOpenapi}`);

execSync(`pnpm exec openapi-typescript "${localOpenapi}" -o "${outTypes}"`, {
  stdio: 'inherit',
  cwd: root,
});
console.log(`[shared-types] Generated types at ${outTypes}`);
