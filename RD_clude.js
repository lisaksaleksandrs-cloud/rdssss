{
  "name": "Real-Debrid",
  "author": "RD Plugin Dev",
  "version": "1.0.0",
  "description": "Интеграция Real-Debrid для стриминга торрентов в Lampa",
  "icon": "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 2L2 7L12 12L22 7L12 2Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M2 17L12 22L22 17\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M2 12L12 17L22 12\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
  "type": "service",
  "url": "realdebrid.js",
  "min_lampa_version": "1.8.0",
  "permissions": [
    "network",
    "storage",
    "torrent"
  ],
  "settings": true,
  "features": [
    "Стриминг торрентов через Real-Debrid",
    "Автоматическая обработка magnet-ссылок",
    "Выбор качества видео",
    "Интеграция с торрент-парсерами Lampa",
    "Кэширование популярных торрентов"
  ],
  "requirements": {
    "real_debrid_subscription": true,
    "internet_connection": true
  },
  "api": {
    "endpoint": "https://api.real-debrid.com/rest/1.0",
    "auth_type": "bearer_token"
  }
}
