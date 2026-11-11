// =========================================================================
// 🔌 JENNY_IFRAME_BRIDGE.JS (ШИНА МЕЖПОРТОВОЙ ИЗОЛЯЦИИ :8080 / :8081 / :8082 / :8083)
// =========================================================================
(function() {
    if (window.__jennyIframeBridgeV354) return;
    window.__jennyIframeBridgeV354 = {
        ports: {
            shell: 8080,
            deckA: 8081,
            deckB: 8082,
            torrents: 8083
        },
        origins: {
            shell: 'http://127.0.0.1:8080',
            deckA: 'http://127.0.0.1:8081',
            deckB: 'http://127.0.0.1:8082',
            torrents: 'http://127.0.0.1:8083'
        },
        listeners: {},
        on: function(topic, fn) {
            if (!this.listeners[topic]) this.listeners[topic] = [];
            this.listeners[topic].push(fn);
        },
        emitToFrame: function(iframeEl, targetOrigin, topic, payload) {
            if (!iframeEl || !iframeEl.contentWindow) return false;
            try {
                iframeEl.contentWindow.postMessage({
                    __jennyBusV354: true,
                    topic: topic,
                    payload: payload || {}
                }, targetOrigin || '*');
                return true;
            } catch (e) {
                return false;
            }
        },
        emitToParent: function(topic, payload) {
            if (!window.parent || window.parent === window) return false;
            try {
                window.parent.postMessage({
                    __jennyBusV354: true,
                    topic: topic,
                    payload: payload || {}
                }, '*');
                return true;
            } catch (e) {
                return false;
            }
        }
    };

    window.addEventListener('message', function(ev) {
        var d = ev && ev.data;
        if (!d || !d.__jennyBusV354 || !d.topic) return;
        var org = String(ev.origin || '');
        if (org && org !== 'null' && !/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(org)) {
            return;
        }
        var arr = window.__jennyIframeBridgeV354.listeners[d.topic] || [];
        for (var i = 0; i < arr.length; i++) {
            try { arr[i](d.payload, ev); } catch (err) {}
        }
    });
})();
