import './Controls.css';

interface ControlsProps {
  onReplay: () => void;
  onNext: () => void;
}

const Controls: React.FC<ControlsProps> = ({ onReplay, onNext }) => {
  return (
    <div className="controls-container" aria-label="Practice controls">
      <div className="main-actions">
        <button type="button" className="action-btn replay" onClick={onReplay} aria-label="Listen to the sentence again">
          Listen Again (Ctrl)
        </button>
        <button type="button" className="action-btn next" onClick={onNext} aria-label="Go to the next sentence">
          Next Sentence
        </button>
      </div>
    </div>
  );
};

export default Controls;
