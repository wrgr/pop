import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


// 👉 Change this to '/<your-repo>/' before deploying to GH Pages
export default defineConfig({
plugins: [react()],
base: '/pop/'
})