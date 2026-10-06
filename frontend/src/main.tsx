import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { applyTheme, loadSavedTheme } from './lib/theme'

applyTheme(loadSavedTheme()) // before first paint: CSS variables + data ramps

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
