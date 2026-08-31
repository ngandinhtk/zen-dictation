import { useState } from 'react';
import { loginAccount, registerAccount, type AccountUser } from '../../services/accountService';
import './AccountPanel.css';

interface AccountPanelProps {
  user: AccountUser | null;
  onAuthenticated: (user: AccountUser) => void;
  onLogout: () => void;
}

const AccountPanel = ({ user, onAuthenticated, onLogout }: AccountPanelProps) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
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
    <div><span className="premium-kicker">Your account</span><h2>{isRegistering ? 'Create your account' : 'Welcome back'}</h2><p>Save your learning progress and access it on any device.</p></div>
    <label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label>
    <label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={8} autoComplete={isRegistering ? 'new-password' : 'current-password'} required /><small>At least 8 characters</small></label>
    {error && <p className="account-error" role="alert">{error}</p>}
    <button type="submit" className="account-submit" disabled={isLoading}>{isLoading ? 'Please wait…' : isRegistering ? 'Create account' : 'Sign in'}</button>
    <button type="button" className="account-switch" onClick={() => { setIsRegistering(value => !value); setError(''); }}>{isRegistering ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>
  </form>;
};

export default AccountPanel;
