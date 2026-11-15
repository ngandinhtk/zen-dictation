import { useEffect, useRef, useState } from 'react';
import './PaymentPage.css';
import PrivacyNotice from '../PrivacyPage/PrivacyNotice';
import { activatePremiumLicense, capturePayPalOrder, createPayPalOrder, getPayPalPaymentStatus } from '../../services/premiumAccess';
import { useAppLanguage } from '../../context/useAppLanguage';

const paymentMessageTranslations: Record<string, [string, string]> = {
  'Waiting for PayPal confirmation…': ['Đang chờ PayPal xác nhận…', 'Waiting for PayPal confirmation…'],
  'Payment confirmed. Your Premium license is ready.': ['Đã xác nhận thanh toán. Mã Premium của bạn đã sẵn sàng.', 'Payment confirmed. Your Premium license is ready.'],
  'Payment is still being confirmed. Please return here in a moment.': ['Thanh toán vẫn đang được xác nhận. Vui lòng quay lại sau ít phút.', 'Payment is still being confirmed. Please return here in a moment.'],
  'We could not find this payment order. Please return to Premium and try again.': ['Không tìm thấy đơn thanh toán này. Vui lòng quay lại Premium và thử lại.', 'We could not find this payment order. Please return to Premium and try again.'],
  'Đang chờ PayPal xác nhận…': ['Đang chờ PayPal xác nhận…', 'Waiting for PayPal confirmation…'],
  'Đã xác nhận thanh toán. Mã Premium của bạn đã sẵn sàng.': ['Đã xác nhận thanh toán. Mã Premium của bạn đã sẵn sàng.', 'Payment confirmed. Your Premium license is ready.'],
  'Thanh toán vẫn đang được xác nhận. Vui lòng quay lại sau ít phút.': ['Thanh toán vẫn đang được xác nhận. Vui lòng quay lại sau ít phút.', 'Payment is still being confirmed. Please return here in a moment.'],
  'Không tìm thấy đơn thanh toán này. Vui lòng quay lại Premium và thử lại.': ['Không tìm thấy đơn thanh toán này. Vui lòng quay lại Premium và thử lại.', 'We could not find this payment order. Please return to Premium and try again.'],
};

interface PaymentPageProps {
  onBack: () => void;
  onLicenseClick: () => void;
}

const PaymentPage = ({ onBack, onLicenseClick }: PaymentPageProps) => (
  <PaymentFlow onBack={onBack} onLicenseClick={onLicenseClick} />
);

interface PaymentResultPageProps {
  onBack: () => void;
  onActivated: () => void;
}

