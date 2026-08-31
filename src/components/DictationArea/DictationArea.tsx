import { useMemo, useRef, useState } from 'react';
import { getFeedback, type CharFeedback } from '../../utils/textUtils';
import { soundService } from '../../services/soundService';
import './DictationArea.css';

interface DictationAreaProps {
  targetText: string;
  onComplete: (value?: string, correctCharacters?: number) => void;
  onFinish?: (value: string, correctCharacters: number, isComplete: boolean) => void;
  onNext?: () => void;
  onTypingChange?: (value: string) => void;
  isHidden?: boolean;
  disabled?: boolean;
}

const DictationArea: React.FC<DictationAreaProps> = ({ targetText, onComplete, onFinish, onNext, onTypingChange, isHidden = false, disabled = false }) => {
  const [userInput, setUserInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const feedback = useMemo(() => getFeedback(targetText, userInput), [targetText, userInput]);
  const wordGroups = useMemo(() => {
    const groups: CharFeedback[][] = [];
    let word: CharFeedback[] = [];

    feedback.forEach(item => {
      if (item.char === ' ') {
        if (word.length > 0) groups.push(word);
        groups.push([item]);
        word = [];
      } else {
        word.push(item);
      }
    });

    if (word.length > 0) groups.push(word);
    return groups;
  }, [feedback]);
  const isComplete = userInput.length === targetText.length && userInput.toLowerCase() === targetText.toLowerCase();
  const isFinished = userInput.length === targetText.length;
  const shouldHidePrompt = isHidden && !isComplete;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const value = e.target.value;
    if (value.length > targetText.length) {
      return;
    }

    if (value.length > userInput.length) {
      soundService.playTyping();
      const typedIndex = value.length - 1;
      const typedChar = value[typedIndex];
      const targetChar = targetText[typedIndex];
      if (typedChar?.toLowerCase() !== targetChar?.toLowerCase()) {
        soundService.playWrong();
      }
    }

    setUserInput(value);
    onTypingChange?.(value);

    if (value.length === targetText.length && value.toLowerCase() === targetText.toLowerCase()) {
      onComplete(value, targetText.length);
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

    if (isFinished && onNext) {
      e.preventDefault();
      onFinish?.(userInput, feedback.filter(item => item.status === 'correct').length, isComplete);
      if (isComplete) soundService.playSuccess();
      onNext();
    }
  };

  return (
    <div className="dictation-container" onClick={handleAreaClick} role="group" aria-label="Dictation practice area">
      <div className={`feedback-display ${shouldHidePrompt ? 'hidden' : ''}`}>
        {wordGroups.map((group, groupIndex) => {
          return (
            <span key={groupIndex} className={group.length === 1 && group[0].char === ' ' ? 'word-space' : 'word-group'}>
              {group.map((item, index) => {
                return (
                  <span key={index} className={`char ${item.status} ${item.char === ' ' ? 'space' : ''}`}>
                    {item.char === ' ' ? '\u00A0' : item.char}
                  </span>
                );
              })}
            </span>
          );
        })}
      </div>
      {shouldHidePrompt && (
        <div className="typing-signal" aria-live="polite">
          <span className="typing-signal-dot" aria-hidden="true" />
          {userInput.length > 0 ? `Typing… ${userInput.length} characters` : 'Start typing…'}
        </div>
      )}
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
        aria-label="Type the sentence you hear"
        disabled={disabled}
      />
    </div>
  );
};

export default DictationArea;
