# Геокодирование (geo + Dadata)

Статус: реализовано (сервис `geo`, Dadata подключён — реальные ключи работают)
Дата: 2026-08-31

## Решения

- Провайдер: **Dadata**.
- Функции: подсказки адресов, геокодирование (адрес → координаты), обратное геокодирование (координаты → адрес + данные дома), данные организаций (юрлица), адресная аналитика (количество квартир, этажей).
- Размещение: **отдельный сервис `geo`** (контейнер в составе dmap).
- Стек: **NestJS** (консистентно с `api`), кэш — **Redis**.
- Ключи Dadata: **подключены** (`GEO_PROVIDER=dadata`), провайдер проверен E2E через прокси — suggest/forward/reverse/company работают с реальными ключами.
- Срок: строится **после завершения фазы 2** (не разрываем ядро объектов).

## Архитектура

```
web → proxy(/geo/*) → geo(:3300)  → Dadata (ключи только на сервере)
                        │
                        └→ Redis (кэш адресов, экономия платной квоты)
```

- `geo` проверяет JWT тем же `JWT_SECRET`, что и `api` — защита платной квоты Dadata от прямых вызовов.
- Ключи живут только в env сервиса `geo`, не попадают в браузер.
- Запросы к Dadata выполняются только с сервера.

## Эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/geo/health` | healthcheck |
| GET | `/geo/suggest?query=…` | подсказки адресов (для формы дома) |
| GET | `/geo/forward?address=…` | адрес → координаты |
| GET | `/geo/reverse?lat=..&lon=..` | координаты → адрес + данные дома |
| GET | `/geo/company?query=…` | данные организаций (юрлица/корпоративные клиенты) |

## Данные дома

Расширение `attrs_schema` типа `house`: `fias_id`, `kladr_id`, `address_normalized`, `floors`, `apartments`.

> Точный набор полей Dadata по этажам/квартирам уточняется при получении ключей (проверка на реальных ответах API).

## Кэш

- Redis: ключ по нормализованному запросу, значение — ответ Dadata.
- Экономия платной квоты: повторные запросы не ходят в Dadata.
- TTL 7 дней; при недоступном Redis — in-memory кэш в контейнере `geo` (с `GEO_PROVIDER=mock` Redis можно не поднимать).

## Реализованные эндпоинты (NestJS, порт 3300, JWT тем же `JWT_SECRET`)

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/geo/health` | healthcheck (без JWT) |
| GET | `/geo/suggest?query=…` | подсказки адресов (mock: предзаполненные адреса Сочи) |
| GET | `/geo/forward?address=…` | адрес → координаты |
| GET | `/geo/reverse?lat=..&lon=..` | координаты → адрес + данные дома (floors/apartments) |
| GET | `/geo/company?query=…` | данные организаций (mock: 3 компании) |

Структура ответов:

- `suggest` / `company` → `{ suggestions: [...] }` с полями `value`, `fiasId`, `kladrId`, `lat`, `lon` / `name`, `inn`, `kpp`, `ogrn`, `address`.
- `forward` → `{ address, fiasId, kladrId, lat, lon }`, 404 если не найден.
- `reverse` → `{ address, fiasId, kladrId, lat, lon, floors, apartments }`, 404 если не найден.

## Интеграция в web

- `web/src/api.js`: `api.geo.suggest/forward/reverse/company` через `/geo/*` (прокси).
- Форма дома (тип `house`): поле `address` — автоподсказки Dadata (suggest, дебаунс 300 мс, выбор заполняет fias_id/kladr_id), кнопка «Определить адрес по точке» (reverse по координатам точки → заполняет address/fias/kladr/floors/apartments).
- `attrsSchema` типа `house` расширена полями `fias_id`, `kladr_id`, `address_normalized`, `floors`, `apartments` (миграция `1700000000005-house-geo-attrs`).

## Переключение провайдера

- `GEO_PROVIDER=mock`: заготовленные ответы по всем 4 функциям.
- `GEO_PROVIDER=dadata` (сейчас): реальные вызовы API.
- Структура ответов одинаковая в обоих режимах → фронт не меняется при переключении.

## Важно: хост API Dadata

Провайдер должен использовать хост **`suggestions.dadata.ru`** (с «ions»), а не `suggest.dadata.ru`.

Оба имени резолвятся в один IP (185.65.148.8), но за ним стоит QRATOR WAF, который обслуживает виртуальные хосты по-разному:
- `suggestions.dadata.ru` → реальный API (JSON).
- `suggest.dadata.ru` → 301/HTML главной страницы dadata.ru для всех запросов.

Симптом неверного хоста: `SyntaxError: Unexpected token '<'` (HTML вместо JSON) из провайдера, 301 `Server: QRATOR` при прямых запросах. Блокировка при этом **не связана с IP/гео/файнгерпринтом** — проверено со всех узлов мира.

## Проверки перед подключением Dadata

- Исходящий HTTPS из контейнера `geo` (внешний доступ на сервере нестабилен: npm/docker работают, Geofabrik отдаёт 503, maplibre.org таймаутил).
- Реальный формат ответов (сопоставить с mock-структурой) — провайдер проверен: suggest (Сочи), forward, reverse, company (Сбербанк) работают с ключами.

## Файлы/env

- `.env`: `GEO_PROVIDER`, `DADATA_API_KEY`, `DADATA_SECRET`, `GEO_PORT`; `REDIS_HOST`/`REDIS_PORT` (для контейнера `geo` — из compose).
- nginx: `location /geo/` → `geo`.
- compose: сервисы `geo` (./geo), `redis` (redis:7-alpine).
