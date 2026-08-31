# Аудит и история изменений

Статус: реализовано (фаза 5.3)
Дата: 2026-08-31

## Назначение

Фиксировать кто, когда и что менял в объектах и связях на карте: создание,
изменение атрибутов, перемещение/правку геометрии, удаление. Хозяин объекта —
создатель (`createdBy`), уже пишется в таблицах `objects` и `object_relations`
и теперь отображается в интерфейсе.

## Журнал `change_log`

Миграция `1700000000004-audit-log.ts`. Таблица **без FK** на `objects` /
`object_relations` — чтобы история сохранялась даже после удаления сущности.

| Поле         | Тип       | Назначение                                   |
|--------------|-----------|----------------------------------------------|
| id           | serial PK |                                              |
| entityType   | varchar   | `object` \| `relation`                       |
| entityId     | integer   | id сущности                                  |
| typeCode     | varchar   | код типа объекта/связи (для прав)            |
| action       | varchar   | `created` \| `updated` \| `moved` \| `deleted` |
| actor        | varchar   | `sub` пользователя из JWT                    |
| changes      | jsonb     | diff: для updated — changed-ключи {before, after}; для moved — geometry {before, after}; для created/deleted — snapshot |
| createdAt    | timestamptz |                                          |

Индексы: `(entityType, entityId)`, `(createdAt)`.

## API

- `GET /objects/:id/history` — история объекта (права `objects:<code>:read`).
- `GET /relations/:id/history` — история связи (права `object-relations:<code>:read`).
- `GET /history?entityType=object|relation&entityId=N` — история по типу+id,
  работает и для удалённых сущностей; права определяются по последней записи
  в `change_log` (`HistoryPermissionGuard`).

Записи пишутся из `ObjectsService` / `RelationsService` (модуль `audit/`):
`AuditService.log()`. Для `updated` хранится только diff изменённых ключей
атрибутов; для `moved` — старые/новые координаты целиком; для `created`/`deleted`
— полный snapshot (`attrs`, `geometry`).

## Web

- В модалке «Свойства» объекта и связи — блок «Создал / Изменил» (имя и дата).
- Кнопка «История» → модалка со списком записей: действие, автор, время, diff
  (старое → новое), для `moved` — пометка «Геометрия изменена».
