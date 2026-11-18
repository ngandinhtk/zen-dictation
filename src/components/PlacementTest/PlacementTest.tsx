import { useEffect, useRef, useState } from 'react';
import { useAppLanguage } from '../../context/useAppLanguage';
import { speechService } from '../../services/speechService';
import { getAccountLearningState, savePlacementResult } from '../../services/accountService';
import { mergeLearningStates, readLearningState } from '../../services/learningCoach';
import { getWordAlignment } from '../../utils/textUtils';
import PageHeader from '../PageHeader/PageHeader';
import { createPlacementQuestions, skills, type Question } from './placementQuestions';
import './PlacementTest.css';

interface Recognition {
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}

const speechWindow = window as Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
const RecognitionEngine = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
const words = (text: string) => text.toLowerCase().match(/[a-z]+/g) ?? [];

function scoreAnswer(questionSet: Question[], index: number, answer: string | undefined) {
  if (!answer?.trim()) return null;
  const question = questionSet[index];
  const input = words(answer);
  if (question.skill !== 'speaking') {
    return question.answers.some(expected => words(expected).join(' ') === input.join(' ')) ? 100 : 0;
  }
  const target = words(question.answers[0]);
  const { missingWords, extraWords, incorrectWords } = getWordAlignment(target, input);
  const errors = missingWords.length + extraWords.length + incorrectWords.length;
  return Math.max(0, Math.round(100 * (1 - errors / target.length)));
}

