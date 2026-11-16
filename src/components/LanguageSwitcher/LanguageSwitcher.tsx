import { useAppLanguage } from '../../context/useAppLanguage';
import './LanguageSwitcher.css';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useAppLanguage();
  const isVietnamese = language === 'vi';

  return <div className="site-footer-controls">
    <a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noopener noreferrer">{isVietnamese ? 'Chính sách quyền riêng tư ↗' : 'Privacy Policy ↗'}</a>
    <label className="language-switcher">
      {/* <span>{isVietnamese ? 'Ngôn ngữ' : 'Language'}</span> */}
      <div className="language-switcher-options" role="group" aria-label={isVietnamese ? 'Chọn ngôn ngữ' : 'Choose language'}>
        <button
          type="button"
          className="language-switcher-option"
          aria-label={isVietnamese ? 'Tiếng Anh' : 'English'}
          aria-pressed={language === 'en'}
          onClick={() => setLanguage('en')}
        >EN</button>
        <button
          type="button"
          className="language-switcher-option"
          aria-label={isVietnamese ? 'Tiếng Việt' : 'Vietnamese'}
          aria-pressed={language === 'vi'}
          onClick={() => setLanguage('vi')}
        >VI</button>
      </div>
    </label>
  </div>;
}
