(function () {
    'use strict';

    // ==========================================
    // НАСТРОЙКИ: ВСТАВЬ СВОЙ КЛЮЧ
    const RD_KEY = 'F5PIY56JKZUQWSPWUEMJZBIJKYRXYRWRNVFI2Z6AKBRCDF7N7AYQ';
    // ==========================================

    const RD_API = 'https://api.real-debrid.com/rest/1.0/';

    // Вспомогательный класс для работы с API
    const Debrid = {
        // Базовый запрос
        q: function (method, endpoint, data) {
            return new Promise((resolve, reject) => {
                let options = {
                    method: method,
                    headers: { 'Authorization': 'Bearer ' + RD_KEY }
                };
                
                if (data) {
                    let formData = new FormData();
                    for (let k in data) formData.append(k, data[k]);
                    options.body = formData;
                }

                fetch(RD_API + endpoint, options)
                    .then(r => r.json())
                    .then(json => {
                        if (json.error) reject(json.error_code || json.error);
                        else resolve(json);
                    })
                    .catch(err => reject('Network Error'));
            });
        },

        // Главная логика: Магнит -> Видеофайл
        play: async function (magnet, object) {
            Lampa.Noty.show('RD: Добавляю торрент...');
            try {
                // 1. Добавляем магнит
                // Lampa иногда отдает магнит без префикса, проверим
                if (!magnet.startsWith('magnet:')) magnet = 'magnet:?xt=urn:btih:' + magnet;
                
                let added = await this.q('POST', 'torrents/addMagnet', { magnet: magnet });
                if (!added || !added.id) throw new Error('Ошибка добавления');

                // 2. Проверяем статус и выбираем файлы
                let info = await this.q('GET', 'torrents/info/' + added.id);
                
                if (info.status === 'waiting_files_selection') {
                    // Выбираем все файлы ("all")
                    await this.q('POST', 'torrents/selectFiles/' + added.id, { files: 'all' });
                    // Ждем секунду, чтобы сервер RD обновил статус
                    info = await this.q('GET', 'torrents/info/' + added.id);
                }

                // 3. Выбираем ссылку для просмотра
                if (!info.links || !info.links.length) throw new Error('В торренте нет ссылок (или не скачан)');
                
                // Берем первую ссылку (обычно это самый большой файл)
                let targetLink = info.links[0];
                
                // 4. Разблокируем (Unrestrict)
                Lampa.Noty.show('RD: Получаю прямую ссылку...');
                let stream = await this.q('POST', 'unrestrict/link', { link: targetLink });
                
                if (!stream || !stream.download) throw new Error('Не удалось получить поток');

                // 5. Запуск плеера
                console.log('RD Stream:', stream.download);
                
                Lampa.Player.play({
                    url: stream.download,
                    title: (object.title || info.filename) + ' [Real-Debrid]',
                    subtitles: [] // Можно допилить поиск сабов
                });

            } catch (e) {
                console.error('RD Error', e);
                Lampa.Noty.show('RD Ошибка: ' + e);
            }
        }
    };

    // Инициализация плагина
    function start() {
        if (window.rd_plugin_init) return;
        window.rd_plugin_init = true;

        // Слушаем событие "Опции торрента"
        // Это срабатывает, когда ты удерживаешь кнопку на торренте
        Lampa.Listener.follow('torrent_option', function (e) {
            let item = e.object;
            
            // Ищем магнит-ссылку в объекте
            let magnet = item.magnet || item.Magnet || item.url;
            
            // Если нашли что-то похожее на магнит или хеш
            if (magnet && (magnet.startsWith('magnet:') || magnet.length > 35)) {
                
                // Добавляем кнопку в меню
                Lampa.ContextMenu.push({
                    title: 'Смотреть через Real-Debrid',
                    color: '6dc04d', // Зеленоватый цвет
                    enter: function () {
                        Debrid.play(magnet, item);
                    }
                });
            }
        });

        // Уведомление о старте
        console.log('RD Uncensored Plugin: Loaded');
        Lampa.Noty.show('RD Plugin подключен');
    }

    if (window.Lampa && window.Lampa.Listener) {
        start();
    } else {
        // Если Lampa еще грузится
        window.onload = start;
    }

})();
