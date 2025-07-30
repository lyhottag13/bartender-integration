import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    server: {
        proxy: {
            '/api': 'http://localhost:3000',
        },
    },
    build: {
        outDir: path.resolve(__dirname, '../dist'),
        emptyOutDir: true
    }
});
