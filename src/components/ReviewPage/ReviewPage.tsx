import { useState } from 'react';
import type { ReviewWord } from '../../services/spacedRepetitionService';
import type { AppLanguage } from '../../utils/appLanguage';
import './ReviewPage.css';
import PageHeader from '../PageHeader/PageHeader';

interface ReviewPageProps {
  language: AppLanguage;
  words: ReviewWord[];
  onAddWord: (word: string) => void;
  onUpdateWord: (currentWord: string, nextWord: string, note: string) => void;
  onRemoveWord: (word: string) => void;
  onPracticeWord: (word: string) => void | Promise<void>;
  practiceError: string;
  initialWord?: string;
  onBack: () => void;
}

const ReviewPage = ({ language, words, onAddWord, onUpdateWord, onPracticeWord, practiceError, initialWord, onBack }: ReviewPageProps) => {
  const isVietnamese = language === 'vi';
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
  const orderedWords = scopedWords;
  const dueWords = orderedWords.filter(word => word.correctStreak < 4 || new Date(word.nextReviewAt).getTime() <= reviewNow);
  const formatNextReview = (word: ReviewWord, isDue: boolean) => {
    if (isDue) return isVietnamese ? 'Đến hạn ôn tập' : 'Ready to review';
    const date = new Date(word.nextReviewAt);
    return `${isVietnamese ? 'Ôn tiếp vào' : 'Next review'} ${date.toLocaleDateString(isVietnamese ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric' })}`;
  };
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
      setInputError(isVietnamese ? 'Chỉ nhập một từ tiếng Anh.' : 'Enter one English word only.');
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
      setEditError(isVietnamese ? 'Chỉ nhập một từ tiếng Anh.' : 'Enter one English word only.');
      return;
    }
    if (words.some(word => word.word === nextWord && word.word !== currentWord)) {
      setEditError(isVietnamese ? 'Từ này đã có trong danh sách ôn tập.' : 'That word is already in your review list.');
      return;
    }
    onUpdateWord(currentWord, nextWord, editNote);
    setEditingWord(null);
    setEditError('');
  };

  return <div className="review-page">
    <PageHeader onBack={onBack} backLabel={isVietnamese ? 'Quay lại luyện tập' : undefined} />
    <main className="review-content">
      <div className="review-intro">
        <span className="premium-kicker">{isVietnamese ? 'Ôn tập ngắt quãng' : 'Spaced repetition'}</span>
        <h1>{selectedWord ? (isVietnamese ? `Ôn tập “${selectedWord}”.` : `Review “${selectedWord}”.`) : isVietnamese ? 'Từ cần ôn tập.' : 'Review your words.'}</h1>
        <p>{isVietnamese ? 'Tiếp tục luyện những từ bạn cần chú ý hơn. Các từ đến hạn sẽ xuất hiện trong câu luyện tập tiếp theo.' : 'Keep practicing the words that need more attention. Due words will be brought back into your next practice sentences.'}</p>
      </div>
      <div className="review-overview" aria-label={isVietnamese ? 'Tổng quan ôn tập' : 'Review summary'}>
        <div><strong>{scopedWords.length}</strong><span>{isVietnamese ? 'Từ đang theo dõi' : 'Words tracked'}</span></div>
        <div><strong>{dueWords.length}</strong><span>{isVietnamese ? 'Đến hạn' : 'Due now'}</span></div>
      </div>
      <form className="review-add-form" onSubmit={handleAddWord}>
        <label htmlFor="review-word-input">{isVietnamese ? 'Thêm từ cần ôn tập' : 'Add a word to review'}</label>
        <div><input id="review-word-input" value={newWord} onChange={event => { setNewWord(event.target.value); setInputError(''); }} placeholder={isVietnamese ? 'ví dụ: accurate' : 'e.g. accurate'} autoComplete="off" /><button type="submit">{isVietnamese ? 'Thêm từ' : 'Add word'}</button></div>
        {inputError && <small role="alert">{inputError}</small>}
      </form>
      {scopedWords.length === 0 ? (
        <section className="review-empty">
          <span className="review-empty-icon" aria-hidden="true">✦</span>
          <h2>{isVietnamese ? 'Danh sách ôn tập đang trống.' : 'Your review list is empty.'}</h2>
          <p>{isVietnamese ? 'Các từ bạn mắc lỗi khi luyện tập sẽ xuất hiện ở đây.' : 'Complete a practice sentence with mistakes and the words will appear here.'}</p>
        </section>
      ) : (
        <section className="review-list-card" aria-label={isVietnamese ? 'Danh sách từ cần ôn' : 'Words to review'}>
          <div className="review-list-heading"><h2>{isVietnamese ? 'Từ cần luyện tập' : 'Words to practice'}</h2><span>{dueWords.length ? (isVietnamese ? 'Bắt đầu với từ đến hạn' : 'Start with the due words') : (isVietnamese ? 'Chưa có từ đến hạn' : 'Nothing due right now')}</span></div>
          {practiceError && <p className="review-practice-error" role="alert">{practiceError}</p>}
          <div className="review-list">
            {visibleWords.map(word => {
              const isDue = word.correctStreak < 4 || new Date(word.nextReviewAt).getTime() <= reviewNow;
              return <article className={`review-card ${isDue ? 'is-due' : ''}`} key={word.word}>
                <div className="review-card-details">{editingWord === word.word ? <form className="review-edit-form" onSubmit={event => handleEditWord(event, word.word)}>
                  <input aria-label={isVietnamese ? 'Từ' : 'Word'} value={editValue} onChange={event => { setEditValue(event.target.value); setEditError(''); }} autoFocus />
                  <input aria-label={isVietnamese ? 'Ghi chú' : 'Note'} value={editNote} onChange={event => setEditNote(event.target.value)} placeholder={isVietnamese ? 'Ghi chú (không bắt buộc)' : 'Optional note'} />
                  <div className="review-card-actions"><button type="submit" className="review-action secondary">{isVietnamese ? 'Lưu' : 'Save'}</button><button type="button" className="review-action" onClick={() => setEditingWord(null)}>{isVietnamese ? 'Hủy' : 'Cancel'}</button></div>
                  {editError && <small className="review-edit-error" role="alert">{editError}</small>}
                </form> : <><strong>{word.word}</strong><span>{isVietnamese ? `${word.mistakes} lần mắc lỗi` : `${word.mistakes} mistake${word.mistakes === 1 ? '' : 's'}`}</span>{word.note && <small className="review-card-note">{isVietnamese ? 'Ghi chú:' : 'Note:'} {word.note}</small>}<div className="review-card-actions"><button type="button" className="review-action" onClick={() => startEditing(word)}>{isVietnamese ? 'Sửa' : 'Edit'}</button></div></>}</div>
                <div className="review-card-status">
                  {isDue ? <button type="button" className="review-status-pill" onClick={() => void onPracticeWord(word.word)}>{isVietnamese ? 'Luyện ngay' : 'Practice now'}</button> : <span className="review-status-pill">{isVietnamese ? 'Chuỗi' : 'Streak'} {word.correctStreak}</span>}
                  <small>{formatNextReview(word, isDue)}</small>
                </div>
              </article>;
            })}
          </div>
          {pageCount > 1 && <nav className="review-pagination" aria-label={isVietnamese ? 'Các trang từ ôn tập' : 'Review word pages'}>
            <button type="button" onClick={() => setCurrentPage(page => Math.max(page - 1, 1))} disabled={safeCurrentPage === 1}>{isVietnamese ? 'Trước' : 'Previous'}</button>
            <span>{isVietnamese ? `Trang ${safeCurrentPage}/${pageCount}` : `Page ${safeCurrentPage} of ${pageCount}`}</span>
            <button type="button" onClick={() => setCurrentPage(page => Math.min(page + 1, pageCount))} disabled={safeCurrentPage === pageCount}>{isVietnamese ? 'Tiếp' : 'Next'}</button>
          </nav>}
        </section>
      )}
      <button type="button" className="review-primary-action" onClick={onBack}>{isVietnamese ? 'Quay lại luyện tập' : 'Back to practice'}</button>
    </main>
    <footer className="app-footer"><span>Zentation · {isVietnamese ? 'Luyện nghe tiếng Anh' : 'English listening practice'}</span></footer>
  </div>;
};

export default ReviewPage;
