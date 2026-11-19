import { useState } from 'react';
import { getTelegramMessageUrl } from '../../services/telegramService';
import './BankQrPayment.css';
import { useAppLanguage } from '../../context/useAppLanguage';

interface BankQrPaymentProps { mode?: 'support' | 'premium'; }

const BankQrPayment = ({ mode = 'support' }: BankQrPaymentProps) => {
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
  const transferNote = mode === 'premium' ? 'ZEN PREMIUM' : (import.meta.env.VITE_BANK_TRANSFER_NOTE as string | undefined) || 'Buy ZENTATION a coffee';
  const telegramUrl = getTelegramMessageUrl(import.meta.env.VITE_TELEGRAM_URL, mode === 'premium'
    ? `Xin chào, tôi đã chuyển khoản mua Zen Dictation Premium. Nội dung: ${transferNote}. Email tài khoản (nếu có): ____. Vui lòng xác nhận và gửi mã license Premium giúp tôi.`
    : `Xin chào, tôi đã chuyển khoản ủng hộ Zen Dictation. Nội dung: ${transferNote}. Vui lòng xác nhận khoản ủng hộ này giúp tôi.`);
  const handleQrError = () => {
    if (qrSrc !== fallbackQrUrl) setQrState({ url: qrUrl, src: fallbackQrUrl });
  };

  return <div className="bank-qr-payment">
    <img className="bank-qr-image" src={qrSrc} alt={isVietnamese ? 'Mã QR chuyển khoản ngân hàng' : 'Bank transfer QR'} onError={handleQrError} />
    <p className="bank-qr-title">{mode === 'premium' ? (isVietnamese ? 'Quét mã để mua Premium trọn đời · 100.000vnđ' : 'Scan to buy lifetime Premium · $4') : (isVietnamese ? 'Mời cà phê qua chuyển khoản ngân hàng' : 'Buy me a coffee via bank transfer')}</p>
    <dl className="bank-details"><div><dt>{isVietnamese ? 'Ngân hàng' : 'Bank'}</dt><dd>{bankName}</dd></div><div><dt>{isVietnamese ? 'Tài khoản' : 'Account'}</dt><dd>{accountNumber}</dd></div><div><dt>{isVietnamese ? 'Nội dung chuyển khoản' : 'Transfer note'}</dt><dd>{transferNote}</dd></div></dl>
    {telegramUrl && <a className="bank-confirm-button" href={telegramUrl} target="_blank" rel="noopener noreferrer">{mode === 'premium' ? (isVietnamese ? 'Đã chuyển khoản — Nhận mã Premium qua Telegram' : 'Transferred — Request Premium key on Telegram') : (isVietnamese ? 'Tôi đã chuyển khoản — Liên hệ Telegram' : 'I’ve completed the transfer — Contact Telegram')}</a>}
    <p className="bank-qr-note">{mode === 'premium' ? (isVietnamese ? 'Sau khi chuyển khoản, gửi xác nhận qua Telegram để nhận mã license. Ghi đúng nội dung chuyển khoản ở trên.' : 'After transferring, message us on Telegram with your payment confirmation to receive a license key. Use the exact transfer note above.') : (isVietnamese ? 'Cảm ơn bạn đã ủng hộ Zen Dictation! Khoản đóng góp của bạn là động lực lớn cho đội ngũ phát triển.' : 'Thank you for supporting Zen Dictation! Your contribution is a big motivation for our development team.')}</p>
  </div>;
};

export default BankQrPayment;
