const CACHE_NAME = 'chess-game-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    './assets/w_pawn.png',
    './assets/w_rook.png',
    './assets/w_knight.png',
    './assets/w_bishop.png',
    './assets/w_queen.png',
    './assets/w_king.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});
