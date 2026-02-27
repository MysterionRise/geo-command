import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    test: {
      name: 'api',
      root: './apps/api',
      include: ['src/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'types',
      root: './packages/types',
      include: ['src/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'auth',
      root: './packages/auth',
      include: ['src/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'db',
      root: './packages/db',
      include: ['src/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'ai',
      root: './packages/ai',
      include: ['src/**/*.test.ts'],
    },
  },
])
