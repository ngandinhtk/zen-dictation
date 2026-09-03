import { useState } from 'react';
import type { ReviewWord } from '../../services/spacedRepetitionService';
import './ReviewPage.css';

interface ReviewPageProps {
  words: ReviewWord[];
  onAddWord: (word: string) => void;
  onUpdateWord: (currentWord: string, nextWord: string, note: string) => void;
  onRemoveWord: (word: string) => void;
  onPracticeWord: (word: string) => void;
  initialWord?: string;
  onBack: () => void;
}

const ReviewPage = ({ words, onAddWord, onUpdateWord, onPracticeWord, initialWord, onBack }: ReviewPageProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const selectedWord = initialWord;
  const [reviewNow] = useState(() => Date.now());
  const [newWord, setNewWord] = useState('');
  const [inputError, setInputError] = useState('');
  const [editingWord, setEditingWord] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editError, setEditError] = useState('');
  const scopedWords = (selectedWord ? words.filter(word => word.word === selectedWord) : words).filter(word => word.correctStreak <= 8);
  const orderedWords = [...scopedWords].sort((a, b) => {
    const aDue = a.correctStreak < 4 || new Date(a.nextReviewAt).getTime() <= reviewNow;
    const bDue = b.correctStreak < 4 || new Date(b.nextReviewAt).getTime() <= reviewNow;

    if (aDue !== bDue) {
      return Number(bDue) - Number(aDue);
    }

    return new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime();
  });
  const dueWords = orderedWords.filter(word => word.correctStreak < 4 || new Date(word.nextReviewAt).getTime() <= reviewNow);
  const wordsPerPage = 10;
  const searchTerm = newWord.trim().toLowerCase();
  const matchingWords = searchTerm
    ? orderedWords.filter(word => word.word.toLowerCase().includes(searchTerm))
    : orderedWords;
  const pageCount = Math.max(1, Math.ceil(matchingWords.length / wordsPerPage));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const visibleWords = matchingWords.slice((safeCurrentPage - 1) * wordsPerPage, safeCurrentPage * wordsPerPage);
  const handleAddWord = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const word = newWord.trim();
    if (!/^[a-zA-Z']+$/.test(word)) {
      setInputError('Enter one English word only.');
      return;
    }
    onAddWord(word);
    setNewWord('');
    setInputError('');
    setCurrentPage(1);
  };
  const startEditing = (word: ReviewWord) => {
    setEditingWord(word.word);
    setEditValue(word.word);
    setEditNote(word.note || '');
    setEditError('');
  };
  const handleEditWord = (event: React.FormEvent<HTMLFormElement>, currentWord: string) => {
    event.preventDefault();
    const nextWord = editValue.trim().toLowerCase();
    if (!/^[a-zA-Z']+$/.test(nextWord)) {
      setEditError('Enter one English word only.');
      return;
    }
    if (words.some(word => word.word === nextWord && word.word !== currentWord)) {
      setEditError('That word is already in your review list.');
      return;
    }
    onUpdateWord(currentWord, nextWord, editNote);
    setEditingWord(null);
    setEditError('');
  };

  return <div className="review-page">
    <header className="review-page-header">
      <button type="button" className="review-back" onClick={onBack} aria-label="Back to practice" title="Back to practice">←</button>
      <span className="logo review-page-mark">Zen Dictation</span>
    </header>
    <main className="review-content">
      <div className="review-intro">
        <span className="premium-kicker">Spaced repetition</span>
        <h1>{selectedWord ? `Review “${selectedWord}”.` : 'Review your words.'}</h1>
        <p>Keep practicing the words that need more attention. Due words will be brought back into your next practice sentences.</p>
      </div>
      <div className="review-overview" aria-label="Review summary">
        <div><strong>{scopedWords.length}</strong><span>Words tracked</span></div>
        <div><strong>{dueWords.length}</strong><span>Due now</span></div>
      </div>
      <form className="review-add-form" onSubmit={handleAddWord}>
        <label htmlFor="review-word-input">Add a word to review</label>
        <div><input id="review-word-input" value={newWord} onChange={event => { setNewWord(event.target.value); setInputError(''); }} placeholder="e.g. accurate" autoComplete="off" /><button type="submit">Add word</button></div>
        {inputError && <small role="alert">{inputError}</small>}
      </form>
      {scopedWords.length === 0 ? (
        <section className="review-empty">
          <span className="review-empty-icon" aria-hidden="true">✦</span>
          <h2>Your review list is empty.</h2>
          <p>Complete a practice sentence with mistakes and the words will appear here.</p>
        </section>
      ) : (
        <section className="review-list-card" aria-label="Words to review">
          <div className="review-list-heading"><h2>Words to practice</h2><span>{dueWords.length ? 'Start with the due words' : 'Nothing due right now'}</span></div>
          <div className="review-list">
            {visibleWords.map(word => {
              const isDue = word.correctStreak < 4 || new Date(word.nextReviewAt).getTime() <= reviewNow;
              return <article className={`review-card ${isDue ? 'is-due' : ''}`} key={word.word}>
                <div className="review-card-details">{editingWord === word.word ? <form className="review-edit-form" onSubmit={event => handleEditWord(event, word.word)}>
                  <input aria-label="Word" value={editValue} onChange={event => { setEditValue(event.target.value); setEditError(''); }} autoFocus />
                  <input aria-label="Note" value={editNote} onChange={event => setEditNote(event.target.value)} placeholder="Optional note" />
                  <div className="review-card-actions"><button type="submit" className="review-action secondary">Save</button><button type="button" className="review-action" onClick={() => setEditingWord(null)}>Cancel</button></div>
                  {editError && <small className="review-edit-error" role="alert">{editError}</small>}
                </form> : <><strong>{word.word}</strong><span>{word.mistakes} mistake{word.mistakes === 1 ? '' : 's'}</span>{word.note && <small className="review-card-note">Note: {word.note}</small>}<div className="review-card-actions"><button type="button" className="review-action" onClick={() => startEditing(word)}>Edit</button></div></>}</div>
                <div className="review-card-status">
                  {isDue ? <button type="button" className="review-status-pill" onClick={() => onPracticeWord(word.word)}>Due now</button> : <span className="review-status-pill">Streak {word.correctStreak}</span>}
                  <small>{isDue ? 'Practice this word now' : 'Keep your streak going'}</small>
                </div>
              </article>;
            })}
          </div>
          {pageCount > 1 && <nav className="review-pagination" aria-label="Review word pages">
            <button type="button" onClick={() => setCurrentPage(page => Math.max(page - 1, 1))} disabled={safeCurrentPage === 1}>Previous</button>
            <span>Page {safeCurrentPage} of {pageCount}</span>
            <button type="button" onClick={() => setCurrentPage(page => Math.min(page + 1, pageCount))} disabled={safeCurrentPage === pageCount}>Next</button>
          </nav>}
        </section>
      )}
      <button type="button" className="review-primary-action" onClick={onBack}>Back to practice</button>
    </main>
  </div>;
};

export default ReviewPage;
