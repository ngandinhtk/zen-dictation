import { useState } from 'react';
import { getTelegramMessageUrl } from '../../services/telegramService';
import './BankQrPayment.css';
import { useAppLanguage } from '../../context/useAppLanguage';

const BankQrPayment = () => {
  const isVietnamese = useAppLanguage().language === 'vi';
  const fallbackQrUrl = '/bank-qr.jpg';
  const configuredQrUrl = import.meta.env.VITE_BANK_QR_URL as string | undefined;
  const trimmedQrUrl = configuredQrUrl?.trim();
  const qrUrl = trimmedQrUrl && trimmedQrUrl !== '/' && !trimmedQrUrl.includes('your-domain.example')
    ? trimmedQrUrl
    : fallbackQrUrl;
  const [qrState, setQrState] = useState({ url: qrUrl, src: qrUrl });
  const qrSrc = qrState.url === qrUrl ? qrState.src : qrUrl;
  const bankName = (import.meta.env.VITE_BANK_NAME as string | undefined) || 'Ban Viet Bank (Timo Bank)';
  const accountNumber = (import.meta.env.VITE_BANK_ACCOUNT_NUMBER as string | undefined) || '0908045090';
  const transferNote = (import.meta.env.VITE_BANK_TRANSFER_NOTE as string | undefined) || 'Buy ZENTATION a coffee';
  const telegramUrl = getTelegramMessageUrl(import.meta.env.VITE_TELEGRAM_URL, `Xin chào, tôi đã chuyển khoản ủng hộ Zen Dictation. Nội dung: ${transferNote}. Vui lòng xác nhận khoản ủng hộ này giúp tôi.`);
  const handleQrError = () => {
    if (qrSrc !== fallbackQrUrl) setQrState({ url: qrUrl, src: fallbackQrUrl });
  };

  return <div className="bank-qr-payment">
    <img className="bank-qr-image" src={qrSrc} alt={isVietnamese ? 'Mã QR chuyển khoản ngân hàng' : 'Bank transfer QR'} onError={handleQrError} />
    <p className="bank-qr-title">{isVietnamese ? 'Mời cà phê qua chuyển khoản ngân hàng' : 'Buy me a coffee via bank transfer'}</p>
    <dl className="bank-details"><div><dt>{isVietnamese ? 'Ngân hàng' : 'Bank'}</dt><dd>{bankName}</dd></div><div><dt>{isVietnamese ? 'Tài khoản' : 'Account'}</dt><dd>{accountNumber}</dd></div><div><dt>{isVietnamese ? 'Nội dung chuyển khoản' : 'Transfer note'}</dt><dd>{transferNote}</dd></div></dl>
    {telegramUrl && <a className="bank-confirm-button" href={telegramUrl} target="_blank" rel="noopener noreferrer">{isVietnamese ? 'Tôi đã chuyển khoản — Liên hệ Telegram' : 'I’ve completed the transfer — Contact Telegram'}</a>}
    <p className="bank-qr-note">{isVietnamese ? 'Cảm ơn bạn đã ủng hộ Zen Dictation! Khoản đóng góp này độc lập với giao dịch mua Premium tự động.' : 'Thank you for supporting Zen Dictation! This contribution is separate from the automatic Premium purchase.'}</p>
  </div>;
};

export default BankQrPayment;
