(function () {
    'use strict';

    // ==========================================
    // ВСТАВЬ СЮДА СВОЙ КЛЮЧ ОТ REAL-DEBRID
    const RD_KEY = 'ТУТ_ТВОЙ_API_KEY'; 
    // ==========================================

    const RD_API = 'https://api.real-debrid.com/rest/1.0/';

    // --- ЛОГИКА РАБОТЫ С API ---
    const Debrid = {
        req: function (method, endpoint, data) {
            return new Promise((resolve, reject) => {
                let options = {
                    method: method,
                    headers: { 'Authorization': 'Bearer ' + RD_KEY }
                };
                if (data) {
                    let fd = new FormData();
                    for (let k in data) fd.append(k, data[k]);
                    options.body = fd;
                }
                fetch(RD_API + endpoint, options)
                    .then(r => r.json())
                    .then(json => {
                        if (json.error) reject(json.error_code || json.error);
                        else resolve(json);
                    })
                    .catch(err => reject('Ошибка сети'));
            });
        },

        play: async function (element, object) {
            Lampa.Noty.show('RD: Обработка...');
            try {
                // 1. Ищем магнит
                let magnet = object.magnet || object.Magnet || object.url;
                if (!magnet) throw new Error('Магнит-ссылка не найдена');
                
                // Исправление для хешей
                if (!magnet.startsWith('magnet:') && !magnet.startsWith('http')) {
                     magnet = 'magnet:?xt=urn:btih:' + magnet;
                }

                // 2. Добавляем
                let added = await this.req('POST', 'torrents/addMagnet', { magnet: magnet });
                if (!added || !added.id) throw new Error('Ошибка добавления магнета');

                // 3. Выбираем файлы
                let info = await this.req('GET', 'torrents/info/' + added.id);
                if (info.status === 'waiting_files_selection') {
                    await this.req('POST', 'torrents/selectFiles/' + added.id, { files: 'all' });
                    info = await this.req('GET', 'torrents/info/' + added.id);
                }

                // 4. Ищем видео
                if (!info.links || !info.links.length) throw new Error('Файлы не найдены');
                
                // Берем ссылку (первую или самую большую по логике RD)
                let linkToUnrestrict = info.links[0];
                
                // 5. Разблокируем
                let stream = await this.req('POST', 'unrestrict/link', { link: linkToUnrestrict });
                
                // 6. Играем
                Lampa.Player.play({
                    url: stream.download,
                    title: object.title || 'Real-Debrid Stream',
                    subtitles: [] 
                });
                
                Lampa.Noty.show('RD: Запуск!');

            } catch (e) {
                Lampa.Noty.show('RD Ошибка: ' + e);
                console.error(e);
            }
        }
    };

    // --- ПЕРЕХВАТЧИК ---
    function injectInterceptor() {
        if (window.rd_interceptor_active) return;
        
        // Проверяем, загружен ли модуль торрентов
        if (window.Lampa && window.Lampa.Torrent && window.Lampa.Torrent.start) {
            
            console.log('RD: Перехват функции запуска торрента...');
            window.rd_interceptor_active = true;
            Lampa.Noty.show('RD Плагин: Установлен');

            // Сохраняем оригинальную функцию (TorrServer)
            let originalStart = window.Lampa.Torrent.start;

            // Подменяем функцию
            window.Lampa.Torrent.start = function (element, object) {
                // Создаем меню выбора
                Lampa.Select.show({
                    title: 'Выберите способ просмотра',
                    items: [
                        {
                            title: 'Real-Debrid (Облако)',
                            subtitle: 'Без ожидания загрузки',
                            method: 'rd'
                        },
                        {
                            title: 'TorrServer (Стандарт)',
                            subtitle: 'Ваш локальный сервер',
                            method: 'ts'
                        }
                    ],
                    onSelect: function (a) {
                        if (a.method === 'rd') {
                            // Запускаем через наш код
                            Debrid.play(element, object);
                        } else {
                            // Запускаем как было раньше
                            originalStart(element, object);
                        }
                    },
                    onBack: function () {
                        Lampa.Controller.toggle('content');
                    }
                });
            };
        }
    }

    // --- ЗАПУСК ---
    // Пробуем внедриться сразу и потом каждые 2 секунды, если Lampa тормозит
    if (window.Lampa) injectInterceptor();
    
    let info_timer = setInterval(function(){
        if(window.Lampa && window.Lampa.Torrent) {
            injectInterceptor();
            clearInterval(info_timer);
        }
    }, 1000);

})();
