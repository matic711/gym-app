import { store } from './state.js';
import { applyTheme } from './theme.js';
import { startRouter, refresh, navigate } from './router.js';
import { syncNotifications, onNotificationOpen } from './notifications.js';
import { App } from '@capacitor/app';

applyTheme(store.data.settings);
store.subscribe((data) => applyTheme(data.settings));

// Keep phone reminders in line with what has already been logged.
syncNotifications(store.data, 0);
store.subscribe((data) => syncNotifications(data));
App.addListener('resume', () => { syncNotifications(store.data, 0); refresh(); }).catch(() => {});

startRouter();
onNotificationOpen((route, params) => navigate(route, params));
