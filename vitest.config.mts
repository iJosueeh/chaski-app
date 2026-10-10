import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      EXPO_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
      EXPO_PUBLIC_SUPABASE_KEY: 'test-anon-key',
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@/assets': fileURLToPath(new URL('./assets', import.meta.url)),
    },
  },
});
