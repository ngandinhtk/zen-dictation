import './Controls.css';

interface ControlsProps {
  onReplay: () => void;
  onNext: () => void;
}

const Controls: React.FC<ControlsProps> = ({ onReplay, onNext }) => {
  return (
    <div className="controls-container">
      <div className="main-actions">
        <button className="action-btn replay" onClick={onReplay}>
          Listen Again (Ctrl)
        </button>
        <button className="action-btn next" onClick={onNext}>
          Next Sentence
        </button>
      </div>
    </div>
  );
};

export default Controls;
