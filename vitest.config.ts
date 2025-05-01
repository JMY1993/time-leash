import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.spec.ts'],
    typecheck: {
      tsconfig: './tsconfig.test.json'
    }
  }
})