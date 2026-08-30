# ADR-002: Векторные тайлы объектов (Martin + MVT) и фильтрация по правам

Статус: принято
Дата: 2026-08-31

## Контекст

Web-карта (фаза 2.5) подгружала объекты как GeoJSON по bbox (per-type запросы на `/api/objects`). Это не масштабируется: N запросов на область, крупные ответы, нет кэширования. Требование фазы 2.4 — отдавать векторные тайлы (MVT) из PostGIS, при этом доступ к объектам должен фильтроваться по правам пользователя (permissions из JWT: `objects:<code>:read`).

Кандидат — Martin (single-binary tile-сервер, умеет PostGIS-источники как SQL-функции с параметрами).

## Ограничения (проверено)

- Docker Hub: только `martin` 0.8.0 (2023) — **нет** поддержки JWT вообще (проверено `strings`).
- Документация Martin v1.14.0: **Martin не включает встроенную аутентификацию** ("Martin doesn't include built-in auth"), рекомендован reverse proxy с `auth_request`.
- Martin передаёт в SQL-функцию PostGIS только `z`, `x`, `y` + `query_params` (JSON из URL-query). Заголовки до функции не доходят.
- На официальном образе в Docker Hub нет свежей версии → собран Martin v1.14.0 из исходников (без features `rendering/fonts/styles/webui`, которые тянут git-зависимость `maplibre-native` и ломают сборку).

## Решение

1. **SQL-функция** `tiles_objects(z int, x int, y int, query_params json DEFAULT NULL) RETURNS bytea` (PL/pgSQL, `STABLE STRICT`):
   - `ST_AsMVT` по `ST_TileEnvelope(z,x,y)` ∩ объектам;
   - фильтр типов из `query_params->>'types'` (CSV кодов типов);
   - без `types` возвращает NULL (тайл пустой) — несуществующий источник.
2. **nginx (proxy)** — схема JWT-фильтрации:
   - `location = /internal/tile-auth` (`internal`) → `auth_request` проксирует на `GET /api/me` (валидирует JWT, отдаёт `X-Object-Types: <коды read-типов>`);
   - `location ~ ^/tiles/objects/(z)/(x)/(y)$`: `auth_request /internal/tile-auth`, `auth_request_set $object_types $upstream_http_x_object_types`, затем `proxy_pass http://tiles/tiles_objects/$z/$x/$y?types=$object_types`.
   - Клиент не может подделать `types` — nginx перезаписывает query.
3. **api**: `GET /me` отдаёт заголовок `X-Object-Types` из permissions (`objects:<code>:read` или `*` → `*`).
4. **web (MapView)**: единый векторный source `src-objects` (`/tiles/objects/{z}/{x}/{y}`), слои-фильтры по `type` из каталога, видимость по правам (как в 2.6). GeoJSON-bbox-подгрузка убрана.
5. **Сборка**: `infra/tiles/Dockerfile` (ubuntu:24.04) + `config.yaml` (источник `tiles_objects`, bounds Сочи). Порт Martin — флаг `--listen-addresses 0.0.0.0:3200`.

## Следствия

Положительные:
- один запрос тайла вместо N GeoJSON-запросов; стандартный MVT-кэш у клиента/прокси;
- права не дублируются в web — web просто не получает типы без `read`-доступа;
- авторизация инкапсулирована в nginx + api, Martin остаётся без состояния auth.

Отрицательные/риски:
- бандл Martin (36 МБ) собран вручную и лежит в `.gitignore` — нужен артефакт/CI для воспроизводимой сборки (см. roadmap);
- PostGIS 3.4.3 < рекомендованного Martin 3.5.0 (warning о возможном скрытии геометрий на части zoom);
- фильтрация только на уровне тайла по типам; по-объектная фильтрация (территории и т.п.) — при необходимости позже.
