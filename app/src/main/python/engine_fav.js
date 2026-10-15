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
