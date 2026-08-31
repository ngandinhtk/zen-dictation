import type { AccountUser } from '../../services/accountService';
import { logoutAccount } from '../../services/accountService';
import AccountPanel from '../AccountPanel/AccountPanel';
import './Header.css';

interface HeaderProps {
  accountUser: AccountUser | null;
  isAccountOpen: boolean;
  isPremium: boolean;
  isPremiumOpen: boolean;
  isSettingsOpen: boolean;
  onAccountToggle: () => void;
  onAuthenticated: (user: AccountUser) => void;
  onLoggedOut: () => void;
  onPremiumOpen: () => void;
  onSettingsToggle: () => void;
}

const Header = ({ accountUser, isAccountOpen, isPremium, isPremiumOpen, isSettingsOpen, onAccountToggle, onAuthenticated, onLoggedOut, onPremiumOpen, onSettingsToggle }: HeaderProps) => (
  <>
    <header className="app-header">
      <h1 className="logo">Zen Dictation</h1>
      <nav className="header-nav" aria-label="Primary navigation">
        <a href="#account" className="account-toggle" onClick={event => { event.preventDefault(); onAccountToggle(); }} aria-expanded={isAccountOpen} aria-controls="account-menu">
          {accountUser ? accountUser.email.split('@')[0] : 'Account'}
        </a>
        <a href="#payment" className={'premium-toggle ' + (isPremium ? 'active' : '')} onClick={event => { event.preventDefault(); onPremiumOpen(); }} aria-expanded={isPremiumOpen}>
          <span aria-hidden="true">✦</span> {isPremium ? 'Premium' : 'Unlock Premium'}
        </a>
        <a href="#settings" className="settings-toggle" onClick={event => { event.preventDefault(); onSettingsToggle(); }} aria-expanded={isSettingsOpen} aria-controls="settings-menu">
          <span aria-hidden="true">⚙</span> Settings
        </a>
      </nav>
    </header>
    {isAccountOpen && (
      <section id="account-menu" className="account-menu" aria-label="Account">
        <AccountPanel user={accountUser} onAuthenticated={onAuthenticated} onLogout={() => { void logoutAccount(); onLoggedOut(); }} />
      </section>
    )}
  </>
);

export default Header;
