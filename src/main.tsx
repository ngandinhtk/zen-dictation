import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppEntry from './AppEntry'
import './styles/globals.css'
import { applyTheme, getTheme } from './services/themeService'
import { AppLanguageProvider } from './context/AppLanguageContext'

applyTheme(getTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppLanguageProvider>
      <AppEntry />
    </AppLanguageProvider>
  </StrictMode>,
)
