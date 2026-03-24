const CACHE_NAME = 'mafia-v1';

self.addEventListener('install', (e) => {
    console.log('Service Worker Installed');
});

self.addEventListener('fetch', (event) => {
    // هذا الجزء فارغ حالياً ليسمح بالتثبيت فقط
});
