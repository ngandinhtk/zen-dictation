import { useState } from 'react';
import { loginAccount, registerAccount, resetAccountPassword, type AccountUser } from '../../services/accountService';
import './AccountPanel.css';
// import PrivacyNotice from '../PrivacyPage/PrivacyNotice';
import { useAppLanguage } from '../../context/useAppLanguage';

interface AccountPanelProps {
  user: AccountUser | null;
  onAuthenticated: (user: AccountUser) => void;
  onLogout: () => void | Promise<void>;
  resetToken?: string;
}

const AccountPanel = ({ user, onAuthenticated, onLogout, resetToken }: AccountPanelProps) => {
  const isVietnamese = useAppLanguage().language === 'vi';
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetComplete, setResetComplete] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (resetToken) {
        if (password !== confirmPassword) throw new Error(isVietnamese ? 'Mật khẩu xác nhận không khớp.' : 'Passwords do not match');
        const result = await resetAccountPassword(resetToken, password);
        setMessage(result.message);
        setResetComplete(true);
        setPassword('');
        setConfirmPassword('');
        window.history.replaceState({}, '', window.location.pathname + window.location.search);
        return;
      }
      const nextUser = isRegistering ? await registerAccount(email, password) : await loginAccount(email, password);
      onAuthenticated(nextUser);
      setPassword('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : isVietnamese ? 'Không thể kết nối máy chủ tài khoản.' : 'Unable to connect to the account server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setError('');
    setIsLoading(true);
    try {
      await onLogout();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : isVietnamese ? 'Không thể đăng xuất.' : 'Unable to sign out');
    } finally {
      setIsLoading(false);
    }
  };

  if (user) {
    return <div className="account-panel account-signed-in"><span className="account-avatar">{user.email[0].toUpperCase()}</span><div><strong>{user.email}</strong><small>{user.isPremium ? (isVietnamese ? 'Thành viên Premium' : 'Premium member') : (isVietnamese ? 'Tài khoản miễn phí' : 'Free account')}</small>{error && <p className="account-error" role="alert">{error}</p>}</div><button type="button" onClick={() => void handleLogout()} disabled={isLoading} aria-busy={isLoading}>{isLoading ? (isVietnamese ? 'Đang đăng xuất…' : 'Signing out…') : (isVietnamese ? 'Đăng xuất' : 'Sign out')}</button></div>;
  }

  return <form className="account-panel account-form" onSubmit={handleSubmit}>
    <div><span className="premium-kicker">{isVietnamese ? 'Tài khoản của bạn' : 'Your account'}</span><h2>{resetToken ? (isVietnamese ? 'Đặt lại mật khẩu' : 'Reset your password') : isRegistering ? (isVietnamese ? 'Tạo tài khoản' : 'Create your account') : (isVietnamese ? 'Chào mừng trở lại' : 'Welcome back')}</h2><p>{resetToken ? (isVietnamese ? 'Chọn mật khẩu mới cho tài khoản.' : 'Choose a new password for your account.') : (isVietnamese ? 'Lưu tiến độ học tập và truy cập trên mọi thiết bị.' : 'Save your learning progress and access it on any device.')}</p></div>
    <fieldset className="account-fields" disabled={isLoading || resetComplete}>
    {!resetToken && <label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" maxLength={254} required /></label>}
    {!resetComplete && <label>{resetToken ? (isVietnamese ? 'Mật khẩu mới' : 'New password') : (isVietnamese ? 'Mật khẩu' : 'Password')}<input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={8} maxLength={1024} autoComplete={isRegistering || resetToken ? 'new-password' : 'current-password'} required /><small>{isVietnamese ? 'Ít nhất 8 ký tự' : 'At least 8 characters'}</small></label>}
    {resetToken && !resetComplete && <label>{isVietnamese ? 'Xác nhận mật khẩu mới' : 'Confirm new password'}<input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={8} maxLength={1024} autoComplete="new-password" required /></label>}
    </fieldset>
    {/* <PrivacyNotice /> */}
    {error && <p className="account-error" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!resetComplete && <button type="submit" className="account-submit" disabled={isLoading}>{isLoading ? (isVietnamese ? 'Vui lòng đợi…' : 'Please wait…') : resetToken ? (isVietnamese ? 'Lưu mật khẩu mới' : 'Save new password') : isRegistering ? (isVietnamese ? 'Tạo tài khoản' : 'Create account') : (isVietnamese ? 'Đăng nhập' : 'Sign in')}</button>}
    {resetToken ? <a className="account-switch" href={window.location.pathname + window.location.search}>{isVietnamese ? 'Quay lại đăng nhập' : 'Back to sign in'}</a> : <>
    <button type="button" className="account-switch" disabled={isLoading} onClick={() => { setIsRegistering(value => !value); setError(''); setMessage(''); setPassword(''); }}>{isRegistering ? (isVietnamese ? 'Quay lại đăng nhập' : 'Back to sign in') : (isVietnamese ? 'Bạn mới? Tạo tài khoản' : 'New here? Create an account')}</button>
    </>}
  </form>;
};

export default AccountPanel;
