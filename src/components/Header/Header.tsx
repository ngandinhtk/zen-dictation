import { useState } from 'react';
import type { AccountUser } from '../../services/accountService';
import { logoutAccount } from '../../services/accountService';
import type { AppLanguage } from '../../utils/appLanguage';
import AccountPanel from '../AccountPanel/AccountPanel';
import './Header.css';

interface HeaderProps {
  language: AppLanguage;
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

const Header = ({ language, accountUser, isAccountOpen, isPremium, isPremiumOpen, isSettingsOpen, isReviewOpen, onAccountToggle, onAuthenticated, onLoggedOut, onPremiumOpen, onSettingsToggle, onReviewOpen }: HeaderProps) => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const isVietnamese = language === 'vi';
  const placementLabel = isVietnamese ? 'Kiểm tra đầu vào' : 'Placement test';
  const placementText = isVietnamese ? 'Kiểm tra' : 'Test';
  const settingsLabel = isVietnamese ? 'Cài đặt' : 'Settings';
  const accountLabel = isVietnamese ? 'Tài khoản' : 'Account';
  const accountTitle = accountUser ? `${accountLabel} · ${accountUser.email}` : accountLabel;
  return (
  <>
    <header className="app-header">
      <h1 className="logo"><a className="logo-link" href={window.location.pathname + window.location.search}>Zen Dictation</a></h1>
      <a href="?page=placement" className="mobile-placement-link" aria-label={placementLabel}>{placementText}</a>
      <button type="button" className="mobile-nav-toggle" onClick={() => setIsMobileNavOpen(open => !open)} aria-expanded={isMobileNavOpen} aria-controls="primary-navigation" aria-label={isMobileNavOpen ? (isVietnamese ? 'Đóng menu điều hướng' : 'Close navigation menu') : (isVietnamese ? 'Mở menu điều hướng' : 'Open navigation menu')}><span /><span /><span /></button>
      <nav id="primary-navigation" className={`header-nav ${isMobileNavOpen ? 'mobile-nav-open' : ''}`} aria-label={isVietnamese ? 'Điều hướng chính' : 'Primary navigation'}>
        <a href="?page=placement" className="desktop-placement-link" aria-label={placementLabel}>{placementText}</a>
        <a href="#review" className="review-toggle" onClick={event => { event.preventDefault(); onReviewOpen(); }} aria-expanded={isReviewOpen} aria-controls="review-page">
          {isVietnamese ? 'Ôn từ' : 'Review'}
        </a>
        <a href="#payment" className={'premium-toggle ' + (isPremium ? 'active' : '')} onClick={event => { event.preventDefault(); onPremiumOpen(); }} aria-expanded={isPremiumOpen}>
          Premium
        </a>
        
        <a href="#settings" className="settings-toggle header-icon-link" aria-label={settingsLabel} title={settingsLabel} onClick={event => { event.preventDefault(); setIsMobileNavOpen(false); onSettingsToggle(); }} aria-expanded={isSettingsOpen} aria-controls="settings-menu">
          <span className="header-settings-icon" aria-hidden="true">⚙︎</span>
          <span className="header-icon-link-label">{settingsLabel}</span>
        </a>
        <a href="#account" className="header-icon-link" aria-label={accountTitle} title={accountTitle} onClick={event => { event.preventDefault(); setIsMobileNavOpen(false); onAccountToggle(); }} aria-expanded={isAccountOpen} aria-controls="account-menu">
          <span className="header-account-icon" aria-hidden="true" />
          <span className="header-icon-link-label">{accountLabel}</span>
        </a>
      </nav>
    </header>
    {isAccountOpen && (
      <section id="account-menu" className="account-menu" aria-label="Account">
        <AccountPanel user={accountUser} onAuthenticated={onAuthenticated} onLogout={async () => { await logoutAccount(); onLoggedOut(); }} />
      </section>
    )}
  </>
  );
};

export default Header;
