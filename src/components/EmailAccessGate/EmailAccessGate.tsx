import { useState, type FormEvent } from 'react';
import { useAppLanguage } from '../../context/useAppLanguage';
import { submitAccessEmail } from '../../services/accessEmailService';
import LanguageSwitcher from '../LanguageSwitcher/LanguageSwitcher';
// import PrivacyNotice from '../PrivacyPage/PrivacyNotice';
import SiteNotice from '../SiteNotice/SiteNotice';
import './EmailAccessGate.css';

interface EmailAccessGateProps {
  onAccessGranted: () => void;
}

export default function EmailAccessGate({ onAccessGranted }: EmailAccessGateProps) {
  const isVietnamese = useAppLanguage().language === 'vi';
  const [email, setEmail] = useState('');
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) {
      setError(isVietnamese ? 'Vui lòng nhập email hợp lệ.' : 'Enter a valid email address.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await submitAccessEmail(cleanEmail, sendWelcomeEmail, isVietnamese ? 'vi' : 'en');
      onAccessGranted();
    } catch (submitError) {
      setError(submitError instanceof Error && submitError.message === 'ACCESS_EMAIL_RATE_LIMITED'
        ? (isVietnamese ? 'Bạn đã thử quá nhiều lần. Vui lòng đợi một chút rồi thử lại.' : 'Too many attempts. Please wait a moment and try again.')
        : submitError instanceof Error && submitError.message === 'WELCOME_EMAIL_FAILED'
          ? (isVietnamese ? 'Chưa gửi được email mã Premium. Vui lòng thử lại hoặc bỏ chọn nhận mã để tiếp tục.' : 'We could not send your Premium code yet. Try again or uncheck the option to continue.')
        : (isVietnamese ? 'Không thể lưu email lúc này. Kiểm tra kết nối rồi thử lại.' : 'Unable to save your email. Check your connection and try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return <>
    <SiteNotice />
    <main className="email-access-page">
      <section className="email-access-card" aria-labelledby="email-access-title">
        <span className="email-access-brand">Zentation</span>
        <span className="email-access-kicker">{isVietnamese ? 'Chào mừng bạn' : 'Welcome'}</span>
        <h1 id="email-access-title">{isVietnamese ? 'Bắt đầu luyện tập' : 'Start practicing'}</h1>
        <p className="email-access-description">{isVietnamese ? 'Nhập email để mở ứng dụng và bắt đầu luyện nghe tiếng Anh.' : 'Enter your email to open the app and start English listening practice.'}</p>
        <form className="email-access-form" onSubmit={event => void handleSubmit(event)}>
          <label htmlFor="access-email">{isVietnamese ? 'Địa chỉ email' : 'Email address'}</label>
          <input
            id="access-email"
            type="email"
            value={email}
            onChange={event => { setEmail(event.target.value); setError(''); }}
            placeholder="you@example.com"
            autoComplete="email"
            maxLength={254}
            required
            autoFocus
            disabled={isSubmitting}
          />
          <label className="email-access-consent" htmlFor="access-email-premium-consent">
            <input
              id="access-email-premium-consent"
              type="checkbox"
              checked={sendWelcomeEmail}
              onChange={event => setSendWelcomeEmail(event.target.checked)}
              disabled={isSubmitting}
            />
            <span>{isVietnamese
              ? 'Tôi đồng ý nhận Email chào mừng kèm mã Premium miễn phí. Sẽ không có email quảng cáo nào khác.'
              : 'I agree to receive Welcome Eamil with free Premium code. No other marketing emails will be sent.'}</span>
          </label>
          {error && <p className="email-access-error" role="alert">{error}</p>}
          <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting
              ? (isVietnamese ? 'Đang xác nhận…' : 'Verifying…')
              : (isVietnamese ? 'Tiếp tục' : 'Continue')}
          </button>
        </form>
        {/* <p className="email-access-data-notice">
          {isVietnamese
            ? 'Email được lưu để ghi nhận quyền truy cập. Chỉ khi bạn chọn ô trên, chúng tôi mới dùng email để gửi một thư chào mừng có mã Premium.'
            : 'Your email is stored to record access. We will use it to send one welcome email with a Premium code only if you select the option above.'}
        </p> */}
        {/* <PrivacyNotice /> */}
        {/* <footer className="app-footer"><span>Zentation · {isVietnamese ? 'Luyện nghe tiếng Anh' : 'English listening practice'}</span></footer> */}
      </section>
    </main>
    <LanguageSwitcher />
  </>;
}