export const PaymentResultPage = ({ onBack, onActivated }: PaymentResultPageProps) => {
  const isVietnamese = useAppLanguage().language === 'vi';
  const isVietnameseRef = useRef(isVietnamese);
  useEffect(() => { isVietnameseRef.current = isVietnamese; }, [isVietnamese]);
  const appTransId = sessionStorage.getItem('zen-paypal-order-id') || '';
  const [status, setStatus] = useState<'checking' | 'paid' | 'error'>(appTransId ? 'checking' : 'error');
  const [licenseKey, setLicenseKey] = useState('');
  const [message, setMessage] = useState(appTransId ? (isVietnamese ? 'Đang chờ PayPal xác nhận…' : 'Waiting for PayPal confirmation…') : (isVietnamese ? 'Không tìm thấy đơn thanh toán này. Vui lòng quay lại Premium và thử lại.' : 'We could not find this payment order. Please return to Premium and try again.'));
  const [isActivating, setIsActivating] = useState(false);
  const displayedMessage = paymentMessageTranslations[message]?.[isVietnamese ? 0 : 1] || message;

  useEffect(() => {
    if (!appTransId) {
      return;
    }

    let isActive = true;
    let attempts = 0;
    let timer: number | undefined;
    const checkStatus = async () => {
      try {
        const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
        const paypalToken = new URLSearchParams(window.location.search).get('token') || new URLSearchParams(hashQuery).get('token');
        const result = paypalToken && paypalToken === appTransId
          ? await capturePayPalOrder(paypalToken)
          : await getPayPalPaymentStatus(appTransId);
        if (!isActive) return;
        if (result.licenseKey) {
          setLicenseKey(result.licenseKey);
          setStatus('paid');
          setMessage(isVietnameseRef.current ? 'Đã xác nhận thanh toán. Mã Premium của bạn đã sẵn sàng.' : 'Payment confirmed. Your Premium license is ready.');
          return;
        }
        attempts += 1;
        if (attempts >= 20) {
          setStatus('error');
          setMessage(isVietnameseRef.current ? 'Thanh toán vẫn đang được xác nhận. Vui lòng quay lại sau ít phút.' : 'Payment is still being confirmed. Please return here in a moment.');
          return;
        }
        timer = window.setTimeout(checkStatus, 2000);
      } catch (error) {
        if (!isActive) return;
        setStatus('error');
        setMessage(error instanceof Error ? error.message : isVietnameseRef.current ? 'Không thể kiểm tra trạng thái thanh toán.' : 'Unable to check payment status');
      }
    };
    void checkStatus();
    return () => {
      isActive = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [appTransId]);

  const handleActivate = async () => {
    if (!licenseKey || isActivating) return;
    setIsActivating(true);
    setMessage(isVietnamese ? 'Đang kích hoạt giấy phép Premium…' : 'Activating your Premium license…');
    try {
      await activatePremiumLicense(licenseKey);
      sessionStorage.removeItem('zen-paypal-order-id');
      onActivated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : isVietnamese ? 'Không thể kích hoạt Premium.' : 'Unable to activate Premium');
      setIsActivating(false);
    }
  };

  return <div className="payment-page">
    <header className="payment-header">
      <button type="button" className="payment-back" onClick={onBack} aria-label={isVietnamese ? 'Quay lại luyện tập' : 'Back to practice'} title={isVietnamese ? 'Quay lại luyện tập' : 'Back to practice'}>←</button>
      <a className="logo payment-logo logo-link" href="#" onClick={event => { event.preventDefault(); onBack(); }}>Zen Dictation</a>
    </header>
    <main className="payment-result-content">
      <section className={`payment-result-card payment-result-${status}`} aria-live="polite">
        <span className="premium-kicker">{status === 'paid' ? (isVietnamese ? 'Thanh toán hoàn tất' : 'Payment complete') : status === 'error' ? (isVietnamese ? 'Cập nhật thanh toán' : 'Payment update') : (isVietnamese ? 'Đang kiểm tra thanh toán' : 'Checking payment')}</span>
        <h1>{status === 'paid' ? (isVietnamese ? 'Chào mừng đến với Premium.' : 'Welcome to Premium.') : status === 'error' ? (isVietnamese ? 'Sắp hoàn tất.' : 'Almost there.') : (isVietnamese ? 'Đang xác nhận thanh toán…' : 'Confirming your payment…')}</h1>
        <p>{displayedMessage}</p>
        {status === 'paid' && <p><strong>{isVietnamese ? 'Cảm ơn bạn đã mua hàng. Chúng tôi rất trân trọng sự ủng hộ của bạn.' : 'Thank you for your purchase. We truly appreciate your support.'}</strong></p>}
        {status === 'checking' && <div className="payment-loader" aria-label={isVietnamese ? 'Đang kiểm tra trạng thái thanh toán' : 'Checking payment status'} />}
        {status === 'paid' && <>
          <label className="license-reveal">{isVietnamese ? 'Mã giấy phép của bạn' : 'Your license key'}<input value={licenseKey} readOnly aria-label={isVietnamese ? 'Mã giấy phép Premium' : 'Premium license key'} /></label>
          <button type="button" className="checkout-button checkout-next" onClick={() => void handleActivate()} disabled={!licenseKey || isActivating} aria-busy={isActivating}>{isActivating ? (isVietnamese ? 'Đang kích hoạt Premium…' : 'Activating Premium…') : (isVietnamese ? 'Kích hoạt giấy phép' : 'Activate this license')}</button>
        </>}
        <button type="button" className="license-button" onClick={onBack}>{status === 'paid' ? (isVietnamese ? 'Tôi sẽ kích hoạt sau' : 'I will activate later') : (isVietnamese ? 'Quay lại luyện tập' : 'Return to practice')}</button>
      </section>
      <PrivacyNotice />
    </main>
  </div>;
};

const PaymentFlow = ({ onBack, onLicenseClick }: PaymentPageProps) => {
  const isVietnamese = useAppLanguage().language === 'vi';
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const startPayPalCheckout = async () => {
    setIsCreatingOrder(true);
    setPaymentError('');
    try {
      const order = await createPayPalOrder(email);
      sessionStorage.setItem('zen-paypal-order-id', order.appTransId);
      window.location.assign(order.orderUrl);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : isVietnamese ? 'Không thể bắt đầu thanh toán.' : 'Unable to start payment');
      setIsCreatingOrder(false);
    }
  };

  if (isCheckoutOpen) {
    return <div className="payment-page">
      <header className="payment-header">
        <button type="button" className="payment-back" onClick={() => setIsCheckoutOpen(false)} aria-label={isVietnamese ? 'Quay lại bảng giá' : 'Back to pricing'} title={isVietnamese ? 'Quay lại bảng giá' : 'Back to pricing'}>←</button>
        <a className="logo payment-logo logo-link" href="#" onClick={event => { event.preventDefault(); onBack(); }}>Zen Dictation</a>
      </header>
      <main className="checkout-content">
        <div className="checkout-intro"><span className="premium-kicker">{isVietnamese ? 'Thanh toán an toàn' : 'Secure checkout'}</span><h1>{isVietnamese ? 'Premium của bạn, thanh toán một lần.' : 'Your Premium, one simple payment.'}</h1><p>{isVietnamese ? 'Sau khi xác nhận thanh toán, chúng tôi sẽ tạo mã giấy phép cho bạn. Không cần tài khoản.' : 'After payment is confirmed, we will generate a license key for you. No account is required.'}</p></div>
        <section className="checkout-card" aria-label={isVietnamese ? 'Thông tin thanh toán' : 'Checkout summary'}>
          <div className="checkout-card-header"><span>Zen Dictation Premium</span><strong>$4</strong></div>
          <span className="checkout-subtitle">{isVietnamese ? 'Truy cập trọn đời · Thanh toán một lần' : 'Lifetime access · One-time payment'}</span>
          <label className="receipt-email">{isVietnamese ? 'Email nhận biên lai' : 'Email for your receipt'} <span>{isVietnamese ? 'không bắt buộc' : 'optional'}</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
          <div className="checkout-security"><span aria-hidden="true">▣</span><span><strong>{isVietnamese ? 'Thanh toán qua cổng bảo mật' : 'Secure hosted payment'}</strong><small>{isVietnamese ? 'Nhà cung cấp dịch vụ thanh toán xử lý thông tin thẻ; Zen Dictation không lưu thông tin này.' : 'Your card details will be handled by our payment provider, never stored in Zen Dictation.'}</small></span></div>
          <button type="button" className="checkout-button checkout-next" onClick={startPayPalCheckout} disabled={isCreatingOrder}>{isCreatingOrder ? (isVietnamese ? 'Đang mở PayPal…' : 'Opening PayPal…') : (isVietnamese ? 'Thanh toán an toàn qua PayPal' : 'Pay securely with PayPal')}</button>
          {paymentError && <p className="payment-error" role="alert">{paymentError}</p>}
          <button type="button" className="license-button" onClick={onLicenseClick}>{isVietnamese ? 'Đã thanh toán? Nhập mã giấy phép' : 'Already paid? Enter your license key'}</button>
        </section>
        <p className="payment-note">{isVietnamese ? 'Bạn sẽ được chuyển đến PayPal để hoàn tất thanh toán. Email không bắt buộc và chỉ dùng để gửi biên lai.' : 'You will be redirected to PayPal to complete the payment. Your email is optional and is only used for the receipt.'}</p>
        <PrivacyNotice />
      </main>
    </div>;
  }

  return (
  <div className="payment-page">
    <header className="payment-header">
      <button type="button" className="payment-back" onClick={onBack} aria-label={isVietnamese ? 'Quay lại luyện tập' : 'Back to practice'} title={isVietnamese ? 'Quay lại luyện tập' : 'Back to practice'}>←</button>
      <a className="logo payment-logo logo-link" href="#" onClick={event => { event.preventDefault(); onBack(); }}>Zen Dictation</a>
    </header>
    <main className="payment-content">
      <div className="payment-intro">
        <span className="premium-kicker">{isVietnamese ? 'Quyền truy cập Premium' : 'Premium access'}</span>
        <h1>{isVietnamese ? 'Tận dụng tối đa mỗi phiên luyện tập.' : 'Make every practice session count.'}</h1>
        <p>{isVietnamese ? 'Mở khóa công cụ giúp theo dõi tiến độ, duy trì thói quen và thử sức với câu khó hơn.' : 'Unlock the tools that help you see progress, build consistency, and take on harder sentences.'}</p>
      </div>
      <section className="price-card" aria-label={isVietnamese ? 'Giá Premium' : 'Premium pricing'}>
        <div className="price-card-top"><span className="premium-kicker">{isVietnamese ? 'Truy cập trọn đời' : 'Lifetime access'}</span><span className="price-badge">{isVietnamese ? 'Thanh toán một lần' : 'One-time payment'}</span></div>
        <h2>Zen Dictation Premium</h2>
        <div className="price"><del>$20</del><strong>$4</strong><span>{isVietnamese ? 'một lần' : 'one-time'}</span></div>
        <span className="discount-badge">{isVietnamese ? 'Tiết kiệm $16 · Ưu đãi có hạn' : 'Save $16 · Limited offer'}</span>
        <ul className="price-features">
          <li>{isVietnamese ? 'Mở khóa trình độ Trung bình và Khó' : 'Unlock Medium and Hard level'}</li>
          <li>{isVietnamese ? 'Bảng theo dõi tiến độ cá nhân' : 'Personal progress dashboard'}</li>
          <li>{isVietnamese ? 'Lịch sử luyện tập và theo dõi độ chính xác' : 'Practice history and accuracy tracking'}</li>
          <li>{isVietnamese ? 'Mục tiêu WPM hằng ngày và chuỗi ngày học' : 'Daily WPM goals and learning streaks'}</li>
          <li>{isVietnamese ? 'Không gia hạn định kỳ' : 'No recurring subscription'}</li>
          <li>{isVietnamese ? 'Có chế độ tập trung' : 'Focus mode included'}</li>
        </ul>
        <button type="button" className="checkout-button" onClick={() => setIsCheckoutOpen(true)}>{isVietnamese ? 'Tiếp tục thanh toán' : 'Continue to checkout'}</button>
        <button type="button" className="license-button" onClick={onLicenseClick}>{isVietnamese ? 'Bạn đã có mã giấy phép?' : 'Already have a license key?'}</button>
      </section>
      {/* <p className="payment-note">Your Premium license will work without creating an account. An account is optional for syncing your progress across devices.</p> */}
      <PrivacyNotice />
    </main>
  </div>
  );
};

export default PaymentPage;
