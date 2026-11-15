import { useAppLanguage } from '../../context/useAppLanguage';
import './SiteNotice.css';

export default function SiteNotice() {
  const { language } = useAppLanguage();
  const isVietnamese = language === 'vi';

  return <aside className="site-notice" aria-label={isVietnamese ? 'Thông báo chuyển tên miền' : 'Domain change announcement'}>
    <p>
      {isVietnamese ? 'Thông báo: zentation.netlify.app sắp chuyển sang ' : 'Notice: zentation.netlify.app is moving to '}
      <a href="https://zendictation.io.vn" target="_blank" rel="noopener noreferrer">zendictation.io.vn</a>
      {isVietnamese ? '. Hãy cập nhật dấu trang của bạn.' : '. Please update your bookmark.'}
    </p>
  </aside>;
}
