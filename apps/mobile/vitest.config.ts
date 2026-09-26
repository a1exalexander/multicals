import { defineConfig } from 'vitest/config'

// Pure TS logic only (no React Native runtime); UI is verified on the simulator.
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } })
