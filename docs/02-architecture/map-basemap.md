# Подложка карты (OSM)

Статус: dev-часть реализована, self-hosted ЮФО — план (фаза 5)
Дата: 2026-08-31

## Решение

- **Сейчас (dev, реализовано):** публичный OSM-растр `tile.openstreetmap.org/{z}/{x}/{y}.png` как подложка под объектные слои. Обязательная атрибуция OSM на карте (требование политики OSM).
- **Прод (ближайшая цель):** self-hosted векторные тайлы OSM для региона **ЮФО (Южный федеральный округ)**.

## План self-hosted ЮФО

```
Geofabrik: russia-southern-federal-district-latest.osm.pbf
   → tilemaker (одноразовый Docker-job): PBF → .mbtiles (OpenMapTiles-схема)
   → .mbtiles отдаёт Martin (умеет PostGIS и mbtiles)
   → frontend: стиль OpenMapTiles поверх наших объектов
```

- Martin уже в стеке → одна точка отдачи тайлов (и OSM, и наши объекты).
- tilemaker лёгкий, работает без PostGIS; PostGIS остаётся только под наши объекты.
- `.mbtiles` хранится в volume; пересборка региона = перезапуск job.

## Задачи

1. ✅ Добавить raster-источник OSM в стиль MapLibre в `web` (реализовано).
2. ✅ Атрибуция OSM на карте (реализована).
3. ⬜ Скачать PBF ЮФО (Geofabrik), проверить размер/доступность.
4. ⬜ Собрать `.mbtiles` через tilemaker (Docker-job).
5. ⬜ Настроить Martin на отдачу `.mbtiles`.
6. ⬜ Подключить стиль OpenMapTiles в frontend.

Приоритет: не прерывать ядро объектов. Self-hosted OSM — в TODO (бэклог, roadmap T.1).

## Замечания по серверу

- npm и docker pull работают, но внешние сайты местами медленные/недоступные → внешние tile-серверы в проде ненадёжны, отсюда ставка на self-hosted.
