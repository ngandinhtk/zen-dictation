import { useState } from 'react';
import type { ReviewWord } from '../../services/spacedRepetitionService';
import './ReviewPage.css';

interface ReviewPageProps {
  words: ReviewWord[];
  onAddWord: (word: string) => void;
  onPracticeWord: (word: string) => void;
  initialWord?: string;
  onBack: () => void;
}

const ReviewPage = ({ words, onAddWord, onPracticeWord, initialWord, onBack }: ReviewPageProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const selectedWord = initialWord;
  const [reviewNow] = useState(() => Date.now());
  const [newWord, setNewWord] = useState('');
  const [inputError, setInputError] = useState('');
  const scopedWords = selectedWord ? words.filter(word => word.word === selectedWord) : words;
  const dueWords = scopedWords.filter(word => new Date(word.nextReviewAt).getTime() <= reviewNow);
  const wordsPerPage = 10;
  const pageCount = Math.max(1, Math.ceil(scopedWords.length / wordsPerPage));
  const visibleWords = scopedWords.slice((currentPage - 1) * wordsPerPage, currentPage * wordsPerPage);
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
              const isDue = new Date(word.nextReviewAt).getTime() <= reviewNow;
              return <article className={`review-card ${isDue ? 'is-due' : ''}`} key={word.word}>
                <div><strong>{word.word}</strong><span>{word.mistakes} mistake{word.mistakes === 1 ? '' : 's'}</span>{word.note && <small className="review-card-note">Note: {word.note}</small>}</div>
                <div className="review-card-status">{isDue ? <button type="button" className="review-status-pill" onClick={() => onPracticeWord(word.word)}>Due now</button> : <span className="review-status-pill">Streak {word.correctStreak}</span>}<small>{isDue ? 'Practice this word now' : 'Keep your streak going'}</small></div>
              </article>;
            })}
          </div>
          {pageCount > 1 && <nav className="review-pagination" aria-label="Review word pages">
            <button type="button" onClick={() => setCurrentPage(page => Math.max(page - 1, 1))} disabled={currentPage === 1}>Previous</button>
            <span>Page {currentPage} of {pageCount}</span>
            <button type="button" onClick={() => setCurrentPage(page => Math.min(page + 1, pageCount))} disabled={currentPage === pageCount}>Next</button>
          </nav>}
        </section>
      )}
      <button type="button" className="review-primary-action" onClick={onBack}>Back to practice</button>
    </main>
  </div>;
};

export default ReviewPage;
