(function () {
    'use strict';

    // --- НАСТРОЙКИ ---
    // Внутреннее хранилище для ключа
    var RD_KEY_STORAGE = 'my_rd_api_key';
    
    // API Real-Debrid
    var RD_API = 'https://api.real-debrid.com/rest/1.0';

    // --- ЛОГИКА ---
    
    function RDEngine() {
        var _this = this;

        // 1. Рисуем кнопку в карточке фильма
        this.init = function () {
            Lampa.Listener.follow('full', function (data) {
                if (data.type == 'movie') {
                    var btn = $('<div class="full-start__button selector view--inline" data-subtitle="Real-Debrid Engine"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="20" height="20" fill="currentColor"><path d="M448 256c0-106-86-192-192-192S64 150 64 256s86 192 192 192 192-86 192-192z" opacity=".4"/><path d="M256 336c-44 0-80-36-80-80s36-80 80-80 80 36 80 80-36 80-80 80z"/></svg><span>Смотреть через RD</span></div>');
                    
                    btn.on('hover:enter', function () {
                        _this.startSearch(data.data);
                    });

                    $('.full-start__buttons').append(btn);
                }
            });
            
            // Добавляем настройки
            _this.addSettings();
        };

        // 2. Поиск торрентов (Используем API YTS как самый живучий)
        this.startSearch = function (movie) {
            var key = localStorage.getItem(RD_KEY_STORAGE);
            if (!key) {
                Lampa.Noty.show('Сначала введи API Key в Настройках!');
                Lampa.Settings.open();
                return;
            }

            Lampa.Loading.start(function () {
                Lampa.Loading.stop();
            });

            // Поиск по IMDB ID (самый точный)
            var imdb_id = movie.imdb_id || '';
            var query_url = 'https://yts.mx/api/v2/list_movies.json?query_term=' + (imdb_id ? imdb_id : movie.title) + '&sort_by=seeds&limit=20';

            var network = new Lampa.Reguest();
            network.silent(query_url, function (json) {
                Lampa.Loading.stop();
                if (json.data && json.data.movies && json.data.movies.length > 0) {
                    _this.showResults(json.data.movies, movie);
                } else {
                    Lampa.Noty.show('Торренты не найдены (YTS)');
                }
            }, function () {
                Lampa.Loading.stop();
                Lampa.Noty.show('Ошибка поиска. Провайдер блокирует YTS?');
            });
        };

        // 3. Показ результатов
        this.showResults = function (torrents, movie) {
            var items = [];

            torrents.forEach(function (item) {
                item.torrents.forEach(function (tor) {
                    // Генерируем Magnet (YTS дает хэш)
                    var magnet = 'magnet:?xt=urn:btih:' + tor.hash + '&dn=' + encodeURIComponent(item.title) + '&tr=udp://open.demonii.com:1337/announce&tr=udp://tracker.openbittorrent.com:80';
                    
                    items.push({
                        title: tor.quality + ' ' + tor.type.toUpperCase(),
                        subtitle: 'Size: ' + tor.size + ' | Seeds: ' + tor.seeds,
                        magnet: magnet,
                        item: item
                    });
                });
            });

            Lampa.Select.show({
                title: 'Найденные раздачи',
                items: items,
                onSelect: function (a) {
                    _this.playViaRD(a.magnet);
                },
                onBack: function () {
                    Lampa.Controller.toggle('full');
                }
            });
        };

        // 4. Магия Real-Debrid (Добавление и получение ссылки)
        this.playViaRD = function (magnet) {
            var key = localStorage.getItem(RD_KEY_STORAGE);
            Lampa.Loading.start();

            // Шаг А: Добавляем Магнит
            $.ajax({
                url: RD_API + '/torrents/addMagnet',
                type: 'POST',
                headers: { 'Authorization': 'Bearer ' + key },
                data: { magnet: magnet },
                success: function (result) {
                    var torrent_id = result.id;
                    
                    // Шаг Б: Выбираем все файлы (Select Files)
                    $.ajax({
                        url: RD_API + '/torrents/selectFiles/' + torrent_id,
                        type: 'POST',
                        headers: { 'Authorization': 'Bearer ' + key },
                        data: { files: 'all' },
                        success: function () {
                            
                            // Шаг В: Ждем инфо о ссылке и разблокируем (Unrestrict)
                            setTimeout(function(){
                                $.ajax({
                                    url: RD_API + '/torrents/info/' + torrent_id,
                                    type: 'GET',
                                    headers: { 'Authorization': 'Bearer ' + key },
                                    success: function (info) {
                                        var link_to_unrestrict = info.links[0]; // Берем первый файл
                                        
                                        // Шаг Г: Превращаем в прямую ссылку
                                        $.ajax({
                                            url: RD_API + '/unrestrict/link',
                                            type: 'POST',
                                            headers: { 'Authorization': 'Bearer ' + key },
                                            data: { link: link_to_unrestrict },
                                            success: function (stream) {
                                                Lampa.Loading.stop();
                                                
                                                // Шаг Д: ЗАПУСК ПЛЕЕРА
                                                Lampa.Player.play({
                                                    url: stream.download,
                                                    title: info.filename
                                                });
                                                
                                                // Добавляем в историю
                                                Lampa.Player.playlist([ { url: stream.download, title: info.filename } ]);
                                            },
                                            error: function() { Lampa.Loading.stop(); Lampa.Noty.show('Ошибка Unrestrict'); }
                                        });
                                    }
                                });
                            }, 1000);
                        }
                    });
                },
                error: function (e) {
                    Lampa.Loading.stop();
                    Lampa.Noty.show('Ошибка RD: Неверный ключ или магнит?');
                }
            });
        };

        // 5. Настройки ключа
        this.addSettings = function () {
            Lampa.Settings.listener.follow('open', function (e) {
                if (e.name == 'main') {
                    var item = $('<div class="settings-param selector" data-type="input" data-name="rd_key"><div class="settings-param__name">RD API Key</div><div class="settings-param__value">Нажми, чтобы ввести</div><div class="settings-param__descr">Введи сюда ключ с real-debrid.com/apitoken</div></div>');
                    
                    item.on('hover:enter', function () {
                        Lampa.Input.edit({
                            value: localStorage.getItem(RD_KEY_STORAGE) || '',
                            title: 'Real-Debrid API Token',
                            free: true,
                            nosave: true
                        }, function (new_val) {
                            localStorage.setItem(RD_KEY_STORAGE, new_val);
                            Lampa.Noty.show('Ключ сохранен!');
                            item.find('.settings-param__value').text(new_val ? 'Сохранен' : 'Нет ключа');
                        });
                    });
                    
                    $('.settings__content').append(item);
                }
            });
        };
    }

    if (window.appready) new RDEngine().init();
    else Lampa.Listener.follow('app', function (e) {
        if (e.type == 'ready') new RDEngine().init();
    });

})();
