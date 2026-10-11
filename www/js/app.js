import { store } from './state.js';
import { applyTheme } from './theme.js';
import { startRouter } from './router.js';

applyTheme(store.data.settings);
store.subscribe((data) => applyTheme(data.settings));

startRouter();
