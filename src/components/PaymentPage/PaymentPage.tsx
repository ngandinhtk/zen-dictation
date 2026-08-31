import { useState } from 'react';
import './PaymentPage.css';
import { createZaloPayOrder } from '../../services/premiumAccess';

interface PaymentPageProps {
  onBack: () => void;
  onLicenseClick: () => void;
}

const PaymentPage = ({ onBack, onLicenseClick }: PaymentPageProps) => (
  <PaymentFlow onBack={onBack} onLicenseClick={onLicenseClick} />
);

const PaymentFlow = ({ onBack, onLicenseClick }: PaymentPageProps) => {
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const startZaloPayCheckout = async () => {
    setIsCreatingOrder(true);
    setPaymentError('');
    try {
      const order = await createZaloPayOrder(email);
      window.location.assign(order.orderUrl);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Unable to start payment');
      setIsCreatingOrder(false);
    }
  };

  if (isCheckoutOpen) {
    return <div className="payment-page">
      <header className="payment-header">
        <button type="button" className="payment-back" onClick={() => setIsCheckoutOpen(false)}>← Back to pricing</button>
        <span className="logo payment-logo">Zen Dictation</span>
      </header>
      <main className="checkout-content">
        <div className="checkout-intro"><span className="premium-kicker">Secure checkout</span><h1>Your Premium, one simple payment.</h1><p>After payment is confirmed, we will generate a license key for you. No account is required.</p></div>
        <section className="checkout-card" aria-label="Checkout summary">
          <div className="checkout-card-header"><span>Zen Dictation Premium</span><strong>$5</strong></div>
          <span className="checkout-subtitle">Lifetime access · One-time payment</span>
          <label className="receipt-email">Email for your receipt <span>optional</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
          <div className="checkout-security"><span aria-hidden="true">▣</span><span><strong>Secure hosted payment</strong><small>Your card details will be handled by our payment provider, never stored in Zen Dictation.</small></span></div>
          <button type="button" className="checkout-button checkout-next" onClick={startZaloPayCheckout} disabled={isCreatingOrder}>{isCreatingOrder ? 'Opening ZaloPay…' : 'Pay securely with ZaloPay'} {!isCreatingOrder && <small>5 USD one-time</small>}</button>
          {paymentError && <p className="payment-error" role="alert">{paymentError}</p>}
          <button type="button" className="license-button" onClick={onLicenseClick}>Already paid? Enter your license key</button>
        </section>
        <p className="payment-note">You will be redirected to ZaloPay to complete the payment. Your email is optional and is only used for the receipt.</p>
      </main>
    </div>;
  }

  return (
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
        <div className="price"><del>$19</del><strong>$5</strong><span>one-time</span></div>
        <span className="discount-badge">Save $14 · Limited offer</span>
        <ul className="price-features">
          <li>Unlock Hard level</li>
          <li>Personal progress dashboard</li>
          <li>Practice history and accuracy tracking</li>
          <li>Daily WPM goals and learning streaks</li>
          <li>No recurring subscription</li>
        </ul>
        <button type="button" className="checkout-button" onClick={() => setIsCheckoutOpen(true)}>Continue to checkout</button>
        <button type="button" className="license-button" onClick={onLicenseClick}>Already have a license key?</button>
      </section>
      <p className="payment-note">Your Premium license will work without creating an account. An account is optional for syncing your progress across devices.</p>
    </main>
  </div>
  );
};

export default PaymentPage;
