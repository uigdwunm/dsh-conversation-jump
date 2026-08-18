import { build } from 'esbuild'

await build({
  entryPoints: ['src/client.ts'],
  outfile: 'lib/client.js',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  bundle: true,
  external: ['@deepseek-ai/*', 'react'],
  banner: {
    js: 'window.__ModuleLoader__.load({ id: "dsh-conversation-nav", factory: (require) => { var module = { exports: {} }; var exports = module.exports;',
  },
  footer: {
    js: 'return module.exports; } });',
  },
})
