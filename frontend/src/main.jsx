import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from "react-router-dom"
import { registerSW } from 'virtual:pwa-register'
import toast from 'react-hot-toast'
import { RefreshCw } from 'lucide-react'
import "leaflet/dist/leaflet.css"
import './index.css'
import App from './App.jsx'
import { installAuthInterceptor } from './utils/apiClient'

// Pasang sebelum render supaya semua fetch (termasuk saat mount pertama)
// sudah terbungkus interceptor 401.
installAuthInterceptor()

registerSW({
  immediate: true,
  onNeedRefresh() {
    toast("Versi app baru tersedia. Muat ulang halaman.", {
      icon: <RefreshCw size={16} />,
      duration: 8000,
    });
  },
  onOfflineReady() {
    console.log("[pwa] siap offline");
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)