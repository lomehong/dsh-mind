#!/usr/bin/env node
/** 构建 dsh-mind 客户端插件：src/client/index.tsx → lib/client.js（__ModuleLoader__.load 格式） */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { build } = require('esbuild')
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkgName = '@dsh-extra/dsh-mind'

const EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-slots',
]

const banner = `window.__ModuleLoader__.load({
	id: ${JSON.stringify(pkgName)},
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;`

const footer = `		return module.exports;
	}
});`

console.log('[build-client] bundling src/client/index.tsx → lib/client.js …')
await build({
  entryPoints: [resolve(root, 'src/client/index.tsx')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: EXTERNALS,
  banner: { js: banner },
  footer: { js: footer },
  outfile: resolve(root, 'lib/client.js'),
  sourcemap: true,
  logLevel: 'info',
  legalComments: 'none',
})
console.log('[build-client] done.')
