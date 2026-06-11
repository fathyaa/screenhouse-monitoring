let audio = null;
let unlocked = false;

function getAudio() {
  if (!audio) {
    audio = new Audio("/sounds/notification.mp3");
    audio.volume = 0.7;
  }
  return audio;
}

/** Unlock audio playback — browser requires a prior user gesture. */
export async function unlockAlertSound() {
  if (unlocked) return true;
  const a = getAudio();
  try {
    const prevVolume = a.volume;
    a.volume = 0;
    await a.play();
    a.pause();
    a.currentTime = 0;
    a.volume = prevVolume;
    unlocked = true;
    return true;
  } catch {
    return false;
  }
}

export function playAlertSound() {
  if (!unlocked) return;
  const a = getAudio();
  a.currentTime = 0;
  a.play().catch(() => {});
}

/** Listen for first click/tap/key — then remove listeners. */
export function installAlertSoundUnlock() {
  const tryUnlock = () => {
    unlockAlertSound().then((ok) => {
      if (!ok) return;
      document.removeEventListener("click", tryUnlock);
      document.removeEventListener("keydown", tryUnlock);
      document.removeEventListener("touchstart", tryUnlock);
    });
  };

  document.addEventListener("click", tryUnlock, { passive: true });
  document.addEventListener("keydown", tryUnlock, { passive: true });
  document.addEventListener("touchstart", tryUnlock, { passive: true });

  return () => {
    document.removeEventListener("click", tryUnlock);
    document.removeEventListener("keydown", tryUnlock);
    document.removeEventListener("touchstart", tryUnlock);
  };
}
