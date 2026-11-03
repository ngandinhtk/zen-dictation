import './Controls.css';

interface ControlsProps {
  onReplay: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}

const Controls: React.FC<ControlsProps> = ({ onReplay, onNext, nextDisabled = false }) => {
  return (
    <div className="controls-container" aria-label="Practice controls">
      <div className="main-actions">
        <button type="button" className="action-btn replay" onPointerDown={event => { if (event.isPrimary && event.button === 0) event.preventDefault(); }} onClick={onReplay} aria-label="Listen to the sentence again">
          Replay (Ctrl)
        </button>
        <button type="button" className="action-btn next" disabled={nextDisabled} onPointerDown={event => { if (event.isPrimary && event.button === 0) event.preventDefault(); }} onClick={onNext} aria-label="Go to the next sentence">
          Next (Enter)
        </button>
      </div>
    </div>
  );
};

export default Controls;
