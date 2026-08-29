import { useState, useEffect, useRef } from 'react';
import { getFeedback } from '../../utils/textUtils';
import type { CharFeedback } from '../../utils/textUtils';
import './DictationArea.css';

interface DictationAreaProps {
  targetText: string;
  onComplete: () => void;
  onNext?: () => void;
  onTypingChange?: (value: string) => void;
  isHidden?: boolean;
}

const DictationArea: React.FC<DictationAreaProps> = ({ targetText, onComplete, onNext, onTypingChange, isHidden = false }) => {
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<CharFeedback[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const newFeedback = getFeedback(targetText, userInput);
    setFeedback(newFeedback);

    if (userInput.length === targetText.length && userInput.toLowerCase() === targetText.toLowerCase()) {
      onComplete();
    }
  }, [userInput, targetText, onComplete]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= targetText.length) {
      setUserInput(value);
      onTypingChange?.(value);
    }
  };

  const handleAreaClick = () => {
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') {
      return;
    }

    const isCorrect = userInput.length === targetText.length && userInput.toLowerCase() === targetText.toLowerCase();

    if (isCorrect && onNext) {
      e.preventDefault();
      onNext();
    }
  };

  return (
    <div className="dictation-container" onClick={handleAreaClick}>
      <div className={`feedback-display ${isHidden ? 'hidden' : ''}`}>
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
      />
    </div>
  );
};

export default DictationArea;
