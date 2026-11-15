import BankQrPayment from './BankQrPayment';
import './SupportPage.css';
import { useAppLanguage } from '../../context/useAppLanguage';

const SupportPage = () => {
  const isVietnamese = useAppLanguage().language === 'vi';
  return <section className="support-page">
    <div className="support-intro">
      <span className="premium-kicker">{isVietnamese ? 'Ủng hộ Zen Dictation' : 'Support Zen Dictation'}</span>
      <h1>{isVietnamese ? 'Giúp việc học luôn đơn giản và dễ tiếp cận.' : 'Help keep learning simple and accessible.'}</h1>
      <p>{isVietnamese ? 'Nếu Zen Dictation hữu ích với bạn, bạn có thể tự nguyện chuyển khoản để hỗ trợ ứng dụng tiếp tục phát triển.' : 'If Zen Dictation has helped you, you can support its continued development with a voluntary bank transfer.'}</p>
    </div>
    <section className="support-card" aria-label={isVietnamese ? 'Ủng hộ qua chuyển khoản ngân hàng' : 'Support by bank transfer'}>
      <h2>{isVietnamese ? 'Mời tôi một ly cà phê' : 'Buy me a coffee'}</h2>
      <BankQrPayment />
    </section>
  </section>;
};

export default SupportPage;
