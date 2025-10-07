import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: ['./src/**/!(*.test|*.bench).ts', '!./src/__mocks__/**', '!./src/examples/**', '!./src/integration-tests/**'],

    clean: true,
    dts: true,
    exports: false,
    format: ['cjs', 'esm'],
    minify: false,

    // Custom output options to put CJS and ESM files in separate folders
    // This mirrors the previous setup with separate build steps
    outputOptions(options, format, context) {
        return {
            ...options,
            dir: options.dir + (format === 'cjs' ? '/cjs' : '/esm')
        };
    },
    outExtensions: context => ({ js: '.js', dts: '.d.ts' }),

    outDir: './dist',
    sourcemap: true,
    treeshake: true,
    unbundle: true,
});
