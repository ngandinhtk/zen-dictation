import './PageHeader.css';

interface PageHeaderProps {
  onBack?: () => void;
  backHref?: string;
  backLabel?: string;
}

export default function PageHeader({ onBack, backHref = './', backLabel = 'Back to practice' }: PageHeaderProps) {
  return <header className="page-header">
    {onBack
      ? <button type="button" className="page-header-back" onClick={onBack} aria-label={backLabel} title={backLabel}>←</button>
      : <a className="page-header-back" href={backHref} aria-label={backLabel} title={backLabel}>←</a>}
    <a className="page-header-brand" href={backHref} onClick={onBack ? event => { event.preventDefault(); onBack(); } : undefined}>Zen Dictation</a>
  </header>;
}
