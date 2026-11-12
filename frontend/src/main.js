import { createApp } from 'vue';
import { createPinia } from 'pinia';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.min.css';
import './assets/styles/theme.css';
import App from './App.vue';
import { router } from './router/index.js';

createApp(App).use(createPinia()).use(router).mount('#app');
