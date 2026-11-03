import PageHeader from '../PageHeader/PageHeader';
import PrivacyLanguageSelect from './PrivacyLanguageSelect';

const sections = [
  ['about', 'Who can you contact?'],
  ['data', 'What information does the app store?'],
  ['purpose', 'How is your information used?'],
  ['storage', 'Information stored on your device'],
  ['providers', 'Services involved'],
  ['retention', 'How long is information kept?'],
  ['rights', 'Access, correct or delete your information'],
  ['children', 'Younger users'],
  ['changes', 'Changes to this policy'],
];

export default function EnglishPrivacyPage() {
  const telegram = (import.meta.env.VITE_TELEGRAM_URL as string | undefined)?.trim();
  const contactUrl = telegram && /^https:\/\/t\.me\//i.test(telegram) ? telegram : undefined;

  return <div className="privacy-page" lang="en">
    <a className="privacy-skip" href="#privacy-content">Skip to main content</a>
    <PageHeader backLabel="Back to practice" />
    <main id="privacy-content" className="privacy-content">
      <PrivacyLanguageSelect language="en" />
      <div className="privacy-intro">
        <span className="privacy-eyebrow">PRIVACY POLICY</span>
        <h1>Privacy policy</h1>
        <p>When you practise listening with Zentation, what information does the app store? Who may receive it? This page explains how it works so you can make informed choices.</p>
        <p className="privacy-date">Last updated <time dateTime="2026-11-03">3 November 2026</time></p>
      </div>
      <aside className="privacy-summary" aria-label="Key information">
        <strong>What you need to know</strong>
        <p>Your current answer and settings are stored on your device. When you sign in, learning progress is also saved to your account for use on other devices. To access, correct or delete your information, contact us on Telegram.</p>
      </aside>
      <nav className="privacy-toc" aria-label="Policy contents">
        {sections.map(([id, title], index) => <a key={id} href={`#${id}`}><span>{String(index + 1).padStart(2, '0')}</span>{title}</a>)}
      </nav>
      <article className="privacy-article">
        <section id="about">
          <h2>01. Who can you contact?</h2>
          <p>Zentation is an English listening practice app, also called Zen Dictation on some screens. The operator of Zentation manages the account information and learning progress sent to the app’s systems.</p>
          <p>If you have questions or want to access, correct or delete your information, contact us through Telegram below. This is also the Contact link in the app menu.</p>
          {contactUrl ? <a className="privacy-contact" href={contactUrl} target="_blank" rel="noopener noreferrer">Contact Zentation on Telegram ↗</a> : <p>Please use the Contact link in the app menu to reach the operator.</p>}
        </section>
        <section id="data">
          <h2>02. What information does the app store?</h2>
          <ul>
            <li><strong>Account:</strong> your email address, account ID, registration date and Premium status. Your password is used to verify sign-in. The stored password is a special verification string, rather than the original password you enter.</li>
            <li><strong>Learning:</strong> practice dates, level, typing speed, accuracy, words to review, notes, scores and learning goals. Some information is stored on your device; when you sign in, history and progress are also saved to your account.</li>
            <li><strong>Premium purchases:</strong> order ID, amount, payment time and result, activation code and email address if you provide one. The app also generates a random identifier to recognise a browser with Premium activated; this is not your phone’s hardware identifier.</li>
            <li><strong>Support:</strong> information you send through Telegram. The systems running the app may also log Internet Protocol (IP) addresses, visits and errors to keep the service working and prevent abuse.</li>
          </ul>
          <p>The current listening practice feature reads sentences aloud. The app does not need to turn on your microphone or record your voice.</p>
        </section>
        <section id="purpose">
          <h2>03. How is your information used?</h2>
          <p>To let you sign in, reset your password, continue learning on another device, review words you often get wrong and use Premium you have purchased. Information also helps us support you, investigate errors and prevent misuse.</p>
          <p>You do not need to provide an email address to use practice features that do not require an account.</p>
        </section>
        <section id="storage">
          <h2>04. Information stored on your device</h2>
          <p>Your browser stores a small amount of information to keep you signed in, preserve your current answer and remember settings such as voice, repetitions, pauses and theme.</p>
          <p>Sign-in information lasts for up to 30 days. Some information is stored only in the open tab; other information stays on your device until you clear site data or the app replaces it.</p>
          <p>You can clear Zentation’s site data in your browser settings. This may remove your current answer, sign you out or stop the device from recognising Premium. Information saved to your account remains on the system. The app currently has no advertising tools or tools tracking how you use individual pages.</p>
        </section>
        <section id="providers">
          <h2>05. Services involved</h2>
          <ul>
            <li><strong>App hosting and storage services:</strong> store account information, learning progress and transaction information so Zentation can operate.</li>
            <li><strong>PayPal:</strong> you pay on PayPal’s website. Zentation receives the transaction result; you do not enter your card number or card security code into a Zentation form. See <a href="https://www.paypal.com/vn/legalhub/paypal/privacy-full" target="_blank" rel="noopener noreferrer">PayPal’s privacy policy</a>.</li>
            <li><strong>Speech services:</strong> your browser or phone receives sentences to read aloud. Some voices work on the device; others need to send sentences over the Internet. Not all voices are therefore available offline.</li>
            <li><strong>Telegram and banks:</strong> when you request support or make a bank transfer, information you provide is also handled under those services’ policies. If a QR code image is loaded from another service, that service may receive information about the image request.</li>
          </ul>
          <p>Some services have systems outside Vietnam, so information may be stored or processed in other countries. This must comply with applicable law.</p>
        </section>
        <section id="retention">
          <h2>06. How long is information kept?</h2>
          <p>Account, learning and Premium information is kept so you can continue using the app. The system currently does not automatically delete entire accounts after a fixed period. To request deletion, contact us on Telegram as described in section 01.</p>
          <p>Sign-in sessions last for up to 30 days. Password reset links can be used once and expire after 30 minutes. Some payment information may need to be retained to verify transactions, resolve disputes or meet legal requirements, even when you request account deletion.</p>
          <p>We protect passwords and restrict access to the system. Do not share your password, sign-in codes or card information with anyone else.</p>
        </section>
        <section id="rights">
          <h2>07. Access, correct or delete your information</h2>
          <p>Under applicable law, you may request details of information the app stores about you, receive a copy, correct inaccurate information or request deletion. You may also request restrictions on, or an end to, its use.</p>
          <p>Contact us on Telegram as described in section 01, providing your account email and explaining your request. We may need to verify that the account belongs to you. There is currently no self-service account deletion button; requests are reviewed under applicable law, including cases where some information must be retained.</p>
          <p>Signing out, clearing browser data or stopping use of the app does not automatically delete information saved to your account. If you no longer allow a particular type of information to be used, features that depend on it may stop working.</p>
        </section>
        <section id="children">
          <h2>08. Younger users</h2>
          <p>If you are under 18, ask a parent or guardian for guidance before registering, providing personal information or making a payment. Where the law requires parental or guardian consent, we must meet that requirement. Parents or guardians may contact us on Telegram to request access to, correction of or deletion of their child’s information.</p>
        </section>
        <section id="changes">
          <h2>09. Changes to this policy</h2>
          <p>We may update this page when the app, supporting services or laws change. The update date is always shown at the top. If the law requires a separate notice or renewed consent, we will provide it before using information in a new way.</p>
        </section>
      </article>
    </main>
    <footer className="privacy-footer"><span>Zentation · Privacy</span><a href="./">Back to practice →</a></footer>
  </div>;
}
