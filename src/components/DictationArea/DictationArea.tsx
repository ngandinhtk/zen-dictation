import { useEffect, useMemo, useRef, useState } from 'react';
import { getFeedback, type CharFeedback } from '../../utils/textUtils';
import { soundService } from '../../services/soundService';
import './DictationArea.css';

interface DictationAreaProps {
  targetText: string;
  onComplete: (value?: string, correctCharacters?: number) => void;
  onFinish?: (value: string, correctCharacters: number, isComplete: boolean) => void;
  onNext?: () => void;
  onTypingChange?: (value: string) => boolean | void;
  isHidden?: boolean;
  disabled?: boolean;
}

const DictationArea: React.FC<DictationAreaProps> = ({ targetText, onComplete, onFinish, onNext, onTypingChange, isHidden = false, disabled = false }) => {
  const draftKey = `zen-dictation-draft:${encodeURIComponent(targetText)}`;
  const [userInput, setUserInput] = useState(() => {
    try {
      const draft = localStorage.getItem(draftKey) || '';
      // Finished drafts from older versions must not reopen as unsubmitted attempts.
      return draft.length >= targetText.length ? '' : draft;
    } catch {
      return '';
    }
  });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const perfectAttemptAwarded = useRef(false);
  useEffect(() => {
    if (userInput) onTypingChange?.(userInput);
    // Restore the timer/statistics once when a saved draft is loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  const shouldHidePrompt = isHidden && !isComplete;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || hasSubmitted) return;
    const value = e.target.value;
    if (value.length > targetText.length) {
      return;
    }
    // Check the deadline before accepting or grading a keystroke.
    if (onTypingChange?.(value) === false) return;

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
    setHasSubmitted(false);
    try {
      if (value) localStorage.setItem(draftKey, value);
      else localStorage.removeItem(draftKey);
    } catch {
      // Draft persistence is best-effort when storage is unavailable.
    }

    // A sentence-ending mark also finishes shorter answers with missing words.
    const sentenceEnded = /[.!?]["'\u201d\u2019)]*\s*$/.test(value.trimEnd()) && !targetText.toLowerCase().startsWith(value.toLowerCase());
    if (value.length === targetText.length || sentenceEnded) {
      const correct = value.toLowerCase() === targetText.toLowerCase();
      onFinish?.(value, getFeedback(targetText, value).filter(item => item.status === 'correct').length, correct);
      setHasSubmitted(true);
      try {
        localStorage.removeItem(draftKey);
      } catch { /* Best effort. */ }
      if (correct) soundService.playSuccess();
    }

    if (value.length === targetText.length && value.toLowerCase() === targetText.toLowerCase() && !perfectAttemptAwarded.current) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // Ignore storage failures; completion should never be blocked.
      }
      perfectAttemptAwarded.current = true;
      onComplete(value, targetText.length);
    }
  };

  const handleAreaClick = () => {
    if (disabled) return;
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || disabled || e.nativeEvent.isComposing || e.repeat) {
      return;
    }

    e.preventDefault();
    if (hasSubmitted) onNext?.();
  };

  return (
    <>
    <div className="dictation-container" onClick={handleAreaClick} role="group" aria-label="Dictation practice area">
      <div className={`feedback-display ${shouldHidePrompt ? 'hidden' : ''}`}>
        {wordGroups.map((group, groupIndex) => {
          const groupStartIndex = wordGroups.slice(0, groupIndex).reduce((total, currentGroup) => total + currentGroup.length, 0);
          return (
            <span key={groupIndex} className={group.length === 1 && group[0].char === ' ' ? 'word-space' : 'word-group'}>
              {group.map((item, index) => {
                const characterIndex = groupStartIndex + index;
                return (
                <span key={index} className={`char ${item.status} ${item.char === ' ' ? 'space' : ''}`}>
                    {characterIndex === userInput.length && <span className="typing-cursor" aria-hidden="true" />}
                    {item.char === ' ' ? '\u00A0' : item.char}
                  </span>
                );
              })}
            </span>
          );
        })}
        {userInput.length === targetText.length && <span className="typing-cursor" aria-hidden="true" />}
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
        readOnly={hasSubmitted}
      />
    </div>
    </>
  );
};

export default DictationArea;
