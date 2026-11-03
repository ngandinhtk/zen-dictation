import { useEffect } from 'react';

export default function PrivacyLanguageSelect({ language }: { language: 'en' | 'vi' }) {
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === 'en' ? 'Privacy Policy · Zentation' : 'Chính sách quyền riêng tư · Zentation';
    document.querySelector('meta[name="description"]')?.setAttribute('content', language === 'en'
      ? 'Zentation Privacy Policy: account information, learning progress, payments and requests concerning your personal information.'
      : 'Chính sách quyền riêng tư của Zentation: thông tin tài khoản, tiến độ học, thanh toán và cách yêu cầu xử lý dữ liệu cá nhân.');
  }, [language]);

  return <label className="privacy-languages">
    <span>{language === 'en' ? 'Language' : 'Ngôn ngữ'}</span>
    <select value={language} onChange={event => {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', event.target.value);
      window.location.assign(url.href);
    }}>
      <option value="en" lang="en">English</option>
      <option value="vi" lang="vi">Tiếng Việt</option>
    </select>
  </label>;
}
