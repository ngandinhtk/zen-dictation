import './PrivacyNotice.css';

export default function PrivacyNotice() {
  return <p className="privacy-notice">Read how your data is handled in our <a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noopener noreferrer">Privacy Policy<span className="privacy-new-tab"> (opens in a new tab)</span></a>.</p>;
}
