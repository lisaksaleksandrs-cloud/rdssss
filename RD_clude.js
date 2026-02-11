(function() {
    'use strict';

    var RealDebrid = {
        apiUrl: 'https://api.real-debrid.com/rest/1.0',
        token: '',
        cache: {},
        settings: {
            enabled: false,
            autoSelect: true,
            preferredQuality: '1080p',
            streaming: true,
            cacheTimeout: 300000, // 5 минут
            showNotifications: true,
            debugMode: false
        }
    };

    // Логирование
    function log(message, data) {
        if (RealDebrid.settings.debugMode) {
            console.log('[RealDebrid] ' + message, data || '');
        }
    }

    // Показать уведомление
    function notify(message, type) {
        if (RealDebrid.settings.showNotifications && window.Lampa && Lampa.Noty) {
            Lampa.Noty.show(message);
        }
        log(message);
    }

    // Инициализация
    function init() {
        log('Инициализация плагина Real-Debrid');
        
        loadSettings();
        setupUI();
        hookIntoLampa();
        
        log('Плагин инициализирован', RealDebrid.settings);
    }

    // Загрузка настроек
    function loadSettings() {
        if (window.Lampa && Lampa.Storage) {
            var stored = Lampa.Storage.get('realdebrid_settings');
            if (stored) {
                Object.assign(RealDebrid.settings, stored.settings || {});
                RealDebrid.token = stored.token || '';
                log('Настройки загружены');
            }
        }
    }

    // Сохранение настроек
    function saveSettings() {
        if (window.Lampa && Lampa.Storage) {
            Lampa.Storage.set('realdebrid_settings', {
                settings: RealDebrid.settings,
                token: RealDebrid.token
            });
            log('Настройки сохранены');
        }
    }

    // Настройка UI
    function setupUI() {
        if (!window.Lampa || !Lampa.SettingsApi) return;

        // Добавляем компонент в настройки
        Lampa.SettingsApi.addComponent({
            component: 'realdebrid',
            name: 'Real-Debrid',
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
        });

        // Основные настройки
        addSetting('realdebrid_enabled', 'trigger', false, 'Включить Real-Debrid', 
            'Активировать интеграцию с Real-Debrid', function(value) {
                RealDebrid.settings.enabled = value;
                saveSettings();
                if (value && !RealDebrid.token) {
                    notify('Установите API токен в настройках');
                }
            });

        addSetting('realdebrid_token', 'input', '', 'API токен',
            'Токен от real-debrid.com/apitoken', function(value) {
                RealDebrid.token = value.trim();
                saveSettings();
                if (value) validateToken(value);
            });

        addSetting('realdebrid_streaming', 'trigger', true, 'Режим стриминга',
            'Включить прямой стриминг торрентов', function(value) {
                RealDebrid.settings.streaming = value;
                saveSettings();
            });

        addSetting('realdebrid_quality', 'select', '1080p', 'Предпочитаемое качество',
            'Приоритет качества видео', function(value) {
                RealDebrid.settings.preferredQuality = value;
                saveSettings();
            }, {
                '2160p': '2160p (4K UHD)',
                '1080p': '1080p (Full HD)',
                '720p': '720p (HD)',
                '480p': '480p (SD)',
                'auto': 'Автоматически'
            });

        addSetting('realdebrid_autoselect', 'trigger', true, 'Автовыбор файлов',
            'Автоматически выбирать лучший файл', function(value) {
                RealDebrid.settings.autoSelect = value;
                saveSettings();
            });

        addSetting('realdebrid_notifications', 'trigger', true, 'Уведомления',
            'Показывать уведомления о статусе', function(value) {
                RealDebrid.settings.showNotifications = value;
                saveSettings();
            });

        addSetting('realdebrid_debug', 'trigger', false, 'Режим отладки',
            'Включить подробное логирование', function(value) {
                RealDebrid.settings.debugMode = value;
                saveSettings();
            });

        // Кнопка очистки кэша
        Lampa.SettingsApi.addParam({
            component: 'realdebrid',
            param: {
                name: 'realdebrid_clear_cache',
                type: 'button'
            },
            field: {
                name: 'Очистить кэш',
                description: 'Удалить кэшированные данные Real-Debrid'
            },
            onSelect: function() {
                RealDebrid.cache = {};
                notify('Кэш очищен');
            }
        });

        // Кнопка проверки аккаунта
        Lampa.SettingsApi.addParam({
            component: 'realdebrid',
            param: {
                name: 'realdebrid_check_account',
                type: 'button'
            },
            field: {
                name: 'Проверить аккаунт',
                description: 'Проверить статус подписки Real-Debrid'
            },
            onSelect: function() {
                checkAccountStatus();
            }
        });
    }

    // Вспомогательная функция для добавления настроек
    function addSetting(name, type, defaultValue, title, description, onChange, values) {
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
    }

    // Проверка токена
    function validateToken(token) {
        apiRequest('/user', function(result) {
            if (result.success) {
                var user = result.data;
                var expiry = new Date(user.expiration);
                var daysLeft = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));
                
                notify('✓ Подключено к Real-Debrid\nПользователь: ' + user.username + 
                       '\nПодписка до: ' + expiry.toLocaleDateString() + 
                       ' (' + daysLeft + ' дней)');
                log('Токен валидный', user);
            } else {
                notify('✗ Ошибка токена Real-Debrid: ' + (result.error || 'Неверный токен'));
                RealDebrid.settings.enabled = false;
                saveSettings();
            }
        }, token);
    }

    // Проверка статуса аккаунта
    function checkAccountStatus() {
        if (!RealDebrid.token) {
            notify('Токен не установлен');
            return;
        }

        apiRequest('/user', function(result) {
            if (result.success) {
                var user = result.data;
                var info = 'Аккаунт: ' + user.username + '\n' +
                          'Тип: ' + user.type + '\n' +
                          'Точек: ' + user.points + '\n' +
                          'Действителен до: ' + new Date(user.expiration).toLocaleDateString();
                notify(info);
            } else {
                notify('Ошибка проверки аккаунта: ' + result.error);
            }
        });
    }

    // API запрос
    function apiRequest(endpoint, callback, customToken, method) {
        var token = customToken || RealDebrid.token;
        method = method || 'GET';
        
        if (!token && endpoint !== '/user') {
            callback({ success: false, error: 'Токен не установлен' });
            return;
        }

        var url = RealDebrid.apiUrl + endpoint;
        
        // Проверяем кэш для GET запросов
        if (method === 'GET' && RealDebrid.cache[url]) {
            var cached = RealDebrid.cache[url];
            if (Date.now() - cached.timestamp < RealDebrid.settings.cacheTimeout) {
                log('Использование кэша для ' + endpoint);
                callback({ success: true, data: cached.data, cached: true });
                return;
            }
        }

        log('API запрос: ' + method + ' ' + endpoint);

        if (window.Lampa && Lampa.Utils && Lampa.Utils.ajax) {
            Lampa.Utils.ajax({
                url: url,
                method: method,
                headers: {
                    'Authorization': 'Bearer ' + token
                },
                timeout: 15000,
                success: function(data) {
                    // Кэшируем успешные GET запросы
                    if (method === 'GET') {
                        RealDebrid.cache[url] = {
                            data: data,
                            timestamp: Date.now()
                        };
                    }
                    callback({ success: true, data: data });
                },
                error: function(xhr) {
                    var error = 'Network error';
                    if (xhr.status === 401) error = 'Неверный токен';
                    else if (xhr.status === 403) error = 'Доступ запрещен';
                    else if (xhr.status === 503) error = 'Сервис недоступен';
                    else if (xhr.responseText) {
                        try {
                            var err = JSON.parse(xhr.responseText);
                            error = err.error || err.message || error;
                        } catch(e) {}
                    }
                    
                    log('API ошибка: ' + xhr.status + ' - ' + error);
                    callback({ success: false, error: error, status: xhr.status });
                }
            });
        } else {
            // Fallback на fetch если Lampa.Utils недоступен
            fetch(url, {
                method: method,
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
                callback({ success: true, data: data });
            })
            .catch(function(error) {
                callback({ success: false, error: error.message });
            });
        }
    }

    // POST запрос
    function apiPost(endpoint, data, callback) {
        if (!RealDebrid.token) {
            callback({ success: false, error: 'Токен не установлен' });
            return;
        }

        var url = RealDebrid.apiUrl + endpoint;
        log('API POST: ' + endpoint, data);

        // Формируем URL-encoded данные
        var formData = [];
        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                formData.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
            }
        }
        var body = formData.join('&');

        if (window.Lampa && Lampa.Utils && Lampa.Utils.ajax) {
            Lampa.Utils.ajax({
                url: url,
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + RealDebrid.token,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: body,
                timeout: 15000,
                success: function(response) {
                    callback({ success: true, data: response });
                },
                error: function(xhr) {
                    var error = 'Network error';
                    try {
                        var err = JSON.parse(xhr.responseText);
                        error = err.error || err.message || error;
                    } catch(e) {}
                    
                    log('API POST ошибка: ' + error);
                    callback({ success: false, error: error });
                }
            });
        } else {
            // Fallback
            fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + RealDebrid.token,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body
            })
            .then(function(response) {
                return response.json();
            })
            .then(function(data) {
                callback({ success: true, data: data });
            })
            .catch(function(error) {
                callback({ success: false, error: error.message });
            });
        }
    }

    // Интеграция с Lampa
    function hookIntoLampa() {
        if (!window.Lampa) return;

        log('Подключение к событиям Lampa');

        // Слушаем события торрентов
        Lampa.Listener.follow('torrent', function(e) {
            if (!RealDebrid.settings.enabled || !RealDebrid.settings.streaming) return;
            
            log('Событие торрента', e);

            if (e.method === 'play' && e.data && e.data.magnet) {
                e.preventDefault && e.preventDefault();
                handleTorrentLink(e.data.magnet, e.data);
            }
        });

        // Добавляем кнопку в контекстное меню торрентов
        if (Lampa.Context) {
            Lampa.Context.add('torrent_item', {
                title: 'Через Real-Debrid',
                icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>',
                onSelect: function(item) {
                    if (item.magnet) {
                        handleTorrentLink(item.magnet, item);
                    }
                }
            });
        }
    }

    // Обработка торрент-ссылки
    function handleTorrentLink(magnetLink, metadata) {
        if (!RealDebrid.token) {
            notify('Настройте токен Real-Debrid');
            return;
        }

        log('Обработка магнет-ссылки', magnetLink.substring(0, 50) + '...');
        notify('Real-Debrid: Обработка торрента...');

        processTorrent(magnetLink, function(result) {
            if (result.success) {
                log('Торрент обработан успешно', result);
                
                if (result.streams && result.streams.length > 0) {
                    if (RealDebrid.settings.autoSelect) {
                        var bestStream = selectBestStream(result.streams);
                        playVideo(bestStream, metadata);
                    } else {
                        showStreamSelector(result.streams, metadata);
                    }
                } else {
                    notify('Нет доступных файлов для воспроизведения');
                }
            } else {
                notify('Ошибка Real-Debrid: ' + (result.error || 'Неизвестная ошибка'));
                log('Ошибка обработки торрента', result);
            }
        });
    }

    // Обработка торрента
    function processTorrent(magnetLink, callback) {
        // Шаг 1: Добавляем торрент
        apiPost('/torrents/addMagnet', { magnet: magnetLink }, function(addResult) {
            if (!addResult.success) {
                callback(addResult);
                return;
            }

            var torrentId = addResult.data.id;
            log('Торрент добавлен, ID: ' + torrentId);

            // Шаг 2: Ждем и получаем информацию
            setTimeout(function() {
                checkTorrentStatus(torrentId, callback, 0);
            }, 1500);
        });
    }

    // Проверка статуса торрента
    function checkTorrentStatus(torrentId, callback, attempt) {
        if (attempt > 40) {
            callback({ success: false, error: 'Таймаут обработки торрента' });
            return;
        }

        apiRequest('/torrents/info/' + torrentId, function(result) {
            if (!result.success) {
                callback(result);
                return;
            }

            var torrent = result.data;
            var status = torrent.status;
            
            log('Статус торрента: ' + status + ' (попытка ' + (attempt + 1) + ')');

            if (status === 'waiting_files_selection') {
                // Выбираем файлы
                var fileIds = selectVideoFiles(torrent.files);
                log('Выбор файлов: ' + fileIds);

                apiPost('/torrents/selectFiles/' + torrentId, { files: fileIds }, function(selectResult) {
                    if (!selectResult.success) {
                        callback(selectResult);
                        return;
                    }
                    
                    setTimeout(function() {
                        checkTorrentStatus(torrentId, callback, attempt + 1);
                    }, 2000);
                });
            } else if (status === 'downloaded') {
                // Готово к стримингу
                notify('Real-Debrid: Торрент готов');
                getStreamingLinks(torrent, callback);
            } else if (status === 'downloading' || status === 'queued') {
                var progress = torrent.progress || 0;
                if (attempt % 3 === 0) {
                    notify('Real-Debrid: Загрузка ' + progress + '%');
                }
                setTimeout(function() {
                    checkTorrentStatus(torrentId, callback, attempt + 1);
                }, 2000);
            } else if (status === 'error' || status === 'virus' || status === 'dead') {
                callback({ success: false, error: 'Ошибка торрента: ' + status });
            } else {
                // Другие статусы - продолжаем ждать
                setTimeout(function() {
                    checkTorrentStatus(torrentId, callback, attempt + 1);
                }, 2000);
            }
        });
    }

    // Выбор видео файлов
    function selectVideoFiles(files) {
        if (!files || files.length === 0) return 'all';

        var videoExtensions = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'm4v', 'webm', 'ts', 'm2ts'];
        
        var videoFiles = files.filter(function(file) {
            var ext = file.path.split('.').pop().toLowerCase();
            return videoExtensions.indexOf(ext) !== -1 && file.bytes > 50 * 1024 * 1024; // > 50MB
        });

        if (videoFiles.length === 0) {
            return 'all';
        }

        // Сортируем по размеру
        videoFiles.sort(function(a, b) {
            return b.bytes - a.bytes;
        });

        // Берем топ файлов
        var selected = videoFiles.slice(0, Math.min(10, videoFiles.length));
        return selected.map(function(f) { return f.id; }).join(',');
    }

    // Получение ссылок для стриминга
    function getStreamingLinks(torrent, callback) {
        if (!torrent.links || torrent.links.length === 0) {
            callback({ success: false, error: 'Нет доступных ссылок' });
            return;
        }

        var links = torrent.links;
        var streams = [];
        var processed = 0;

        log('Разблокировка ' + links.length + ' ссылок');

        links.forEach(function(link, index) {
            apiPost('/unrestrict/link', { link: link }, function(result) {
                processed++;

                if (result.success) {
                    var quality = detectQuality(result.data.filename);
                    streams.push({
                        url: result.data.download,
                        filename: result.data.filename,
                        quality: quality,
                        size: result.data.filesize || 0,
                        index: index
                    });
                }

                if (processed === links.length) {
                    if (streams.length > 0) {
                        // Сортируем по качеству и размеру
                        streams.sort(function(a, b) {
                            var qualityOrder = { '2160p': 4, '1080p': 3, '720p': 2, '480p': 1, 'unknown': 0 };
                            var qDiff = (qualityOrder[b.quality] || 0) - (qualityOrder[a.quality] || 0);
                            return qDiff !== 0 ? qDiff : b.size - a.size;
                        });

                        callback({ success: true, streams: streams, torrent: torrent });
                    } else {
                        callback({ success: false, error: 'Не удалось разблокировать ссылки' });
                    }
                }
            });
        });
    }

    // Определение качества
    function detectQuality(filename) {
        var name = filename.toLowerCase();
        
        if (name.indexOf('2160p') !== -1 || name.indexOf('4k') !== -1 || name.indexOf('uhd') !== -1) {
            return '2160p';
        }
        if (name.indexOf('1080p') !== -1 || name.indexOf('fhd') !== -1) {
            return '1080p';
        }
        if (name.indexOf('720p') !== -1 || name.indexOf('hd') !== -1) {
            return '720p';
        }
        if (name.indexOf('480p') !== -1 || name.indexOf('sd') !== -1) {
            return '480p';
        }
        
        return 'unknown';
    }

    // Выбор лучшего стрима
    function selectBestStream(streams) {
        var preferred = RealDebrid.settings.preferredQuality;
        
        // Ищем стрим с предпочитаемым качеством
        var match = streams.find(function(s) {
            return s.quality === preferred;
        });

        return match || streams[0]; // Или первый (лучший)
    }

    // Показ селектора качества
    function showStreamSelector(streams, metadata) {
        if (!window.Lampa || !Lampa.Select) {
            playVideo(streams[0], metadata);
            return;
        }

        var items = streams.map(function(stream) {
            var sizeText = stream.size ? ' (' + formatFileSize(stream.size) + ')' : '';
            return {
                title: stream.quality + ' - ' + stream.filename + sizeText,
                stream: stream
            };
        });

        Lampa.Select.show({
            title: 'Выберите качество',
            items: items,
            onSelect: function(item) {
                playVideo(item.stream, metadata);
            },
            onBack: function() {
                Lampa.Controller.toggle('content');
            }
        });
    }

    // Форматирование размера файла
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }

    // Воспроизведение видео
    function playVideo(stream, metadata) {
        if (!window.Lampa || !Lampa.Player) {
            log('Lampa.Player недоступен');
            return;
        }

        log('Запуск воспроизведения', stream);
        notify('Запуск: ' + stream.quality + ' - ' + stream.filename);

        var player = {
            url: stream.url,
            title: metadata?.title || stream.filename,
            quality: stream.quality,
            timeline: metadata?.timeline,
            subtitles: metadata?.subtitles || []
        };

        Lampa.Player.play(player);
        Lampa.Player.playlist([player]);
    }

    // Публичный API
    window.RealDebridPlugin = {
        init: init,
        processTorrent: processTorrent,
        apiRequest: apiRequest,
        apiPost: apiPost,
        settings: RealDebrid.settings,
        version: '1.0.0'
    };

    // Автостарт
    if (window.Lampa) {
        Lampa.Listener.follow('app', function(e) {
            if (e.type === 'ready') {
                init();
            }
        });
    } else {
        // Если Lampa еще не загружена
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(init, 1000);
        });
    }

})();
