(function() {
    'use strict';

    // Проверка доступности Lampa
    if (typeof Lampa === 'undefined') {
        console.error('[RealDebrid] Lampa не найдена!');
        return;
    }

    var RealDebrid = {
        apiUrl: 'https://api.real-debrid.com/rest/1.0',
        token: '',
        cache: {},
        settings: {
            enabled: false,
            autoSelect: true,
            preferredQuality: '1080p',
            streaming: true,
            cacheTimeout: 300000,
            showNotifications: true,
            debugMode: false
        }
    };

    // Безопасное логирование
    function log(message, data) {
        if (RealDebrid.settings.debugMode) {
            console.log('[RealDebrid] ' + message, data || '');
        }
    }

    // Безопасное уведомление
    function notify(message) {
        try {
            if (RealDebrid.settings.showNotifications && Lampa && Lampa.Noty) {
                Lampa.Noty.show(message);
            }
        } catch(e) {
            console.log('[RealDebrid] ' + message);
        }
        log(message);
    }

    // Инициализация плагина
    function init() {
        log('Запуск инициализации плагина');
        
        try {
            loadSettings();
            setupUI();
            hookIntoLampa();
            log('Плагин успешно инициализирован');
        } catch(error) {
            console.error('[RealDebrid] Ошибка инициализации:', error);
        }
    }

    // Загрузка настроек
    function loadSettings() {
        try {
            if (!Lampa.Storage) return;
            
            var stored = Lampa.Storage.get('realdebrid_settings');
            if (stored && stored.settings) {
                Object.assign(RealDebrid.settings, stored.settings);
                RealDebrid.token = stored.token || '';
                log('Настройки загружены', RealDebrid.settings);
            }
        } catch(error) {
            console.error('[RealDebrid] Ошибка загрузки настроек:', error);
        }
    }

    // Сохранение настроек
    function saveSettings() {
        try {
            if (!Lampa.Storage) return;
            
            Lampa.Storage.set('realdebrid_settings', {
                settings: RealDebrid.settings,
                token: RealDebrid.token
            });
            log('Настройки сохранены');
        } catch(error) {
            console.error('[RealDebrid] Ошибка сохранения настроек:', error);
        }
    }

    // Настройка интерфейса
    function setupUI() {
        try {
            if (!Lampa.SettingsApi) {
                log('Lampa.SettingsApi недоступен');
                return;
            }

            // Добавляем раздел в настройки
            Lampa.SettingsApi.addComponent({
                component: 'realdebrid',
                name: 'Real-Debrid',
                icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
            });

            // Добавляем настройки
            addSetting('realdebrid_enabled', 'trigger', false, 
                'Включить Real-Debrid', 
                'Активировать интеграцию с Real-Debrid', 
                function(value) {
                    RealDebrid.settings.enabled = value;
                    saveSettings();
                    if (value && !RealDebrid.token) {
                        notify('⚠️ Установите API токен в настройках');
                    }
                }
            );

            addSetting('realdebrid_token', 'input', '', 
                'API токен',
                'Токен от real-debrid.com/apitoken', 
                function(value) {
                    RealDebrid.token = value ? value.trim() : '';
                    saveSettings();
                    if (RealDebrid.token) {
                        validateToken(RealDebrid.token);
                    }
                }
            );

            addSetting('realdebrid_streaming', 'trigger', true, 
                'Режим стриминга',
                'Включить прямой стриминг торрентов', 
                function(value) {
                    RealDebrid.settings.streaming = value;
                    saveSettings();
                }
            );

            addSetting('realdebrid_quality', 'select', '1080p', 
                'Предпочитаемое качество',
                'Приоритет качества видео', 
                function(value) {
                    RealDebrid.settings.preferredQuality = value;
                    saveSettings();
                },
                {
                    '2160p': '2160p (4K UHD)',
                    '1080p': '1080p (Full HD)',
                    '720p': '720p (HD)',
                    '480p': '480p (SD)'
                }
            );

            addSetting('realdebrid_autoselect', 'trigger', true, 
                'Автовыбор файлов',
                'Автоматически выбирать лучший файл', 
                function(value) {
                    RealDebrid.settings.autoSelect = value;
                    saveSettings();
                }
            );

            addSetting('realdebrid_notifications', 'trigger', true, 
                'Уведомления',
                'Показывать уведомления о статусе', 
                function(value) {
                    RealDebrid.settings.showNotifications = value;
                    saveSettings();
                }
            );

            addSetting('realdebrid_debug', 'trigger', false, 
                'Режим отладки',
                'Включить подробное логирование', 
                function(value) {
                    RealDebrid.settings.debugMode = value;
                    saveSettings();
                }
            );

            // Кнопка проверки аккаунта
            Lampa.SettingsApi.addParam({
                component: 'realdebrid',
                param: {
                    name: 'realdebrid_check',
                    type: 'button'
                },
                field: {
                    name: 'Проверить аккаунт',
                    description: 'Проверить статус Real-Debrid'
                },
                onSelect: function() {
                    checkAccount();
                }
            });

            // Кнопка очистки кэша
            Lampa.SettingsApi.addParam({
                component: 'realdebrid',
                param: {
                    name: 'realdebrid_clear',
                    type: 'button'
                },
                field: {
                    name: 'Очистить кэш',
                    description: 'Удалить кэшированные данные'
                },
                onSelect: function() {
                    RealDebrid.cache = {};
                    notify('✓ Кэш очищен');
                }
            });

            log('UI настроен успешно');
        } catch(error) {
            console.error('[RealDebrid] Ошибка настройки UI:', error);
        }
    }

    // Вспомогательная функция добавления настроек
    function addSetting(name, type, defaultValue, title, description, onChange, values) {
        try {
            if (!Lampa.SettingsApi) return;

            var param = {
                name: name,
                type: type,
                default: defaultValue
            };

            if (values) {
                param.values = values;
            }

            Lampa.SettingsApi.addParam({
                component: 'realdebrid',
                param: param,
                field: {
                    name: title,
                    description: description
                },
                onChange: onChange
            });
        } catch(error) {
            console.error('[RealDebrid] Ошибка добавления настройки ' + name + ':', error);
        }
    }

    // Проверка токена
    function validateToken(token) {
        apiRequest('/user', function(result) {
            if (result.success && result.data) {
                var user = result.data;
                var msg = '✓ Подключено к Real-Debrid\n' +
                         'Пользователь: ' + (user.username || 'Unknown');
                
                if (user.expiration) {
                    var expiry = new Date(user.expiration);
                    var days = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));
                    msg += '\nПодписка: ' + days + ' дней';
                }
                
                notify(msg);
            } else {
                notify('✗ Ошибка токена: ' + (result.error || 'Неверный токен'));
                RealDebrid.settings.enabled = false;
                saveSettings();
            }
        }, token);
    }

    // Проверка аккаунта
    function checkAccount() {
        if (!RealDebrid.token) {
            notify('⚠️ Токен не установлен');
            return;
        }

        apiRequest('/user', function(result) {
            if (result.success && result.data) {
                var u = result.data;
                var info = 'Аккаунт: ' + (u.username || 'Unknown') + '\n' +
                          'Тип: ' + (u.type || 'unknown') + '\n' +
                          'Точек: ' + (u.points || 0);
                
                if (u.expiration) {
                    info += '\nДо: ' + new Date(u.expiration).toLocaleDateString();
                }
                
                notify(info);
            } else {
                notify('Ошибка: ' + (result.error || 'Не удалось получить данные'));
            }
        });
    }

    // API запрос
    function apiRequest(endpoint, callback, customToken) {
        var token = customToken || RealDebrid.token;
        
        if (!token && endpoint !== '/user') {
            callback({ success: false, error: 'Токен не установлен' });
            return;
        }

        var url = RealDebrid.apiUrl + endpoint;
        
        // Проверка кэша
        if (RealDebrid.cache[url]) {
            var cached = RealDebrid.cache[url];
            if (Date.now() - cached.timestamp < RealDebrid.settings.cacheTimeout) {
                callback({ success: true, data: cached.data, cached: true });
                return;
            }
        }

        log('GET ' + endpoint);

        try {
            fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            })
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.json();
            })
            .then(function(data) {
                RealDebrid.cache[url] = {
                    data: data,
                    timestamp: Date.now()
                };
                callback({ success: true, data: data });
            })
            .catch(function(error) {
                log('API Error: ' + error.message);
                callback({ success: false, error: error.message });
            });
        } catch(error) {
            callback({ success: false, error: error.message });
        }
    }

    // POST запрос
    function apiPost(endpoint, data, callback) {
        if (!RealDebrid.token) {
            callback({ success: false, error: 'Токен не установлен' });
            return;
        }

        var url = RealDebrid.apiUrl + endpoint;
        
        // Формируем форм-дата
        var formData = [];
        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                formData.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
            }
        }
        var body = formData.join('&');

        log('POST ' + endpoint);

        try {
            fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + RealDebrid.token,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body
            })
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.json();
            })
            .then(function(data) {
                callback({ success: true, data: data });
            })
            .catch(function(error) {
                log('POST Error: ' + error.message);
                callback({ success: false, error: error.message });
            });
        } catch(error) {
            callback({ success: false, error: error.message });
        }
    }

    // Интеграция с Lampa
    function hookIntoLampa() {
        try {
            if (!Lampa.Listener) {
                log('Lampa.Listener недоступен');
                return;
            }

            log('Подключение к событиям Lampa');

            // Слушаем события
            Lampa.Listener.follow('torrent', function(e) {
                try {
                    if (!RealDebrid.settings.enabled || !RealDebrid.settings.streaming) {
                        return;
                    }
                    
                    if (e && e.method === 'play' && e.data && e.data.magnet) {
                        log('Перехвачен торрент');
                        if (e.preventDefault) e.preventDefault();
                        handleTorrent(e.data.magnet, e.data);
                    }
                } catch(error) {
                    console.error('[RealDebrid] Ошибка обработки события:', error);
                }
            });

            log('События подключены');
        } catch(error) {
            console.error('[RealDebrid] Ошибка подключения событий:', error);
        }
    }

    // Обработка торрента
    function handleTorrent(magnet, metadata) {
        if (!RealDebrid.token) {
            notify('⚠️ Настройте токен Real-Debrid');
            return;
        }

        log('Обработка торрента');
        notify('Real-Debrid: Обработка...');

        processTorrent(magnet, function(result) {
            if (result.success && result.streams && result.streams.length > 0) {
                if (RealDebrid.settings.autoSelect) {
                    var best = selectBestStream(result.streams);
                    playStream(best, metadata);
                } else {
                    showSelector(result.streams, metadata);
                }
            } else {
                notify('Ошибка: ' + (result.error || 'Нет файлов'));
            }
        });
    }

    // Обработка торрента
    function processTorrent(magnet, callback) {
        apiPost('/torrents/addMagnet', { magnet: magnet }, function(result) {
            if (!result.success) {
                callback(result);
                return;
            }

            var id = result.data.id;
            log('Торрент добавлен: ' + id);

            setTimeout(function() {
                checkStatus(id, callback, 0);
            }, 1500);
        });
    }

    // Проверка статуса
    function checkStatus(id, callback, attempt) {
        if (attempt > 40) {
            callback({ success: false, error: 'Таймаут' });
            return;
        }

        apiRequest('/torrents/info/' + id, function(result) {
            if (!result.success) {
                callback(result);
                return;
            }

            var torrent = result.data;
            var status = torrent.status;
            
            log('Статус: ' + status + ' (' + (attempt + 1) + ')');

            if (status === 'waiting_files_selection') {
                selectFiles(id, torrent.files, function(selectResult) {
                    if (selectResult.success) {
                        setTimeout(function() {
                            checkStatus(id, callback, attempt + 1);
                        }, 2000);
                    } else {
                        callback(selectResult);
                    }
                });
            } else if (status === 'downloaded') {
                notify('Real-Debrid: Готово!');
                getLinks(torrent, callback);
            } else if (status === 'downloading' || status === 'queued') {
                var progress = torrent.progress || 0;
                if (attempt % 3 === 0) {
                    notify('Загрузка: ' + progress + '%');
                }
                setTimeout(function() {
                    checkStatus(id, callback, attempt + 1);
                }, 2000);
            } else if (status === 'error' || status === 'virus' || status === 'dead') {
                callback({ success: false, error: 'Ошибка: ' + status });
            } else {
                setTimeout(function() {
                    checkStatus(id, callback, attempt + 1);
                }, 2000);
            }
        });
    }

    // Выбор файлов
    function selectFiles(id, files, callback) {
        if (!files || files.length === 0) {
            apiPost('/torrents/selectFiles/' + id, { files: 'all' }, callback);
            return;
        }

        var videoExts = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'm4v', 'webm', 'ts'];
        var videoFiles = files.filter(function(f) {
            var ext = (f.path || '').split('.').pop().toLowerCase();
            return videoExts.indexOf(ext) !== -1 && f.bytes > 50 * 1024 * 1024;
        });

        if (videoFiles.length === 0) {
            apiPost('/torrents/selectFiles/' + id, { files: 'all' }, callback);
            return;
        }

        videoFiles.sort(function(a, b) { return b.bytes - a.bytes; });
        var ids = videoFiles.slice(0, 10).map(function(f) { return f.id; }).join(',');
        
        apiPost('/torrents/selectFiles/' + id, { files: ids }, callback);
    }

    // Получение ссылок
    function getLinks(torrent, callback) {
        if (!torrent.links || torrent.links.length === 0) {
            callback({ success: false, error: 'Нет ссылок' });
            return;
        }

        var links = torrent.links;
        var streams = [];
        var done = 0;

        links.forEach(function(link) {
            apiPost('/unrestrict/link', { link: link }, function(result) {
                done++;
                
                if (result.success && result.data) {
                    streams.push({
                        url: result.data.download,
                        filename: result.data.filename || 'video',
                        quality: detectQuality(result.data.filename || ''),
                        size: result.data.filesize || 0
                    });
                }

                if (done === links.length) {
                    if (streams.length > 0) {
                        streams.sort(function(a, b) {
                            var qOrder = { '2160p': 4, '1080p': 3, '720p': 2, '480p': 1 };
                            var qDiff = (qOrder[b.quality] || 0) - (qOrder[a.quality] || 0);
                            return qDiff !== 0 ? qDiff : b.size - a.size;
                        });
                        callback({ success: true, streams: streams });
                    } else {
                        callback({ success: false, error: 'Не удалось получить ссылки' });
                    }
                }
            });
        });
    }

    // Определение качества
    function detectQuality(name) {
        var n = (name || '').toLowerCase();
        if (n.indexOf('2160p') !== -1 || n.indexOf('4k') !== -1) return '2160p';
        if (n.indexOf('1080p') !== -1) return '1080p';
        if (n.indexOf('720p') !== -1) return '720p';
        if (n.indexOf('480p') !== -1) return '480p';
        return '1080p';
    }

    // Выбор лучшего
    function selectBestStream(streams) {
        var pref = RealDebrid.settings.preferredQuality;
        var match = streams.find(function(s) { return s.quality === pref; });
        return match || streams[0];
    }

    // Показ селектора
    function showSelector(streams, metadata) {
        if (!Lampa.Select) {
            playStream(streams[0], metadata);
            return;
        }

        var items = streams.map(function(s) {
            var size = s.size ? ' (' + formatSize(s.size) + ')' : '';
            return {
                title: s.quality + ' - ' + s.filename + size,
                stream: s
            };
        });

        Lampa.Select.show({
            title: 'Выберите качество',
            items: items,
            onSelect: function(item) {
                playStream(item.stream, metadata);
            },
            onBack: function() {
                if (Lampa.Controller) {
                    Lampa.Controller.toggle('content');
                }
            }
        });
    }

    // Форматирование размера
    function formatSize(bytes) {
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }

    // Воспроизведение
    function playStream(stream, metadata) {
        if (!Lampa.Player) {
            log('Lampa.Player недоступен');
            return;
        }

        log('Запуск: ' + stream.url);
        notify('▶ ' + stream.quality + ' - ' + stream.filename);

        var player = {
            url: stream.url,
            title: (metadata && metadata.title) || stream.filename,
            quality: stream.quality
        };

        try {
            Lampa.Player.play(player);
            Lampa.Player.playlist([player]);
        } catch(error) {
            console.error('[RealDebrid] Ошибка запуска плеера:', error);
            notify('Ошибка воспроизведения');
        }
    }

    // Публичный API
    window.RealDebridPlugin = {
        init: init,
        processTorrent: processTorrent,
        settings: RealDebrid.settings,
        version: '1.1.0'
    };

    // Автозапуск
    if (Lampa && Lampa.Listener) {
        Lampa.Listener.follow('app', function(e) {
            if (e && e.type === 'ready') {
                init();
            }
        });
    }

    // Fallback
    setTimeout(function() {
        if (!window.RealDebridPlugin._initialized) {
            init();
            window.RealDebridPlugin._initialized = true;
        }
    }, 2000);

})();
