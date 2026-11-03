import './PrivacyPage.css';
import PageHeader from '../PageHeader/PageHeader';

const sections = [
  ['about', 'Bạn có thể liên hệ với ai?'],
  ['data', 'Ứng dụng lưu những gì?'],
  ['purpose', 'Thông tin được dùng để làm gì?'],
  ['storage', 'Thông tin lưu trên điện thoại, máy tính'],
  ['providers', 'Những dịch vụ cùng tham gia'],
  ['retention', 'Thông tin được giữ bao lâu?'],
  ['rights', 'Bạn có thể xem, sửa hoặc xóa thông tin'],
  ['children', 'Dành cho người dùng nhỏ tuổi'],
  ['changes', 'Khi chính sách thay đổi'],
];

export default function PrivacyPage() {
  const telegram = (import.meta.env.VITE_TELEGRAM_URL as string | undefined)?.trim();
  const contactUrl = telegram && /^https:\/\/t\.me\//i.test(telegram) ? telegram : undefined;

  return <div className="privacy-page" lang="vi">
    <a className="privacy-skip" href="#privacy-content">Đến nội dung chính</a>
    <PageHeader backLabel="Về luyện tập" />
    <main id="privacy-content" className="privacy-content">
      <div className="privacy-intro">
        <span className="privacy-eyebrow">PRIVACY POLICY</span>
        <h1>Chính sách<br />quyền riêng tư</h1>
        <p>Khi bạn luyện nghe cùng Zentation, ứng dụng lưu những gì? Ai có thể nhận thông tin đó? Trang này giải thích để bạn dễ theo dõi và lựa chọn.</p>
        <p className="privacy-date">Cập nhật ngày <time dateTime="2026-11-03">03/11/2026</time></p>
      </div>
      <aside className="privacy-summary" aria-label="Thông tin chính">
        <strong>Những điều bạn cần biết</strong>
        <p>Câu đang gõ và cài đặt được lưu trên thiết bị của bạn. Khi đăng nhập, tiến độ học được lưu thêm vào tài khoản để dùng trên thiết bị khác. Nếu muốn xem, sửa hoặc xóa thông tin, bạn có thể nhắn cho chúng tôi qua Telegram.</p>
      </aside>
      <nav className="privacy-toc" aria-label="Mục lục chính sách">
        {sections.map(([id, title], index) => <a key={id} href={`#${id}`}><span>{String(index + 1).padStart(2, '0')}</span>{title}</a>)}
      </nav>
      <article className="privacy-article">
        <section id="about">
          <h2>01. Bạn có thể liên hệ với ai?</h2>
          <p>Zentation là ứng dụng luyện nghe tiếng Anh, còn có tên Zen Dictation trên một số màn hình. Người vận hành Zentation quản lý thông tin tài khoản và tiến độ học được gửi đến hệ thống của ứng dụng.</p>
          <p>Nếu có câu hỏi hoặc muốn xem, sửa, xóa thông tin của mình, hãy nhắn qua Telegram bên dưới. Đây cũng là liên kết Contact trong menu ứng dụng.</p>
          {contactUrl ? <a className="privacy-contact" href={contactUrl} target="_blank" rel="noopener noreferrer">Liên hệ Zentation qua Telegram ↗</a> : <p>Vui lòng sử dụng liên kết Contact trong menu ứng dụng để liên hệ người vận hành.</p>}
        </section>
        <section id="data">
          <h2>02. Ứng dụng lưu những gì?</h2>
          <ul>
            <li><strong>Tài khoản:</strong> email, mã tài khoản, ngày đăng ký và trạng thái Premium. Khi bạn nhập mật khẩu, hệ thống dùng mật khẩu để kiểm tra đăng nhập. Bản mật khẩu được lưu là một chuỗi kiểm tra đặc biệt, không phải nguyên văn mật khẩu bạn nhập.</li>
            <li><strong>Việc học:</strong> ngày luyện tập, cấp độ, tốc độ gõ, độ chính xác, từ cần ôn, ghi chú, điểm và mục tiêu học. Một phần được lưu trên thiết bị; khi đăng nhập, lịch sử và tiến độ được lưu thêm vào tài khoản.</li>
            <li><strong>Mua Premium:</strong> mã đơn hàng, số tiền, thời điểm và kết quả thanh toán, mã kích hoạt và email nếu bạn cung cấp. Ứng dụng cũng tạo một mã ngẫu nhiên để nhận ra trình duyệt đã kích hoạt Premium; đây không phải số định danh phần cứng của điện thoại.</li>
            <li><strong>Khi cần hỗ trợ:</strong> những gì bạn gửi qua Telegram. Hệ thống chạy ứng dụng cũng có thể ghi lại địa chỉ kết nối Internet (IP), các lần truy cập và lỗi gặp phải để giữ dịch vụ hoạt động và ngăn lạm dụng.</li>
          </ul>
          <p>Tính năng luyện nghe hiện tại đọc câu cho bạn nghe. Ứng dụng không cần bật micro hoặc ghi âm giọng nói của bạn.</p>
        </section>
        <section id="purpose">
          <h2>03. Thông tin được dùng để làm gì?</h2>
          <p>Để bạn đăng nhập, lấy lại mật khẩu, tiếp tục việc học trên thiết bị khác, ôn lại từ hay sai và sử dụng Premium đã mua. Thông tin cũng giúp chúng tôi hỗ trợ bạn, tìm lỗi và ngăn việc dùng ứng dụng sai mục đích.</p>
          <p>Bạn không cần cung cấp email nếu chỉ dùng phần luyện tập không yêu cầu tài khoản.</p>
        </section>
        <section id="storage">
          <h2>04. Thông tin lưu trên điện thoại, máy tính</h2>
          <p>Trình duyệt lưu một ít thông tin để nhớ bạn đã đăng nhập, giữ câu đang gõ và nhớ cài đặt như giọng đọc, số lần đọc, khoảng nghỉ và màu giao diện.</p>
          <p>Thông tin giữ đăng nhập có hạn tối đa 30 ngày. Một số thông tin chỉ lưu trong tab đang mở; phần khác còn trên thiết bị cho đến khi bạn xóa dữ liệu trang web hoặc ứng dụng tự thay thế chúng.</p>
          <p>Bạn có thể xóa dữ liệu của Zentation trong cài đặt trình duyệt. Việc này có thể làm mất câu đang gõ, đăng xuất hoặc khiến thiết bị không còn nhận ra Premium. Thông tin đã lưu vào tài khoản vẫn còn trên hệ thống. Hiện ứng dụng không gắn công cụ quảng cáo hay công cụ theo dõi cách bạn dùng từng trang.</p>
        </section>
        <section id="providers">
          <h2>05. Những dịch vụ cùng tham gia</h2>
          <ul>
            <li><strong>Dịch vụ chạy và lưu trữ ứng dụng:</strong> giúp lưu tài khoản, tiến độ học và thông tin giao dịch để Zentation hoạt động.</li>
            <li><strong>PayPal:</strong> bạn thanh toán trên trang của PayPal. Zentation nhận kết quả giao dịch; bạn không nhập số thẻ hay mã bảo mật thẻ vào biểu mẫu của Zentation. Xem <a href="https://www.paypal.com/vn/legalhub/paypal/privacy-full" target="_blank" rel="noopener noreferrer">chính sách của PayPal</a>.</li>
            {/* <li><strong>Brevo:</strong> giúp gửi email lấy lại mật khẩu và mã kích hoạt Premium khi tính năng gửi email được bật. Xem <a href="https://www.brevo.com/legal/privacypolicy/" target="_blank" rel="noopener noreferrer">chính sách của Brevo</a>.</li> */}
            <li><strong>Dịch vụ giọng đọc:</strong> trình duyệt hoặc điện thoại nhận câu để đọc thành tiếng. Có giọng đọc ngay trên máy, có giọng cần gửi câu qua Internet. Vì vậy, không phải mọi giọng đều dùng được khi mất mạng.</li>
            <li><strong>Telegram và ngân hàng:</strong> khi nhắn hỗ trợ hoặc chuyển khoản, thông tin bạn cung cấp còn được dùng theo chính sách của các dịch vụ đó. Nếu ảnh mã QR được tải từ một dịch vụ khác, dịch vụ đó có thể nhận thông tin về lần tải ảnh.</li>
          </ul>
          <p>Một số dịch vụ có hệ thống đặt ngoài Việt Nam, nên thông tin có thể được lưu hoặc sử dụng tại nước khác. Việc này phải tuân theo luật liên quan.</p>
        </section>
        <section id="retention">
          <h2>06. Thông tin được giữ bao lâu?</h2>
          <p>Thông tin tài khoản, việc học và Premium được giữ để bạn tiếp tục sử dụng. Hiện hệ thống chưa tự xóa toàn bộ tài khoản sau một khoảng thời gian cố định. Nếu muốn xóa, bạn hãy nhắn qua Telegram ở mục 01.</p>
          <p>Lần đăng nhập có hạn tối đa 30 ngày. Liên kết lấy lại mật khẩu chỉ dùng một lần và hết hạn sau 30 phút. Một số thông tin thanh toán có thể vẫn cần giữ để kiểm tra giao dịch, giải quyết khiếu nại hoặc đáp ứng yêu cầu của luật, kể cả khi bạn yêu cầu xóa tài khoản.</p>
          <p>Chúng tôi bảo vệ mật khẩu và giới hạn quyền truy cập vào hệ thống. Tuy nhiên, bạn đừng gửi mật khẩu, mã đăng nhập hay thông tin thẻ cho bất kỳ ai khác.</p>
        </section>
        <section id="rights">
          <h2>07. Bạn có thể xem, sửa hoặc xóa thông tin</h2>
          <p>Theo luật áp dụng, bạn có thể yêu cầu biết ứng dụng đang lưu gì về mình, nhận bản sao, sửa thông tin sai hoặc yêu cầu xóa. Bạn cũng có thể yêu cầu giới hạn hoặc ngừng dùng thông tin.</p>
          <p>Cách làm: nhắn Telegram ở mục 01, cho biết email tài khoản và việc bạn muốn thực hiện. Chúng tôi có thể cần kiểm tra tài khoản có đúng là của bạn không. Hiện chưa có nút tự xóa tài khoản; yêu cầu sẽ được xem xét theo luật, gồm cả những trường hợp cần giữ lại một phần thông tin.</p>
          <p>Đăng xuất, xóa dữ liệu trình duyệt hoặc ngừng dùng ứng dụng không tự xóa thông tin đã lưu vào tài khoản. Nếu bạn không muốn tiếp tục cho phép dùng một loại thông tin, một số tính năng cần thông tin đó có thể không hoạt động nữa.</p>
        </section>
        <section id="children">
          <h2>08. Dành cho người dùng nhỏ tuổi</h2>
          <p>Nếu bạn chưa đủ 18 tuổi, hãy nhờ cha mẹ hoặc người giám hộ hướng dẫn trước khi đăng ký, gửi thông tin cá nhân hoặc thanh toán. Khi luật yêu cầu cha mẹ hoặc người giám hộ đồng ý, chúng tôi phải đáp ứng yêu cầu đó. Cha mẹ hoặc người giám hộ có thể nhắn Telegram để yêu cầu xem, sửa hoặc xóa thông tin của con.</p>
        </section>
        <section id="changes">
          <h2>09. Khi chính sách thay đổi</h2>
          <p>Khi ứng dụng, dịch vụ đi kèm hoặc luật thay đổi, chúng tôi có thể sửa trang này. Ngày cập nhật luôn được ghi ở đầu trang. Nếu thay đổi cần thông báo riêng hoặc cần bạn đồng ý lại theo luật, chúng tôi sẽ thực hiện trước khi dùng thông tin theo cách mới.</p>
        </section>
      </article>
    </main>
    <footer className="privacy-footer"><span>Zentation · Quyền riêng tư</span><a href="./">Trở về luyện tập →</a></footer>
  </div>;
}
