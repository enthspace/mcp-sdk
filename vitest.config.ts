import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            'pkce-challenge': '/src/__mocks__/pkce-challenge.ts'
        }
    },
    test: {
        coverage: {
            exclude: [
                '.temp',
                'dist',
                '**/bench-tests/**',
                '**/examples/**',
                '**/integration-tests/**',
                '**/__mocks__/**',
                '**/*.d.ts',
                '*.ts',
            ]
        }
    }
});
