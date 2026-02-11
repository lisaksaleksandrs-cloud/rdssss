(function () {
    'use strict';

    // ==========================================
    const RD_KEY = 'F5PIY56JKZUQWSPWUEMJZBIJKYRXYRWRNVFI2Z6AKBRCDF7N7AYQ'; 
    // ==========================================

    const RD_ENGINE = {
        api: 'https://api.real-debrid.com/rest/1.0/',
        async request(method, endpoint, data) {
            const resp = await fetch(this.api + endpoint, {
                method: method,
                headers: { 'Authorization': 'Bearer ' + RD_KEY },
                body: data ? new URLSearchParams(data) : null
            });
            return resp.json();
        },
        async getStream(magnet) {
            Lampa.Noty.show('RD: Магия начинается...');
            if (!magnet.startsWith('magnet:')) magnet = 'magnet:?xt=urn:btih:' + magnet;
            
            const add = await this.request('POST', 'torrents/addMagnet', { magnet: magnet });
            await this.request('POST', 'torrents/selectFiles/' + add.id, { files: 'all' });
            
            // Ждем 1 сек для обновления статуса на сервере RD
            await new Promise(r => setTimeout(r, 1000));
            
            const info = await this.request('GET', 'torrents/info/' + add.id);
            if (!info.links || !info.links.length) throw new Error('Файлы еще не готовы в RD');
            
            const stream = await this.request('POST', 'unrestrict/link', { link: info.links[0] });
            return stream.download;
        }
    };

    function hackLampa() {
        if (window.rd_ultimate_active) return;
        window.rd_ultimate_active = true;

        console.log('RD Ultimate: Взлом системы проверок...');

        // 1. Принудительно отключаем уведомления об ошибках TorrServer
        const originalNoty = Lampa.Noty.show;
        Lampa.Noty.show = function(text) {
            if (text.toLowerCase().includes('torrserver') || text.toLowerCase().includes('подключения')) {
                console.log('RD Ultimate: Заблокирована ошибка:', text);
                return; // Просто не показываем эту ошибку
            }
            originalNoty.apply(Lampa.Noty, arguments);
        };

        // 2. Обманываем статус подключения
        if (Lampa.TorrServer) {
            Lampa.TorrServer.check = function(url, resolve) {
                resolve(); // Всегда говорим "Да, всё работает"
            };
            
            // Подменяем метод стриминга
            Lampa.TorrServer.stream = function(url, hash, query) {
                RD_ENGINE.getStream(hash).then(link => {
                    Lampa.Player.play({
                        url: link,
                        title: 'Real-Debrid Stream'
                    });
                }).catch(err => {
                    originalNoty('Ошибка RD: ' + err);
                });
            };
        }

        // 3. ПЕРЕХВАТ КЛИКА (Самый надежный метод)
        // Если Лампа пытается запустить любой торрент — мы забираем управление
        if (Lampa.Torrent) {
            Lampa.Torrent.start = function(element, object) {
                const magnet = object.magnet || object.Magnet || object.url;
                if (magnet) {
                    RD_ENGINE.getStream(magnet).then(link => {
                        Lampa.Player.play({
                            url: link,
                            title: object.title || 'Real-Debrid'
                        });
                    }).catch(e => originalNoty('Ошибка: ' + e));
                }
            };
        }

        Lampa.Noty.show('RD Ultimate: Готов к работе');
    }

    // Запуск с проверкой готовности
    const checker = setInterval(() => {
        if (window.Lampa && window.Lampa.TorrServer && window.Lampa.Torrent) {
            hackLampa();
            clearInterval(checker);
        }
    }, 500);

})();
