import resolve from '@rollup/plugin-node-resolve';
import common from '@rollup/plugin-commonjs';
import { terser } from "rollup-plugin-terser";

export default {
  input: 'ccs-trending-builder.js',
  output: {
    file: 'out/ccs-trending-builder.js',
    format: 'esm',
    sourcemap: true
  },
  plugins: [
    common(),
    resolve(),
    terser()
  ]
};
