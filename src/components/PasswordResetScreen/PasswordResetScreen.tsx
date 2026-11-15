import AccountPanel from '../AccountPanel/AccountPanel';
import LanguageSwitcher from '../LanguageSwitcher/LanguageSwitcher';
import SiteNotice from '../SiteNotice/SiteNotice';
import { useAppLanguage } from '../../context/useAppLanguage';

export default function PasswordResetScreen({ token }: { token: string }) {
  const isVietnamese = useAppLanguage().language === 'vi';
  return <>
    <SiteNotice />
    <main className="password-reset-page">
      <h1><a className="logo-link" href={window.location.pathname + window.location.search}>Zen Dictation</a></h1>
      <AccountPanel user={null} resetToken={token || 'invalid'} onAuthenticated={() => {}} onLogout={() => {}} />
      <footer className="app-footer"><span>Zentation · {isVietnamese ? 'Luyện nghe tiếng Anh' : 'English listening practice'}</span></footer>
    </main>
    <LanguageSwitcher />
  </>;
}
