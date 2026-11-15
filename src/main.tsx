import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import PasswordResetScreen from './components/PasswordResetScreen/PasswordResetScreen'
import './styles/globals.css'
import { applyTheme, getTheme } from './services/themeService'
import { AppLanguageProvider } from './context/AppLanguageContext'

applyTheme(getTheme());

const resetToken = new URLSearchParams(window.location.hash.slice(1)).get('reset-password');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppLanguageProvider>
      {resetToken !== null ? <PasswordResetScreen token={resetToken} /> : <App />}
    </AppLanguageProvider>
  </StrictMode>,
)
