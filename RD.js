(function () {
    'use strict';

    // --- НАСТРОЙКИ ---
    // Вставь сюда свой API Key (https://real-debrid.com/apitoken)
    const RD_API_KEY = 'F5PIY56JKZUQWSPWUEMJZBIJKYRXYRWRNVFI2Z6AKBRCDF7N7AYQ'; 
    // -----------------

    const LampaRD = {
        api_url: 'https://api.real-debrid.com/rest/1.0/',

        // Запрос к RD
        request: function (method, endpoint, data) {
            return new Promise((resolve, reject) => {
                let options = {
                    method: method,
                    headers: { 'Authorization': 'Bearer ' + RD_API_KEY }
                };
                if (data) {
                    const formData = new FormData();
                    for (const key in data) formData.append(key, data[key]);
                    options.body = formData;
                }
                fetch(this.api_url + endpoint, options)
                    .then(r => r.json())
                    .then(resolve)
                    .catch(reject);
            });
        },

        // Главная функция запуска
        play: async function (magnet, object) {
            Lampa.Noty.show('RD: Добавляю торрент...');
            try {
                // 1. Добавляем магнит
                let added = await this.request('POST', 'torrents/addMagnet', { magnet: magnet });
                if (!added || !added.id) throw new Error('Ошибка добавления');

                // 2. Выбираем все файлы
                await this.request('POST', 'torrents/selectFiles/' + added.id, { files: 'all' });
                
                // 3. Получаем список ссылок
                let info = await this.request('GET', 'torrents/info/' + added.id);
                if (!info.links.length) throw new Error('Нет ссылок в торренте');

                // 4. Разблокируем первую ссылку (обычно это фильм)
                let link = await this.request('POST', 'unrestrict/link', { link: info.links[0] });
                
                // 5. Запускаем плеер Lampa
                Lampa.Player.play({
                    url: link.download,
                    title: object.title || 'Real-Debrid Stream'
                });
                
                Lampa.Noty.show('RD: Запуск видео...');
            } catch (e) {
                Lampa.Noty.show('RD Ошибка: ' + e.message);
                console.error(e);
            }
        }
    };

    // Внедрение кнопки в меню торрента
    function addRDButton(event) {
        if (window.Lampa.Activity.active().component === 'full') {
            // Находим элемент торрента
            let item = event.target; 
            // Получаем магнит ссылку (Lampa хранит её в атрибуте data или внутри объекта)
            // Это самая сложная часть, так как зависит от источника.
            // Попробуем универсальный метод:
            
            let magnet = item.Magnet || item.url || (item.data && item.data.url);
            
            if(magnet && (magnet.startsWith('magnet:') || magnet.startsWith('http'))) {
                 Lampa.ContextMenu.add({
                    title: 'Смотреть через Real-Debrid',
                    icon: 'server', 
                    enter: function () {
                        LampaRD.play(magnet, item);
                    }
                });
            }
        }
    }
    
    // Слушаем клики (или вызов контекстного меню)
    // В Lampa это обычно событие 'torrent_option' или перехват рендера
    if(window.Lampa) {
        window.Lampa.Listener.follow('torrent_option', function(e){
            Lampa.ContextMenu.push({
                title: 'Запуск через RD (Свой плагин)',
                enter: function() {
                    LampaRD.play(e.object.url || e.object.Magnet, e.object);
                }
            });
        });
        console.log('RD Native Plugin: Загружен');
    }

})();
