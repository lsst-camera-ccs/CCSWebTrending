import resolve from '@rollup/plugin-node-resolve';
import common from '@rollup/plugin-commonjs';

export default {
  input: 'ccs-trending.js',
  output: {
    file: 'out/ccs-trending.js',
    format: 'esm'
  },
  plugins: [
    common(),
    resolve()
  ]
};
