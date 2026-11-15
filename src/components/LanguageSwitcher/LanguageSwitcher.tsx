import { useAppLanguage } from '../../context/useAppLanguage';
import './LanguageSwitcher.css';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useAppLanguage();
  const isVietnamese = language === 'vi';

  return <div className="site-footer-controls">
    <a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noopener noreferrer">{isVietnamese ? 'Chính sách quyền riêng tư ↗' : 'Privacy Policy ↗'}</a>
    <label className="language-switcher">
      <span>{isVietnamese ? 'Ngôn ngữ' : 'Language'}</span>
      <select id="app-language" aria-label={isVietnamese ? 'Chọn ngôn ngữ' : 'Choose language'} value={language} onChange={event => setLanguage(event.target.value === 'vi' ? 'vi' : 'en')}>
        <option value="en">English</option>
        <option value="vi">Tiếng Việt</option>
      </select>
    </label>
  </div>;
}
