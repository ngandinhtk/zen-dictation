import { useState } from 'react';
import { loginAccount, registerAccount, resetAccountPassword, type AccountUser } from '../../services/accountService';
import './AccountPanel.css';

interface AccountPanelProps {
  user: AccountUser | null;
  onAuthenticated: (user: AccountUser) => void;
  onLogout: () => void;
  resetToken?: string;
}

const AccountPanel = ({ user, onAuthenticated, onLogout, resetToken }: AccountPanelProps) => {
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
        if (password !== confirmPassword) throw new Error('Passwords do not match');
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
      setError(requestError instanceof Error ? requestError.message : 'Unable to connect to the account server');
    } finally {
      setIsLoading(false);
    }
  };

  if (user) {
    return <div className="account-panel account-signed-in"><span className="account-avatar">{user.email[0].toUpperCase()}</span><div><strong>{user.email}</strong><small>{user.isPremium ? 'Premium member' : 'Free account'}</small></div><button type="button" onClick={onLogout}>Sign out</button></div>;
  }

  return <form className="account-panel account-form" onSubmit={handleSubmit}>
    <div><span className="premium-kicker">Your account</span><h2>{resetToken ? 'Reset your password' : isRegistering ? 'Create your account' : 'Welcome back'}</h2><p>{resetToken ? 'Choose a new password for your account.' : 'Save your learning progress and access it on any device.'}</p></div>
    <fieldset className="account-fields" disabled={isLoading || resetComplete}>
    {!resetToken && <label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" maxLength={254} required /></label>}
    {!resetComplete && <label>{resetToken ? 'New password' : 'Password'}<input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={8} maxLength={1024} autoComplete={isRegistering || resetToken ? 'new-password' : 'current-password'} required /><small>At least 8 characters</small></label>}
    {resetToken && !resetComplete && <label>Confirm new password<input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={8} maxLength={1024} autoComplete="new-password" required /></label>}
    </fieldset>
    {error && <p className="account-error" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!resetComplete && <button type="submit" className="account-submit" disabled={isLoading}>{isLoading ? 'Please wait…' : resetToken ? 'Save new password' : isRegistering ? 'Create account' : 'Sign in'}</button>}
    {resetToken ? <a className="account-switch" href={window.location.pathname + window.location.search}>Back to sign in</a> : <>
    <button type="button" className="account-switch" disabled={isLoading} onClick={() => { setIsRegistering(value => !value); setError(''); setMessage(''); setPassword(''); }}>{isRegistering ? 'Back to sign in' : 'New here? Create an account'}</button>
    </>}
  </form>;
};

export default AccountPanel;
