import './PaymentPage.css';

interface PaymentPageProps {
  onBack: () => void;
  onLicenseClick: () => void;
}

const PaymentPage = ({ onBack, onLicenseClick }: PaymentPageProps) => (
  <div className="payment-page">
    <header className="payment-header">
      <button type="button" className="payment-back" onClick={onBack}>← Back to practice</button>
      <span className="logo payment-logo">Zen Dictation</span>
    </header>
    <main className="payment-content">
      <div className="payment-intro">
        <span className="premium-kicker">Premium access</span>
        <h1>Make every practice session count.</h1>
        <p>Unlock the tools that help you see progress, build consistency, and take on harder sentences.</p>
      </div>
      <section className="price-card" aria-label="Premium pricing">
        <div className="price-card-top"><span className="premium-kicker">Lifetime access</span><span className="price-badge">One-time payment</span></div>
        <h2>Zen Dictation Premium</h2>
        <div className="price"><del>$19</del><strong>$3</strong><span>one-time</span></div>
        <span className="discount-badge">Save $16 · Limited offer</span>
        <ul className="price-features">
          <li>Unlock Hard level</li>
          <li>Personal progress dashboard</li>
          <li>Practice history and accuracy tracking</li>
          <li>Daily WPM goals and learning streaks</li>
          <li>No recurring subscription</li>
        </ul>
        <button type="button" className="checkout-button" disabled>Continue to checkout <small>Coming soon</small></button>
        <button type="button" className="license-button" onClick={onLicenseClick}>Already have a license key?</button>
      </section>
      <p className="payment-note">Your Premium license will work without creating an account. An account is optional for syncing your progress across devices.</p>
    </main>
  </div>
);

export default PaymentPage;
