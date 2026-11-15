import './PrivacyNotice.css';
import { useAppLanguage } from '../../context/useAppLanguage';

export default function PrivacyNotice() {
  const isVietnamese = useAppLanguage().language === 'vi';
  return <p className="privacy-notice">{isVietnamese ? 'Tìm hiểu cách chúng tôi xử lý dữ liệu trong ' : 'Read how your data is handled in our '}<a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noopener noreferrer">{isVietnamese ? 'Chính sách quyền riêng tư' : 'Privacy Policy'}<span className="privacy-new-tab">{isVietnamese ? ' (mở trong tab mới)' : ' (opens in a new tab)'}</span></a>.</p>;
}
