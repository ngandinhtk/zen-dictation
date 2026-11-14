import BankQrPayment from './BankQrPayment';
import './SupportPage.css';

const SupportPage = () => (
  <section className="support-page">
    <div className="support-intro">
      <span className="premium-kicker">Support Zen Dictation</span>
      <h1>Help keep learning simple and accessible.</h1>
      <p>If Zen Dictation has helped you, you can support its continued development with a voluntary bank transfer.</p>
    </div>
    <section className="support-card" aria-label="Support by bank transfer">
      <h2>Buy me a coffee</h2>
      <BankQrPayment />
    </section>
  </section>
);

export default SupportPage;
