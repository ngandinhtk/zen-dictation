import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import PrivacyPage from './components/PrivacyPage/PrivacyPage';
import { applyTheme, getTheme } from './services/themeService';
import './index.css';
import './styles/globals.css';

applyTheme(getTheme());
createRoot(document.getElementById('root')!).render(<StrictMode><PrivacyPage /></StrictMode>);
