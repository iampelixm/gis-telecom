# Резервное копирование

Статус: план (не реализовано)
Целевая среда: кластер `summersite` (k3s)

## Контекст

- Целевая среда проекта — кластер `summersite`: k3s v1.34.x, 3 ноды (`master`, `hello`, `first`), Traefik — ingress.
- StorageClass в кластере только `local-path` (rancher.io/local-path) — PV лежат на дисках нод, **снапшотов через CSI нет**.
- Velero и бэкап-операторов в кластере сейчас нет.
- Существующие MinIO (`mmsp-minio`, `plane-minio`) — внутренние хранилища приложений на тех же дисках, для бэкапов не используются.

## Решение

**Velero** (бэкап ресурсов Kubernetes + данных PV) с **restic/kopia** (файловый бэкап содержимого PV, т.к. local-path без CSI-снапшотов) в **S3-совместимое хранилище**.

- Таргет хранения — **внешний S3/MinIO** (на отдельном хосте/в облаке), чтобы бэкапы переживали отказ всего k3s-кластера.
- Расписание — **ежедневно**.
- Retention (TTL) — **30 дней**.
- Область — **весь кластер** (все namespaces), включая будущий `d_map`. При необходимости сужение по label-селекторам.

## Компоненты

| Компонент | Назначение |
|-----------|------------|
| `velero` (chart `vmware-tanzu/velero`) | сервер бэкапов, Schedule, Restore |
| плагин `velero-plugin-for-aws` | работа с любым S3-совместимым хранилищем |
| `restic`/`kopia` node-agent | файловый бэкап PV по нодам (демонсет) |
| BackupStorageLocation (BSL) | конфигурация S3-таргета (bucket, endpoint, credentials) |
| Schedule CRD | ежедневный бэкап + TTL 720h (30 дней) |

## Схема потока

```
k3s (summersite)                    внешнее S3/MinIO
┌──────────────────────┐            ┌─────────────┐
│ velero (schedule,    │──restic──► │  bucket/    │
│  каждый день)        │  + API     │  backups/   │
│  ├─ resources (YAML) │            └─────────────┘
│  └─ PV через restic  │
└──────────────────────┘
```

## Установка (эталон, при реализации)

```bash
# helm: repo + установка velero в ns velero
helm repo add vmware-tanzu https://vmware-tanzu.github.io/helm-charts
helm install velero vmware-tanzu/velero \
  --namespace velero --create-namespace \
  --set configuration.backupStorageLocation[0].name=default \
  --set configuration.backupStorageLocation[0].bucket=<bucket> \
  --set configuration.backupStorageLocation[0].config.s3Url=<https://s3-endpoint> \
  --set configuration.backupStorageLocation[0].config.region=<region> \
  --set configuration.volumeSnapshotLocation[0].provider=aws \
  --set config.backupStorageLocation[0].config.s3ForcePathStyle=true \
  --set credentials.useSecret=true \
  --set-file credentials.secretContents.cloud=<aws-credentials>
```

Ежедневный бэкап с retention 30 дней:

```bash
velero schedule create daily-backup \
  --schedule="0 2 * * *" \
  --ttl=720h \
  --include-namespaces="*" \
  --default-volumes-to-restic
```

## Восстановление

```bash
velero backup get                    # список бэкапов
velero backup describe daily-backup-YYYYMMDDHHMMSS
velero restore create --from-backup daily-backup-YYYYMMDDHHMMSS   # весь бэкап
velero restore create --from-backup <backup> \
  --include-resources persistentvolumeclaims,pods \
  --namespace-mappings default=dmap   # частичное/в другой namespace
```

Для БД: Velero возвращает и манифесты, и файлы данных (через restic). Если нужны более частые точки восстановления конкретной БД — дополнительно точечные `pg_dump` каждой БД в тот же S3 (реализуется отдельной задачей при необходимости).

## Риски и ограничения

- Бэкап PV на нодах через restic требует доступа node-agent'а к дискам — стандартная схема Velero, узкие места — скорость и IO на нодах.
- `local-path` не даёт мгновенных снапшотов; окно восстановления — сутки (ежедневный бэкап).
- Внешний S3-таргет обязателен: бэкапы внутри кластера не защищают от отказа кластера.
- Проверять восстановление (restore-дрилл) не реже раза в месяц.

## Альтернативы (рассмотрены, отложены)

- **Оператор БД (CloudNativePG)** — встроенные WAL-бэкапы/PITR, но требует перестройки развёртывания БД; актуально только при миграции БД в кластер.
- **Longhorn** как storage с собственными снапшотами — крупная смена storageClass, не планируется.
