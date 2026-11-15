/* [JENNY-FILE-INFO] engine_fav.js
 * Что здесь: Избранное: список в localStorage и toggleFav.
 * Загрузка:  тег <script> №4 из 15 в index.html (порядок тегов менять нельзя).
 * Внимание:  1 функц. отсюда позже переопределены или обёрнуты; итоговая версия лежит в другом файле:
 *            toggleFav → ui_playlist.js.
 *            Правка такой функции здесь может ничего не изменить — смотри REFACTOR_PLAN.md, приложение В.
 * Карта всех файлов: FILES.md в корне репозитория.
 */
// =========================================================================
// ❤️ ENGINE_FAV.JS (ЛОГИКА ИЗБРАННОГО)
// =========================================================================

window.favorites = JSON.parse(localStorage.getItem('ytm_favs') || '[]');

window.toggleFav = function(filename) {
    if (window.favorites.includes(filename)) {
        window.favorites = window.favorites.filter(f => f !== filename);
    } else {
        window.favorites.unshift(filename);
    }
    localStorage.setItem('ytm_favs', JSON.stringify(window.favorites));
    if(typeof window.fetchData === 'function') window.fetchData(); 
};
