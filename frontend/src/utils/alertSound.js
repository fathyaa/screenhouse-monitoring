const SOUND_URL = "/sounds/notification.mp3";

let unlocked = false;

/** Unlock audio playback — browser requires a prior user gesture. */
export async function unlockAlertSound() {
  if (unlocked) return true;

  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      await ctx.resume();
      await ctx.close();
    }

    // Beberapa browser tetap butuh HTMLAudioElement — muted, tidak disimpan.
    const probe = new Audio(SOUND_URL);
    probe.muted = true;
    probe.volume = 0;
    await probe.play();
    probe.pause();
    probe.src = "";

    unlocked = true;
    return true;
  } catch {
    return false;
  }
}

// volume lebih rendah dipakai untuk alert yang sudah ditangani otomatis oleh
// sistem (kipas/irigasi/lampu) — tidak perlu semendesak alert yang butuh
// tindakan manual dari petani.
export function playAlertSound({ volume = 0.7 } = {}) {
  if (!unlocked) return;

  // Instance baru tiap alert — hindari tombol media laptop (F8/play) memutar ulang.
  const a = new Audio(SOUND_URL);
  a.volume = volume;
  a.play().catch(() => {});
}

/** Listen for first click/tap — then remove listeners. */
export function installAlertSoundUnlock() {
  const tryUnlock = () => {
    unlockAlertSound().then((ok) => {
      if (!ok) return;
      document.removeEventListener("click", tryUnlock);
      document.removeEventListener("touchstart", tryUnlock);
    });
  };

  document.addEventListener("click", tryUnlock, { passive: true });
  document.addEventListener("touchstart", tryUnlock, { passive: true });

  return () => {
    document.removeEventListener("click", tryUnlock);
    document.removeEventListener("touchstart", tryUnlock);
  };
}
