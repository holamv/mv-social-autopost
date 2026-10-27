import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

const COMPILED_EXTENSION = /\.js$/
const SOURCE_EXTENSION = '.ts'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && COMPILED_EXTENSION.test(specifier) && context.parentURL?.startsWith('file:')) {
      const source = new URL(specifier.replace(COMPILED_EXTENSION, SOURCE_EXTENSION), context.parentURL)

      if (existsSync(fileURLToPath(source))) {
        return nextResolve(source.href, context)
      }
    }

    return nextResolve(specifier, context)
  },
})
