// src/utils/browserNotification.js
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
};

export const showBrowserNotification = (title, options = {}) => {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  // Only show if the tab is NOT currently focused/visible
  if (document.visibilityState === 'visible') return;

  new Notification(title, options);
};