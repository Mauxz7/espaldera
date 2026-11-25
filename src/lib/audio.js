import { unlockTimerAudio, playTimerDoneChime, isTimerSoundEnabled } from "./timerSound.js";

export function unlockAudio() {
  return unlockTimerAudio();
}

export function beep() {
  return playTimerDoneChime({ enabled: isTimerSoundEnabled() });
}
