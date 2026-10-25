import {defineConfig} from 'vite';
export default defineConfig({server:{port:5173,strictPort:true,host:'0.0.0.0',proxy:{'/app':{target:'http://localhost:5174',changeOrigin:true,ws:true}}}});
