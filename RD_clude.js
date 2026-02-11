(function() {
    'use strict';

    // Конфигурация плагина
    var RealDebrid = {
        apiUrl: 'https://api.real-debrid.com/rest/1.0',
        token: '',
        settings: {
            enabled: false,
            autoSelect: true,
            preferredQuality: '1080p',
            streaming: true
        }
    };

    // Инициализация плагина
    function init() {
        console.log('[RealDebrid] Инициализация плагина');
        
        // Загружаем настройки из хранилища
        loadSettings();
        
        // Добавляем пункт в меню настроек
        Lampa.SettingsApi.addComponent({
            component: 'realdebrid',
            name: 'Real-Debrid',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        });

        // Добавляем настройки плагина
        Lampa.SettingsApi.addParam({
            component: 'realdebrid',
            param: {
                name: 'realdebrid_enabled',
                type: 'trigger',
                default: false
            },
            field: {
                name: 'Включить Real-Debrid',
                description: 'Активировать интеграцию с Real-Debrid'
            },
            onChange: function(value) {
                RealDebrid.settings.enabled = value;
                saveSettings();
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'realdebrid',
            param: {
                name: 'realdebrid_token',
                type: 'input',
                default: ''
            },
            field: {
                name: 'API токен',
                description: 'Введите ваш токен Real-Debrid API'
            },
            onChange: function(value) {
                RealDebrid.token = value;
                saveSettings();
                if (value) {
                    validateToken(value);
                }
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'realdebrid',
            param: {
                name: 'realdebrid_streaming',
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Режим стриминга',
                description: 'Включить стриминг торрентов через Real-Debrid'
            },
            onChange: function(value) {
                RealDebrid.settings.streaming = value;
                saveSettings();
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'realdebrid',
            param: {
                name: 'realdebrid_quality',
                type: 'select',
                values: {
                    '2160p': '2160p (4K)',
                    '1080p': '1080p (Full HD)',
                    '720p': '720p (HD)',
                    '480p': '480p (SD)'
                },
                default: '1080p'
            },
            field: {
                name: 'Предпочитаемое качество',
                description: 'Выбор качества для воспроизведения'
            },
            onChange: function(value) {
                RealDebrid.settings.preferredQuality = value;
                saveSettings();
            }
        });

        // Интеграция с торрент-парсером Lampa
        if (window.Lampa && Lampa.Torrent) {
            hookTorrentParser();
        }

        console.log('[RealDebrid] Плагин инициализирован');
    }

    // Загрузка настроек
    function loadSettings() {
        var stored = Lampa.Storage.get('realdebrid_settings');
        if (stored) {
            RealDebrid.settings = stored.settings || RealDebrid.settings;
            RealDebrid.token = stored.token || '';
        }
    }

    // Сохранение настроек
    function saveSettings() {
        Lampa.Storage.set('realdebrid_settings', {
            settings: RealDebrid.settings,
            token: RealDebrid.token
        });
    }

    // Проверка токена
    function validateToken(token) {
        apiRequest('/user', function(result) {
            if (result.success) {
                Lampa.Noty.show('Real-Debrid: Подключено. Пользователь: ' + result.data.username);
                console.log('[RealDebrid] Токен валидный:', result.data);
            } else {
                Lampa.Noty.show('Real-Debrid: Ошибка токена - ' + (result.error || 'Неверный токен'));
            }
        }, token);
    }

    // API запрос к Real-Debrid
    function apiRequest(endpoint, callback, customToken) {
        var token = customToken || RealDebrid.token;
        
        if (!token && endpoint !== '/user') {
            callback({ success: false, error: 'Токен не установлен' });
            return;
        }

        var url = RealDebrid.apiUrl + endpoint;
        
        Lampa.Utils.ajax({
            url: url,
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token
            },
            success: function(data) {
                callback({ success: true, data: data });
            },
            error: function(error) {
                console.error('[RealDebrid] API Error:', error);
                callback({ 
                    success: false, 
                    error: error.statusText || 'Network error',
                    status: error.status
                });
            }
        });
    }

    // POST запрос к API
    function apiPost(endpoint, data, callback) {
        if (!RealDebrid.token) {
            callback({ success: false, error: 'Токен не установлен' });
            return;
        }

        var url = RealDebrid.apiUrl + endpoint;
        
        Lampa.Utils.ajax({
            url: url,
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + RealDebrid.token,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: data,
            success: function(response) {
                callback({ success: true, data: response });
            },
            error: function(error) {
                console.error('[RealDebrid] API POST Error:', error);
                callback({ 
                    success: false, 
                    error: error.statusText || 'Network error'
                });
            }
        });
    }

    // Добавление торрента в Real-Debrid
    function addTorrent(magnetLink, callback) {
        console.log('[RealDebrid] Добавление торрента:', magnetLink);
        
        apiPost('/torrents/addMagnet', { magnet: magnetLink }, function(result) {
            if (result.success) {
                console.log('[RealDebrid] Торрент добавлен:', result.data);
                callback({ success: true, torrentId: result.data.id });
            } else {
                callback({ success: false, error: result.error });
            }
        });
    }

    // Получение информации о торренте
    function getTorrentInfo(torrentId, callback) {
        apiRequest('/torrents/info/' + torrentId, function(result) {
            if (result.success) {
                callback({ success: true, data: result.data });
            } else {
                callback({ success: false, error: result.error });
            }
        });
    }

    // Выбор файлов для скачивания
    function selectFiles(torrentId, fileIds, callback) {
        var data = { files: fileIds };
        
        apiPost('/torrents/selectFiles/' + torrentId, data, function(result) {
            callback(result);
        });
    }

    // Разблокировка ссылки для стриминга
    function unrestrict(link, callback) {
        console.log('[RealDebrid] Разблокировка ссылки:', link);
        
        apiPost('/unrestrict/link', { link: link }, function(result) {
            if (result.success) {
                console.log('[RealDebrid] Ссылка разблокирована:', result.data.download);
                callback({ 
                    success: true, 
                    url: result.data.download,
                    filename: result.data.filename
                });
            } else {
                callback({ success: false, error: result.error });
            }
        });
    }

    // Обработка торрента и получение стрим-ссылки
    function processTorrent(magnetLink, callback) {
        if (!RealDebrid.settings.enabled || !RealDebrid.token) {
            callback({ success: false, error: 'Real-Debrid не настроен' });
            return;
        }

        Lampa.Noty.show('Real-Debrid: Обработка торрента...');

        // Шаг 1: Добавляем торрент
        addTorrent(magnetLink, function(addResult) {
            if (!addResult.success) {
                Lampa.Noty.show('Ошибка добавления торрента: ' + addResult.error);
                callback(addResult);
                return;
            }

            var torrentId = addResult.torrentId;

            // Шаг 2: Получаем информацию о торренте
            setTimeout(function() {
                getTorrentInfo(torrentId, function(infoResult) {
                    if (!infoResult.success) {
                        callback(infoResult);
                        return;
                    }

                    var torrentData = infoResult.data;
                    
                    // Шаг 3: Выбираем файлы для скачивания
                    if (torrentData.status === 'waiting_files_selection') {
                        var fileIds = selectBestFiles(torrentData.files);
                        
                        selectFiles(torrentId, fileIds, function(selectResult) {
                            if (!selectResult.success) {
                                callback(selectResult);
                                return;
                            }

                            // Ждем завершения обработки
                            waitForDownloadReady(torrentId, callback);
                        });
                    } else if (torrentData.status === 'downloaded') {
                        // Торрент уже скачан
                        getStreamLinks(torrentData, callback);
                    } else {
                        // Ждем завершения
                        waitForDownloadReady(torrentId, callback);
                    }
                });
            }, 1000);
        });
    }

    // Ожидание готовности торрента
    function waitForDownloadReady(torrentId, callback, attempt) {
        attempt = attempt || 0;
        
        if (attempt > 30) {
            callback({ success: false, error: 'Таймаут обработки торрента' });
            return;
        }

        setTimeout(function() {
            getTorrentInfo(torrentId, function(result) {
                if (!result.success) {
                    callback(result);
                    return;
                }

                var status = result.data.status;
                console.log('[RealDebrid] Статус торрента:', status, 'попытка', attempt);

                if (status === 'downloaded') {
                    Lampa.Noty.show('Real-Debrid: Торрент готов к просмотру');
                    getStreamLinks(result.data, callback);
                } else if (status === 'downloading' || status === 'queued') {
                    var progress = result.data.progress || 0;
                    Lampa.Noty.show('Real-Debrid: Скачивание ' + progress + '%');
                    waitForDownloadReady(torrentId, callback, attempt + 1);
                } else if (status === 'error' || status === 'virus' || status === 'dead') {
                    callback({ success: false, error: 'Ошибка торрента: ' + status });
                } else {
                    waitForDownloadReady(torrentId, callback, attempt + 1);
                }
            });
        }, 2000);
    }

    // Выбор лучших файлов из торрента
    function selectBestFiles(files) {
        if (!files || files.length === 0) return 'all';

        // Фильтруем видео файлы
        var videoFiles = files.filter(function(file) {
            var ext = file.path.split('.').pop().toLowerCase();
            return ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'm4v'].indexOf(ext) !== -1;
        });

        if (videoFiles.length === 0) {
            // Выбираем все файлы если видео не найдено
            return 'all';
        }

        // Сортируем по размеру (больше = лучше качество)
        videoFiles.sort(function(a, b) {
            return b.bytes - a.bytes;
        });

        // Выбираем самые большие файлы
        var selectedIds = videoFiles.slice(0, Math.min(5, videoFiles.length)).map(function(f) {
            return f.id;
        }).join(',');

        return selectedIds;
    }

    // Получение ссылок для стриминга
    function getStreamLinks(torrentData, callback) {
        if (!torrentData.links || torrentData.links.length === 0) {
            callback({ success: false, error: 'Нет доступных ссылок' });
            return;
        }

        var links = torrentData.links;
        var streamUrls = [];
        var processed = 0;

        // Разблокируем каждую ссылку
        links.forEach(function(link) {
            unrestrict(link, function(result) {
                processed++;
                
                if (result.success) {
                    streamUrls.push({
                        url: result.url,
                        filename: result.filename,
                        quality: detectQuality(result.filename)
                    });
                }

                // Когда все ссылки обработаны
                if (processed === links.length) {
                    if (streamUrls.length > 0) {
                        // Сортируем по качеству
                        streamUrls.sort(function(a, b) {
                            var qualityOrder = { '2160p': 4, '1080p': 3, '720p': 2, '480p': 1 };
                            return (qualityOrder[b.quality] || 0) - (qualityOrder[a.quality] || 0);
                        });

                        callback({ 
                            success: true, 
                            streams: streamUrls,
                            torrentData: torrentData
                        });
                    } else {
                        callback({ success: false, error: 'Не удалось разблокировать ссылки' });
                    }
                }
            });
        });
    }

    // Определение качества из имени файла
    function detectQuality(filename) {
        var name = filename.toLowerCase();
        
        if (name.indexOf('2160p') !== -1 || name.indexOf('4k') !== -1) return '2160p';
        if (name.indexOf('1080p') !== -1) return '1080p';
        if (name.indexOf('720p') !== -1) return '720p';
        if (name.indexOf('480p') !== -1) return '480p';
        
        return '1080p'; // по умолчанию
    }

    // Интеграция с парсером торрентов Lampa
    function hookTorrentParser() {
        console.log('[RealDebrid] Подключение к торрент-парсеру');

        // Перехватываем обработку торрентов
        var originalParser = Lampa.Activity.active().activity;
        
        Lampa.Listener.follow('torrent', function(e) {
            if (e.method === 'play' && RealDebrid.settings.enabled && RealDebrid.settings.streaming) {
                handleTorrentPlay(e.data);
            }
        });
    }

    // Обработка воспроизведения торрента
    function handleTorrentPlay(data) {
        if (!data || !data.magnet) {
            console.log('[RealDebrid] Нет magnet ссылки');
            return;
        }

        console.log('[RealDebrid] Обработка воспроизведения торрента');

        processTorrent(data.magnet, function(result) {
            if (result.success && result.streams.length > 0) {
                // Показываем список качеств или запускаем лучшее
                if (RealDebrid.settings.autoSelect) {
                    playStream(result.streams[0].url);
                } else {
                    showStreamSelector(result.streams);
                }
            } else {
                Lampa.Noty.show('Ошибка Real-Debrid: ' + (result.error || 'Неизвестная ошибка'));
            }
        });
    }

    // Воспроизведение потока
    function playStream(url) {
        console.log('[RealDebrid] Запуск стрима:', url);
        
        var player = {
            url: url,
            title: 'Real-Debrid Stream',
            quality: true
        };

        Lampa.Player.play(player);
        Lampa.Player.playlist([player]);
    }

    // Показ селектора качества
    function showStreamSelector(streams) {
        var items = streams.map(function(stream) {
            return {
                title: stream.quality + ' - ' + stream.filename,
                url: stream.url,
                quality: stream.quality
            };
        });

        Lampa.Select.show({
            title: 'Выберите качество',
            items: items,
            onSelect: function(item) {
                playStream(item.url);
            },
            onBack: function() {
                Lampa.Controller.toggle('content');
            }
        });
    }

    // Создаем публичный API плагина
    window.RealDebridPlugin = {
        init: init,
        processTorrent: processTorrent,
        addTorrent: addTorrent,
        unrestrict: unrestrict,
        settings: RealDebrid.settings
    };

    // Автозапуск при загрузке Lampa
    if (window.Lampa) {
        Lampa.Listener.follow('app', function(e) {
            if (e.type === 'ready') {
                init();
            }
        });
    }

})();
