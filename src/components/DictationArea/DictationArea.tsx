import { useMemo, useRef, useState } from 'react';
import { getFeedback } from '../../utils/textUtils';
import './DictationArea.css';

interface DictationAreaProps {
  targetText: string;
  onComplete: () => void;
  onNext?: () => void;
  onTypingChange?: (value: string) => void;
  isHidden?: boolean;
  disabled?: boolean;
}

const DictationArea: React.FC<DictationAreaProps> = ({ targetText, onComplete, onNext, onTypingChange, isHidden = false, disabled = false }) => {
  const [userInput, setUserInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const feedback = useMemo(() => getFeedback(targetText, userInput), [targetText, userInput]);
  const isComplete = userInput.length === targetText.length && userInput.toLowerCase() === targetText.toLowerCase();
  const shouldHidePrompt = isHidden && !isComplete;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const value = e.target.value;
    if (value.length > targetText.length) {
      return;
    }

    setUserInput(value);
    onTypingChange?.(value);

    if (value.length === targetText.length && value.toLowerCase() === targetText.toLowerCase()) {
      onComplete();
    }
  };

  const handleAreaClick = () => {
    if (disabled) return;
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || disabled) {
      return;
    }

    if (isComplete && onNext) {
      e.preventDefault();
      onNext();
    }
  };

  return (
    <div className="dictation-container" onClick={handleAreaClick}>
      <div className={`feedback-display ${shouldHidePrompt ? 'hidden' : ''}`}>
        {feedback.map((item, index) => (
          <span 
            key={index} 
            className={`char ${item.status} ${item.char === ' ' ? 'space' : ''}`}
          >
            {item.char === ' ' ? '\u00A0' : item.char}
          </span>
        ))}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={userInput}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="hidden-input"
        autoFocus
        spellCheck={false}
        autoComplete="off"
        disabled={disabled}
      />
    </div>
  );
};

export default DictationArea;
