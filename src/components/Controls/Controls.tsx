import './Controls.css';

interface ControlsProps {
  onReplay: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  onNext: () => void;
}

const Controls: React.FC<ControlsProps> = ({ onReplay, speed, onSpeedChange, onNext }) => {
  const speeds = [0.5, 0.75, 1, 1.25];

  return (
    <div className="controls-container">
      <div className="speed-selector">
        {speeds.map((s) => (
          <button
            key={s}
            className={`speed-btn ${speed === s ? 'active' : ''}`}
            onClick={() => onSpeedChange(s)}
          >
            {s}x
          </button>
        ))}
      </div>
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
