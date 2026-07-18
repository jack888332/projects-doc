import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import './styles.css'
import { initializeDatabase } from './db'

await initializeDatabase()
createApp(App).use(ElementPlus).mount('#app')
