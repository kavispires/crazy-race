/** Thin wrapper around the browser's SpeechSynthesis API for narrating the action log aloud. */
import { CHARACTERS } from '../data/characters';

let cachedVoice: SpeechSynthesisVoice | null = null;

/** Name substrings of natural-sounding English voices, checked in priority order. */
const PREFERRED_VOICE_PATTERNS = [
  /natural/i,
  /google us english/i,
  /samantha/i,
  /aria/i,
  /jenny/i,
  /guy/i,
  /^microsoft (zira|david)/i,
];

export function isNarrationSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (!isNarrationSupported()) return null;
  if (cachedVoice) return cachedVoice;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const englishVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const pool = englishVoices.length > 0 ? englishVoices : voices;

  for (const pattern of PREFERRED_VOICE_PATTERNS) {
    const match = pool.find((v) => pattern.test(v.name));
    if (match) {
      cachedVoice = match;
      return match;
    }
  }

  cachedVoice = pool.find((v) => v.default) ?? pool[0];
  return cachedVoice;
}

if (isNarrationSupported()) {
  // Voice lists load asynchronously in most browsers; re-pick once they're actually available.
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
    pickVoice();
  };
}

/** Queues a line to be spoken and resolves once it has fully finished (or immediately if
 *  narration isn't supported / text is empty), so callers can pace the game to match speech. */
export function speakAndWait(text: string): Promise<void> {
  if (!isNarrationSupported() || !text.trim()) return Promise.resolve();
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    utterance.rate = 1.05;
    utterance.pitch = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

/** Stops any speech in progress and clears the pending queue. */
export function cancelSpeech(): void {
  if (isNarrationSupported()) window.speechSynthesis.cancel();
}

// Log messages embed a racer's owner as "Name (Owner)" (see `describe()` in raceEngine.ts).
// Spoken narration only needs the racer's own name, so this strips that owner attribution
// wherever a message doesn't already provide its own hand-written `narration` override.
// Longest-name-first avoids partial-name collisions (e.g. "Slime" inside "Slime King").
const NAMES_BY_LENGTH = [...CHARACTERS].sort((a, b) => b.name.length - a.name.length);
const OWNER_SUFFIX_PATTERN = new RegExp(
  `(?:${NAMES_BY_LENGTH.map((c) => c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}) \\([^)]*\\)`,
  'g',
);

function stripOwnerAttribution(text: string): string {
  return text.replace(OWNER_SUFFIX_PATTERN, (match) => match.replace(/ \([^)]*\)$/, ''));
}

/** Picks the best text to speak for a log entry: its hand-written narration if provided, else
 *  the display message with owner attributions stripped for more natural-sounding speech. */
export function toSpeechText(entry: { message: string; narration?: string }): string {
  return entry.narration ?? stripOwnerAttribution(entry.message);
}
