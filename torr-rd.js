(function () {
    'use strict';

    // ==========================================
    const RD_KEY = 'F5PIY56JKZUQWSPWUEMJZBIJKYRXYRWRNVFI2Z6AKBRCDF7N7AYQ'; 
    // ==========================================

    const Debrid = {
        api: 'https://api.real-debrid.com/rest/1.0/',
        req: function(m, e, d) {
            return fetch(this.api + e, {
                method: m,
                headers: { 'Authorization': 'Bearer ' + RD_KEY },
                body: d ? new URLSearchParams(d) : null
            }).then(r => r.json());
        },
        async getLink(magnet) {
            if (!magnet.startsWith('magnet:')) magnet = 'magnet:?xt=urn:btih:' + magnet;
            let a = await this.req('POST', 'torrents/addMagnet', { magnet: magnet });
            await this.req('POST', 'torrents/selectFiles/' + a.id, { files: 'all' });
            let i = await this.req('GET', 'torrents/info/' + a.id);
            let s = await this.req('POST', 'unrestrict/link', { link: i.links[0] });
            return s.download;
        }
    };

    function initProxy() {
        if (window.rd_proxy_active) return;
        window.rd_proxy_active = true;

        console.log('RD Proxy: Запуск эмуляции TorrServer');

        // 1. Обманываем проверку сервера (всегда говорим, что он онлайн)
        Lampa.TorrServer.check = function (url, resolve) {
            console.log('RD Proxy: Лампа проверяет статус сервера. Отвечаем: OK');
            resolve(); // Мгновенно подтверждаем, что сервер "работает"
        };

        // 2. Подменяем логику получения ссылки на стрим
        // Это "сердце" TorrServer в Лампе
        const originalStream = Lampa.TorrServer.stream;
        Lampa.TorrServer.stream = function (url, hash, query) {
            // url здесь обычно http://127.0.0.1:8090/..., но нам плевать
            // hash - это обычно инфо-хеш торрента
            
            Lampa.Noty.show('RD Proxy: Превращаю торрент в поток...');

            Debrid.getLink(hash)
                .then(directLink => {
                    Lampa.Noty.show('RD Proxy: Поток готов!');
                    // Отправляем Лампе прямую ссылку вместо ссылки на TorrServer
                    Lampa.Player.play({
                        url: directLink,
                        title: 'RD Stream'
                    });
                })
                .catch(e => {
                    Lampa.Noty.show('RD Proxy Ошибка: ' + e);
                });
        };

        // 3. Чтобы Лампа не выдавала ошибку "Сервер не выбран"
        // Мы принудительно ставим любой фейковый адрес в настройки
        if (!Lampa.Storage.get('torrserver_url')) {
            Lampa.Storage.set('torrserver_url', 'http://127.0.0.1:8090');
        }

        Lampa.Noty.show('Real-Debrid эмулирует TorrServer');
    }

    // Ждем загрузки всех модулей
    if (window.Lampa && window.Lampa.TorrServer) {
        initProxy();
    } else {
        let wait = setInterval(() => {
            if (window.Lampa && window.Lampa.TorrServer) {
                initProxy();
                clearInterval(wait);
            }
        }, 500);
    }
})();
