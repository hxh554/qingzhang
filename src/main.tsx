import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { seedIfEmpty } from './db/seed';
import { useUi } from './stores/ui';

/* 隐私模式：全局给 <html> 挂 class，CSS 统一把 .num 金额糊掉 */
const applyPrivacy = (on: boolean) => document.documentElement.classList.toggle('qz-private', on);
applyPrivacy(useUi.getState().privacy);
useUi.subscribe(s => applyPrivacy(s.privacy));

const mount = () => ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);

/* PWA：注册 Service Worker，让「添加到主屏幕」后的应用能离线打开。
   只在生产环境注册，避免开发时缓存干扰热更新。 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(err => console.warn('[sw] 注册失败', err));
  });
}

seedIfEmpty()
  .then(mount)
  .catch(err => {
    console.error('[seed failed]', err);
    mount();
  });
