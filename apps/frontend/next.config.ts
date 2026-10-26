import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Paquetes del workspace que se publican como TypeScript fuente.
  transpilePackages: ['@mi-monorepo/shared-types'],
  // Necesario para `output: 'standalone'` en un monorepo pnpm.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' as const } : {}),
};

export default nextConfig;
