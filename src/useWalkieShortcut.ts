import { useEffect } from 'react';
import type { WalkieSession } from './WalkieSession';

// Deliberately uses Control on every OS: the microphone must already be enabled.
export function useWalkieShortcut(voice: WalkieSession | null) {
  useEffect(() => {
    if (!voice) return;
    let ownsSpace = false;
    const stop = () => { if (ownsSpace) voice.release(); };
    const reset = () => { stop(); ownsSpace = false; };
    const isSpace = (event: KeyboardEvent) => event.code === 'Space' || event.key === ' ';
    const down = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { reset(); return; }
      if (!isSpace(event)) return;
      // Consume repeats even if a modifier was released first, without typing spaces.
      if (ownsSpace) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      if (!voice.active || event.isComposing || !event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.repeat || voice.sending || voice.pending) return;
      ownsSpace = true;
      voice.press();
    };
    const up = (event: KeyboardEvent) => {
      if (!ownsSpace) return;
      if (isSpace(event)) { event.preventDefault(); event.stopImmediatePropagation(); reset(); }
      else if (event.key === 'Control' || event.key === 'Shift') stop();
    };
    const visibility = () => { if (document.visibilityState === 'hidden') reset(); };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      reset();
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [voice]);
}
