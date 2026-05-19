import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: true,
  target: 'es2020',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
});
