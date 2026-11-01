const clean = text => text.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16))).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

export function parseTimedCaptions(raw) {
  let cues;
  try {
    const data = JSON.parse(raw);
    cues = (data.events || []).map(event => ({
      text: (event.segs || []).map(segment => segment.utf8 || '').join(''),
      start: Number(event.tStartMs) / 1000,
      duration: Number(event.dDurationMs) / 1000,
    }));
  } catch {
    cues = [...raw.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map(match => ({
      text: match[2], start: Number(match[1].match(/\bstart="([\d.]+)"/)?.[1] ?? NaN),
      duration: Number(match[1].match(/\bdur="([\d.]+)"/)?.[1] ?? NaN),
    }));
    if (!cues.length) cues = [...raw.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)].map(match => ({
      text: match[2], start: Number(match[1].match(/\bt="([\d.]+)"/)?.[1] ?? NaN) / 1000,
      duration: Number(match[1].match(/\bd="([\d.]+)"/)?.[1] ?? NaN) / 1000,
    }));
  }
  cues = cues.map(cue => ({ ...cue, text: clean(cue.text) }))
    .filter(cue => cue.text && Number.isFinite(cue.start) && cue.start >= 0 && Number.isFinite(cue.duration) && cue.duration > 0)
    .sort((a, b) => a.start - b.start);
  const sentences = [];
  let current;
  const flush = () => { if (current) sentences.push(current); current = undefined; };
  for (let index = 0; index < cues.length; index++) {
    const cue = cues[index];
    const next = cues[index + 1];
    const end = next && next.start > cue.start ? Math.min(cue.start + cue.duration, next.start) : cue.start + cue.duration;
    if (current && (cue.start - current.end > 1.5 || end - current.start > 15 || `${current.text} ${cue.text}`.split(/\s+/).length > 40)) flush();
    if (!current) current = { text: cue.text, start: cue.start, end };
    else { current.text += ` ${cue.text}`; current.end = Math.max(current.end, end); }
    if (/[.!?]["'”’)]*$/.test(cue.text)) flush();
  }
  flush();
  return sentences;
}
