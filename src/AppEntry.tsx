import { useState } from 'react';
import App from './App';
import EmailAccessGate from './components/EmailAccessGate/EmailAccessGate';
import PasswordResetScreen from './components/PasswordResetScreen/PasswordResetScreen';
import PlacementTest from './components/PlacementTest/PlacementTest';

const hasEmailAccess = () => {
  try {
    return localStorage.getItem('zen-dictation-email-access') === 'granted';
  } catch {
    return false;
  }
};

export default function AppEntry() {
  const resetToken = new URLSearchParams(window.location.hash.slice(1)).get('reset-password');
  const [hasAccess, setHasAccess] = useState(hasEmailAccess);

  if (resetToken !== null) return <PasswordResetScreen token={resetToken} />;
  if (!hasAccess) {
    return <EmailAccessGate onAccessGranted={() => {
      try {
        localStorage.setItem('zen-dictation-email-access', 'granted');
      } catch {
        // Access remains available for the current page session.
      }
      setHasAccess(true);
    }} />;
  }
  return new URLSearchParams(window.location.search).get('page') === 'placement'
    ? <PlacementTest />
    : <App />;
}
