# Roadmap

Легенда статусов: ⬜ не начато | 🟡 в работе | ✅ готово | 🚫 отложено

## Фаза 0. Планирование и документация

| # | Задача | Статус | Примечание |
|---|--------|--------|------------|
| 0.1 | Исходное задание | ✅ | docs/01-tasks/initial-task.md |
| 0.2 | Сервисная архитектура (черновик) | ✅ | docs/02-architecture/services.md |
| 0.3 | Каталог объектов и слоёв (справочная модель) | ✅ | docs/03-objects/object-catalog.md |
| 0.4 | Модель доступа (роли, permissions) | ✅ | docs/04-access/access-model.md |
| 0.5 | Формат JWT и claims | ✅ | docs/04-access/access-model.md |
| 0.6 | Выбор proxy (Nginx) и схема маршрутизации | ✅ | реализовано: /api, /mock-auth, / → web |
| 0.7 | Схема БД (таблицы, геометрии, индексы) | ✅ | миграции реализованы в 2.1 |
| 0.8 | OSM-подложка: план | ✅ | docs/02-architecture/map-basemap.md |

## Фаза 1. Скелет проекта (Docker Compose)

| # | Задача | Статус | Примечание |
|---|--------|--------|------------|
| 1.1 | Структура репозитория (монорепо: web/, api/, mock-auth/, infra/) | ✅ | |
| 1.2 | docker-compose.yml: db + PostGIS | ✅ | healthcheck, инициализация PostGIS |
| 1.3 | mock-auth: выдача JWT тестовым пользователям | ✅ | admin/engineer/viewer |
| 1.4 | api: каркас NestJS, healthcheck, проверка JWT | ✅ | /api/health, /api/me, PermissionsGuard |
| 1.5 | proxy: маршрутизация между сервисами | ✅ | /api, /mock-auth, / — web |
| 1.6 | web: каркас Vue 3 + MapLibre, пустая карта | ✅ | |

## Фаза 2. Ядро: объекты и слои

| # | Задача | Статус | Примечание |
|---|--------|--------|------------|
| 2.1 | Миграции БД: справочники (layers, object_types, relation_types) + objects + object_relations + seed | ✅ | TypeORM, geometry(4326)+GIST, 5 слоёв/6 типов/4 связи |
| 2.2 | Generic-CRUD объектов в api (по типам из справочника) + валидация attrs_schema | ✅ | raw SQL (ST_AsGeoJSON/ST_GeomFromGeoJSON), ajv-валидация attrs, ObjectPermissionGuard |
| 2.3 | Отдельное приложение `admin` (Vue 3 + TS + Naive UI, `/admin/`) + CRUD справочников в api (типы, слои, типы связей) | ✅ | доступ по `object-types:manage`; duplicate → 409 |
| 2.4 | tiles: Martin + MVT с фильтром по правам (JWT-claims → request.jwt.claims) | ⬜ | |
| 2.5 | web: карта со слоями из справочника + подложка OSM-растр (dev) | ⬜ | map-basemap.md |
| 2.6 | web: переключатель видимости слоёв (по правам) | ⬜ | |

## Фаза 3. Доступ (RBAC)

| # | Задача | Статус | Примечание |
|---|--------|--------|------------|
| 3.1 | Guard в api по динамическим permissions (objects/object-relations/types) | ⬜ | PermissionsGuard есть, подключить к эндпоинтам |
| 3.2 | Видимость слоёв по правам (api + web) | ⬜ | |
| 3.3 | mock-auth: набор пользователей с разными permissions | ✅ | admin/engineer/viewer, готово в фазе 1 |

## Фаза 4. Редактирование и UX

| # | Задача | Статус | Примечание |
|---|--------|--------|------------|
| 4.1 | Инструменты рисования/редактирования на карте | ⬜ | **maplibre-gl-geoman** |
| 4.2 | Динамические формы атрибутов по attrs_schema | ⬜ | |
| 4.3 | Редактор attrs_schema в админке `admin` | ⬜ | |
| 4.4 | CRUD связей объектов на карте | ⬜ | |

## Фаза 5. Полировка и OSM self-hosted

| # | Задача | Статус | Примечание |
|---|--------|--------|------------|
| 5.1 | Self-hosted OSM ЮФО (tilemaker → .mbtiles → Martin) | ⬜ | map-basemap.md |
| 5.2 | Резервное копирование db | ⬜ | |
| 5.3 | TLS/HTTPS на proxy | ⬜ | нужен домен |
| 5.4 | Аудит изменений (история) | ⬜ | по требованию |

## Фаза 6. Геокодирование (geo + Dadata)

Отдельный сервис `geo` (NestJS), кэш в Redis, mock-режим до получения ключей. Детали: docs/02-architecture/geocoding.md.

| # | Задача | Статус | Примечание |
|---|--------|--------|------------|
| 6.1 | geo: каркас NestJS + JWT (общий JWT_SECRET) + /geo/health | ⬜ | |
| 6.2 | geo: mock-эндпоинты (suggest/forward/reverse/company) | ⬜ | до ключей |
| 6.3 | compose: сервис geo + Redis; nginx: /geo/* → geo | ⬜ | |
| 6.4 | geo: кэш-логика (Redis), защита квоты Dadata | ⬜ | |
| 6.5 | geo: провайдер Dadata + проверка исходящего HTTPS | ⬜ | нужны ключи; уточнить поля этажей/квартир |
| 6.6 | web: подсказки адресов, обратное геокодирование; расширение attrs_schema house | ⬜ | фаза 4 (формы) |
