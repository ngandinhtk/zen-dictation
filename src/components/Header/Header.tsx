import { useState } from 'react';
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
  isReviewOpen: boolean;
  onAccountToggle: () => void;
  onAuthenticated: (user: AccountUser) => void;
  onLoggedOut: () => void;
  onPremiumOpen: () => void;
  onSettingsToggle: () => void;
  onReviewOpen: () => void;
}

const Header = ({ accountUser, isAccountOpen, isPremium, isPremiumOpen, isSettingsOpen, isReviewOpen, onAccountToggle, onAuthenticated, onLoggedOut, onPremiumOpen, onSettingsToggle, onReviewOpen }: HeaderProps) => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  return (
  <>
    <header className="app-header">
      <h1 className="logo">Zen Dictation</h1>
      <button type="button" className="mobile-nav-toggle" onClick={() => setIsMobileNavOpen(open => !open)} aria-expanded={isMobileNavOpen} aria-controls="primary-navigation" aria-label={isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}><span /><span /><span /></button>
      <nav id="primary-navigation" className={`header-nav ${isMobileNavOpen ? 'mobile-nav-open' : ''}`} aria-label="Primary navigation">
        <a href="#review" className="review-toggle" onClick={event => { event.preventDefault(); onReviewOpen(); }} aria-expanded={isReviewOpen} aria-controls="review-page">
          <span aria-hidden="true" style={{ color: '#4479a7' }}>✦</span> Review words
        </a>
           <a href="#payment" className={'premium-toggle ' + (isPremium ? 'active' : '')} onClick={event => { event.preventDefault(); onPremiumOpen(); }} aria-expanded={isPremiumOpen}>
          <span aria-hidden="true" style={{ color: '#1aac93c4' }}>✦</span> {isPremium ? 'Premium' : 'Unlock Premium'}
        </a>
        
        <a href="#settings" className="settings-toggle" onClick={event => { event.preventDefault(); onSettingsToggle(); }} aria-expanded={isSettingsOpen} aria-controls="settings-menu">
          <span aria-hidden="true"  >⚙</span> Settings
        </a>
     
        {(import.meta.env.VITE_TELEGRAM_URL as string | undefined) && <a href={import.meta.env.VITE_TELEGRAM_URL as string} className="telegram-toggle" target="_blank" rel="noreferrer">✈ Contact</a>}
       <a href="#account" className="account-toggle" onClick={event => { event.preventDefault(); onAccountToggle(); }} aria-expanded={isAccountOpen} aria-controls="account-menu">
           {accountUser ? accountUser.email.split('@')[0] : 'Account'}
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
};

export default Header;
