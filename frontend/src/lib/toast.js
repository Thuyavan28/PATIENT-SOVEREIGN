// Simple event-driven lightweight toast system
const listeners = new Set();

export const toast = {
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  notify(message, type = 'info', duration = 3500) {
    const id = Date.now() + Math.random();
    const item = { id, message, type, duration };
    listeners.forEach(fn => fn({ action: 'add', item }));
    if (duration > 0) {
      setTimeout(() => {
        listeners.forEach(fn => fn({ action: 'remove', id }));
      }, duration);
    }
  },
  success(message, duration) {
    this.notify(message, 'success', duration);
  },
  error(message, duration) {
    this.notify(message, 'error', duration);
  },
  warning(message, duration) {
    this.notify(message, 'warning', duration);
  },
  info(message, duration) {
    this.notify(message, 'info', duration);
  }
};
