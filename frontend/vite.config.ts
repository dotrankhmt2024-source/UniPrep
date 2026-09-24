import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	server: {
		port: 5173,
		// Tunnel cloudflared giữ nguyên Host header -> phải whitelist domain.
		allowedHosts: ['uniprep.phanlethien.xyz'],
		// Local dev: /api -> Nest :3000. Qua tunnel, cloudflared tự route /api.
		proxy: {
			'/api': {
				target: 'http://localhost:3000',
				changeOrigin: true,
			},
		},
	},
});
