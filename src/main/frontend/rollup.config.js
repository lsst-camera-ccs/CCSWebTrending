import resolve from '@rollup/plugin-node-resolve';
import common from '@rollup/plugin-commonjs';
import { terser } from "rollup-plugin-terser";

export default {
  input: 'ccs-trending.js',
  output: {
    file: 'out/ccs-trending.js',
    format: 'esm'
  },
  plugins: [
    common(),
    resolve(),
    terser()
  ]
};
