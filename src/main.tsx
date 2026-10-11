import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AccountPanel from './components/AccountPanel/AccountPanel'
import './styles/globals.css'
import { applyTheme, getTheme } from './services/themeService'

applyTheme(getTheme());

const resetToken = new URLSearchParams(window.location.hash.slice(1)).get('reset-password');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {resetToken !== null ? <main className="password-reset-page"><h1><a className="logo-link" href={window.location.pathname + window.location.search}>Zen Dictation</a></h1><AccountPanel user={null} resetToken={resetToken || 'invalid'} onAuthenticated={() => {}} onLogout={() => {}} /></main> : <App />}
  </StrictMode>,
)