export default function PlacementTest() {
  const { language } = useAppLanguage();
  const t = (vi: string, en: string) => language === 'vi' ? vi : en;
  const labels = { listening: t('Nghe', 'Listening'), speaking: t('Nói', 'Speaking'), writing: t('Viết', 'Writing') };
  const [questions, setQuestions] = useState(() => {
    const state = readLearningState();
    return createPlacementQuestions([
      ...state.attempts.map(item => item.text),
      ...state.reviews.map(item => item.text),
    ]);
  });
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [energy, setEnergy] = useState<number>();
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [signInRequired, setSignInRequired] = useState(false);
  const [savedEmail, setSavedEmail] = useState('');
  const [audioStatus, setAudioStatus] = useState(() => speechService.getStatus());
  const activeRecognition = useRef<Recognition | null>(null);
  const saveStarted = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const question = questions[step - 1];
  const audio = question?.audio;
  const finished = step > questions.length;
  const answer = answers[step - 1] ?? '';

  useEffect(() => {
    const unsubscribe = speechService.subscribeToStatus(setAudioStatus);
    return () => {
      unsubscribe();
      speechService.stop();
      const recognition = activeRecognition.current;
      activeRecognition.current = null;
      recognition?.abort();
    };
  }, []);

  useEffect(() => {
    let active = true;
    void getAccountLearningState().then(accountState => {
      if (!active || !accountState?.coach_state) return;
      const merged = mergeLearningStates(readLearningState(), accountState.coach_state);
      setQuestions(createPlacementQuestions([
        ...merged.attempts.map(item => item.text),
        ...merged.reviews.map(item => item.text),
      ]));
    }).catch(() => {
      // Signed-out users and unavailable accounts still use local learning history.
    });
    return () => { active = false; };
  }, []);

  function saveAnswer(value: string) {
    setAnswers(previous => ({ ...previous, [step - 1]: value }));
  }

  async function saveResult(answersToSave: Record<number, string>) {
    setSaveStatus('saving');
    setSaveError('');
    try {
      const questionScores = questions.map((_, index) => scoreAnswer(questions, index, answersToSave[index]));
      const response = await savePlacementResult(questionScores);
      setSavedEmail(response.user.email);
      setSaveStatus('saved');
    } catch (error) {
      const needsLogin = error instanceof Error && error.message === 'Please sign in to continue';
      setSignInRequired(needsLogin);
      setSaveError(needsLogin
        ? t('Hãy đăng nhập tài khoản trong ứng dụng, quay lại đây rồi thử lưu lại.', 'Sign in to your account in the app, return here, and try saving again.')
        : t('Chưa thể lưu kết quả. Hãy kiểm tra kết nối rồi thử lại.', 'The result could not be saved. Check your connection and try again.'));
      setSaveStatus('error');
    }
  }

  function move(next: number) {
    const recognition = activeRecognition.current;
    activeRecognition.current = null;
    recognition?.abort();
    speechService.stop();
    setRecording(false);
    setNotice('');
    setStep(next);
    if (next > questions.length && !saveStarted.current) {
      saveStarted.current = true;
      void saveResult(answers);
    }
    heading.current?.focus();
  }

  function record() {
    if (!RecognitionEngine || activeRecognition.current) return;
    setNotice('');
    try {
      const recognition = new RecognitionEngine();
      activeRecognition.current = recognition;
      recognition.lang = 'en-US';
      recognition.onresult = event => {
        if (activeRecognition.current !== recognition) return;
        const transcript = event.results[0]?.[0]?.transcript.trim();
        if (transcript) saveAnswer(transcript.slice(0, 500));
      };
      recognition.onerror = event => {
        if (activeRecognition.current !== recognition) return;
        setNotice(event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? t('Hãy kiểm tra quyền micro rồi thử lại.', 'Check microphone permissions and try again.')
          : t('Chưa nhận được lời nói. Hãy thử lại.', 'Speech could not be recognized. Try again.'));
      };
      recognition.onend = () => {
        if (activeRecognition.current !== recognition) return;
        activeRecognition.current = null;
        setRecording(false);
      };
      recognition.start();
      setRecording(true);
    } catch {
      activeRecognition.current = null;
      setNotice(t('Không thể bật micro. Hãy thử lại.', 'The microphone could not start. Try again.'));
    }
  }

  const scores = skills.map(skill => {
    const items = questions.flatMap((item, index) => item.skill === skill ? [scoreAnswer(questions, index, answers[index])] : []);
    const completed = items.filter((score): score is number => score !== null);
    return {
      skill,
      count: completed.length,
      total: items.length,
      score: items.length ? Math.round(items.reduce<number>((sum, score) => sum + (score ?? 0), 0) / items.length) : 0,
    };
  });
  const totalScore = Math.round(scores.reduce((sum, item) => sum + item.score, 0) / scores.length);
  const priority = scores
    .sort((a, b) => a.score - b.score)[0];

  return (
    <main className="placement-page">
      <PageHeader backHref={window.location.pathname} backLabel={t('Quay lại luyện tập', 'Back to practice')} />
      <div className="placement-heading">
        <h1 ref={heading} tabIndex={-1}>{finished ? t('Kết quả đầu vào', 'Placement results') : t('Kiểm tra đầu vào', 'Placement test')}</h1>
      </div>

      {step === 0 && <section className="placement-card">
        <h2>{t('Bạn đang ở đâu với tiếng Anh?', 'Where are you with English?')}</h2>
        <p>{t('Làm 15 câu để ước lượng khả năng nghe hiểu, đọc thành tiếng và viết câu.', 'Answer 15 questions to gauge listening comprehension, reading aloud, and sentence writing.')}</p>
        <div className="placement-grid">
          {skills.map(skill => <div className="placement-tile" key={skill}><strong>{labels[skill]}</strong><span>{t('5 câu', '5 questions')}</span></div>)}
        </div>
        <button type="button" onClick={() => move(1)}>{t('Bắt đầu', 'Start test')}</button>
      </section>}

      {question && <section className={`placement-card${question.skill === 'listening' ? ' placement-listening' : ''}`} aria-labelledby="placement-question">
        <div className="placement-progress">
          <strong>{labels[question.skill]}</strong>
          <span>{t('Câu', 'Question')} {step}/{questions.length}</span>
        </div>
        <progress value={step} max={questions.length} aria-label={t('Tiến độ bài kiểm tra', 'Test progress')} />
        {audio && <>
          <div className="placement-listening-player">
            <button type="button" className="placement-play" onClick={() => speechService.speak(audio, 'en-US', 1, undefined, 1, 1000, true)}>
              <span aria-hidden="true">{audioStatus === 'speaking' ? 'Ⅱ' : '▶'}</span>
              <span>{audioStatus === 'speaking' ? t('Đang phát…', 'Playing…') : t('Nghe câu hỏi', 'Listen to the question')}</span>
            </button>
          </div>
          <h2 id="placement-question" lang="en">{question.prompt || t('Nghe xong rồi chọn câu trả lời', 'Listen, then choose the answer')}</h2>
          {(audioStatus === 'error' || audioStatus === 'unsupported') && <p role="status">{t('Thiết bị chưa phát được tiếng Anh. Bạn có thể thử lại hoặc bỏ qua câu này.', 'English audio could not play. Try again or skip this question.')}</p>}
          <div className="placement-choices" role="group" aria-labelledby="placement-question">
            {question.choices?.map(choice => <label key={choice} lang="en">
              <input type="radio" name="placement-answer" checked={answer === choice} onChange={() => saveAnswer(choice)} /> {choice}
            </label>)}
          </div>
        </>}
        {!audio && <h2 id="placement-question" lang="en">{question.prompt}</h2>}
        {question.skill === 'speaking' && <>
          <p>{t('Bật micro rồi đọc câu trên. Trình duyệt có thể gửi âm thanh đến dịch vụ nhận dạng giọng nói.', 'Start the microphone and read the sentence aloud. Your browser may send audio to its speech recognition service.')}</p>
          {RecognitionEngine
            ? <button type="button" className="placement-secondary" onClick={() => recording ? move(step) : record()}>{recording ? t('Hủy ghi âm', 'Cancel recording') : answer ? t('Nói lại', 'Try again') : t('Bật micro', 'Start microphone')}</button>
            : <p>{t('Trình duyệt này chưa hỗ trợ nhận dạng giọng nói. Bạn có thể bỏ qua câu hoặc thử trình duyệt khác.', 'This browser lacks speech recognition support. You can skip the question or try another browser.')}</p>}
          <p role="status">{recording ? t('Đang nghe…', 'Listening…') : notice || (answer && <>{t('Đã nhận dạng', 'Recognized speech')} <q lang="en">{answer}</q></>)}</p>
        </>}
        {question.skill === 'writing' && <label className="placement-writing">
          {t('Câu trả lời bằng tiếng Anh', 'Your answer in English')}
          <textarea lang="en" rows={3} maxLength={500} value={answer} onChange={event => saveAnswer(event.target.value)} />
        </label>}
        <div className="placement-actions">
          {step > 1 && <button type="button" className="placement-secondary" onClick={() => move(step - 1)}>{t('Câu trước', 'Previous')}</button>}
          <button type="button" disabled={recording} onClick={() => move(step + 1)}>
            {step === questions.length ? t('Xem kết quả', 'See results') : answer.trim() ? t('Câu tiếp theo', 'Next question') : t('Bỏ qua câu', 'Skip question')}
          </button>
        </div>
      </section>}

      {finished && <>
        <section className="placement-card">
          <h2>{t('Điểm theo kỹ năng', 'Results by skill')}</h2>
          <p><strong>{t('Tổng điểm', 'Overall score')} · {totalScore}%</strong> ({t('trên 15 câu; câu bỏ qua tính 0 điểm', 'out of 15 questions; skipped questions score 0')})</p>
          <div className="placement-grid">
            {scores.map(item => <div className="placement-tile" key={item.skill}>
              <strong>{labels[item.skill]}</strong>
              <b>{item.score}%</b>
              <span>{t('Đã trả lời', 'Answered')} {item.count}/{item.total}</span>
            </div>)}
          </div>
          <p>{t('Điểm từng kỹ năng là trung bình trên 5 câu, câu bỏ qua tính 0. Phần nói dựa trên độ khớp của lời nhận dạng, phần viết dựa trên các đáp án mẫu.', 'Each skill score is averaged across 5 questions, with skipped questions counted as zero. Speaking measures transcript agreement and writing uses model answers.')}</p>
          <p role={saveStatus === 'error' ? 'alert' : 'status'}>
            {saveStatus === 'saving' && t('Đang lưu kết quả vào tài khoản…', 'Saving the result to your account…')}
            {saveStatus === 'saved' && t(`Đã lưu vào tài khoản ${savedEmail}.`, `Saved to account ${savedEmail}.`)}
            {saveStatus === 'error' && saveError}
          </p>
          {signInRequired && <a className="placement-secondary" href={window.location.pathname} target="_blank" rel="noopener noreferrer">{t('Mở ứng dụng để đăng nhập', 'Open the app to sign in')}</a>}
          {saveStatus === 'error' && <button type="button" className="placement-secondary" onClick={() => void saveResult(answers)}>{t('Thử lưu lại', 'Try saving again')}</button>}
          <details>
            <summary>{t('Xem lại câu trả lời và đáp án', 'Review answers')}</summary>
            <ol className="placement-review">
              {questions.map((item, index) => <li key={index}>
                <strong lang="en">{item.prompt}</strong>
                {item.audio && <div lang="en">{item.audio}</div>}
                <div>{t('Bạn trả lời', 'Your answer')} · <span lang={answers[index]?.trim() ? 'en' : undefined}>{answers[index]?.trim() || t('Bỏ qua', 'Skipped')}</span></div>
                <div>{t('Đáp án mẫu', 'Model answer')} · <span lang="en">{item.answers.join(' / ')}</span></div>
                {answers[index]?.trim() && <div>{scoreAnswer(questions, index, answers[index])}%</div>}
              </li>)}
            </ol>
          </details>
        </section>
        <section className="placement-card">
          <h2 id="placement-energy">{t('Năng lượng sau bài kiểm tra', 'Energy after the test')}</h2>
          <p>{t('Bạn còn bao nhiêu năng lượng để luyện tập hôm nay?', 'How much energy do you have left to practise today?')}</p>
          <div className="placement-energy" role="group" aria-labelledby="placement-energy">
            {[t('Thấp', 'Low'), t('Vừa', 'Medium'), t('Cao', 'High')].map((label, index) => (
              <button type="button" className="placement-secondary" key={index} aria-pressed={energy === index} onClick={() => setEnergy(index)}>{label}</button>
            ))}
          </div>
          {energy !== undefined && <p className="placement-plan" role="status">
            {energy === 0
              ? t('Nghỉ một chút rồi xem lại một câu trong 5 phút.', 'Take a break, then spend 5 minutes reviewing one question.')
              : priority
                ? (energy === 1 ? t('Luyện 10 phút kỹ năng', 'Spend 10 minutes practising') : t('Luyện 20 phút kỹ năng', 'Spend 20 minutes practising')) + ' ' + labels[priority.skill].toLowerCase() + '.'
                : t('Thử làm một phần của bài kiểm tra để có gợi ý theo kỹ năng.', 'Complete one section to get a skill-based suggestion.')}
          </p>}
          <button type="button" className="placement-secondary" onClick={() => {
            const state = readLearningState();
            setQuestions(createPlacementQuestions([
              ...state.attempts.map(item => item.text),
              ...state.reviews.map(item => item.text),
            ]));
            setAnswers({});
            setEnergy(undefined);
            setSaveStatus('idle');
            setSaveError('');
            setSignInRequired(false);
            setSavedEmail('');
            saveStarted.current = false;
            move(0);
          }}>{t('Làm lại bài kiểm tra', 'Retake test')}</button>
        </section>
      </>}
    </main>
  );
}
