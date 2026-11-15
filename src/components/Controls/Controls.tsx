import './Controls.css';
import type { AppLanguage } from '../../utils/appLanguage';

interface ControlsProps {
  language: AppLanguage;
  onReplay: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}

const Controls: React.FC<ControlsProps> = ({ language, onReplay, onNext, nextDisabled = false }) => {
  const isVietnamese = language === 'vi';
  return (
    <div className="controls-container" aria-label={isVietnamese ? 'Điều khiển luyện tập' : 'Practice controls'}>
      <div className="main-actions">
        <button type="button" className="action-btn replay" onPointerDown={event => { if (event.isPrimary && event.button === 0) event.preventDefault(); }} onClick={onReplay} aria-label={isVietnamese ? 'Nghe lại câu' : 'Listen to the sentence again'}>
          {isVietnamese ? 'Nghe lại' : 'Replay'} (Ctrl)
        </button>
        <button type="button" className="action-btn next" disabled={nextDisabled} onPointerDown={event => { if (event.isPrimary && event.button === 0) event.preventDefault(); }} onClick={onNext} aria-label={isVietnamese ? 'Chuyển sang câu tiếp theo' : 'Go to the next sentence'}>
          {isVietnamese ? 'Tiếp theo' : 'Next'} (Enter)
        </button>
      </div>
    </div>
  );
};

export default Controls;
