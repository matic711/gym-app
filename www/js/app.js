import { store } from './state.js';
import { applyTheme } from './theme.js';
import { startRouter } from './router.js';
import { syncNotifications } from './notifications.js';
import { App } from '@capacitor/app';

applyTheme(store.data.settings);
store.subscribe((data) => applyTheme(data.settings));

// Keep phone reminders in line with what has already been logged.
syncNotifications(store.data, 0);
store.subscribe((data) => syncNotifications(data));
App.addListener('resume', () => syncNotifications(store.data, 0)).catch(() => {});

startRouter();
