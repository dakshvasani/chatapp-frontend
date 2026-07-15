// src/utils/playNotificationSound.js
let audio;

export const playNotificationSound = () => {
  try {
    if (!audio) {
      audio = new Audio('/notification-sound.mp3');
    }
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Autoplay can be blocked by the browser until the user has interacted
      // with the page at least once — safe to ignore, not an actual error.
    });
  } catch (err) {
    console.error('Could not play notification sound:', err);
  }
};