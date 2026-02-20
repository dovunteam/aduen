import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const output = join(root, 'public', 'ocr')
const packages = join(root, 'node_modules')

await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })
await mkdir(join(output, 'core'), { recursive: true })
for (const variant of ['lstm', 'simd-lstm', 'relaxedsimd-lstm']) {
  for (const extension of ['wasm.js', 'wasm']) {
    const file = `tesseract-core-${variant}.${extension}`
    await cp(join(packages, 'tesseract.js-core', file), join(output, 'core', file))
  }
}
for (const language of ['eng', 'msa']) {
  await mkdir(join(output, 'lang'), { recursive: true })
  await cp(join(packages, `@tesseract.js-data/${language}/4.0.0`, `${language}.traineddata.gz`), join(output, 'lang', `${language}.traineddata.gz`))
}
await build({
  configFile: false,
  root,
  publicDir: false,
  logLevel: 'warn',
  build: {
    lib: { entry: join(root, 'src', 'ocr', 'worker.ts'), name: 'AduenOcrWorker', formats: ['iife'], fileName: () => 'ocr-worker.js' },
    outDir: join(root, 'public'),
    emptyOutDir: false,
    copyPublicDir: false,
    rolldownOptions: { output: { banner: 'var global = globalThis;' } },
  },
})
