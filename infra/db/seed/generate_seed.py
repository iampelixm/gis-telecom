#!/usr/bin/env python3
"""Генерирует large-seed.sql: трассы вдоль дорог Сочи, столбы с шагом, муфты на каждом 10-м столбе,
связи между соседними столбами. Цель: суммарно ~20 000 объектов.

Вход: GeoJSON дорог (osmium export). Запуск:
    python3 infra/db/seed/generate_seed.py --input /tmp/sochi_roads.geojson --output infra/db/seed/large-seed.sql
"""
import argparse
import json
import math
import random
import subprocess
from pathlib import Path

ROUTE_CLASSES = {"primary", "secondary", "tertiary"}
POLE_CLASSES = {"primary", "secondary", "tertiary", "unclassified", "residential"}
TARGET_TOTAL = 20000
SPLICE_EVERY = 10

R_EARTH = 6371000.0


def dist(a, b):
    lat1, lon1 = math.radians(a[1]), math.radians(a[0])
    lat2, lon2 = math.radians(b[1]), math.radians(b[0])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * R_EARTH * math.asin(math.sqrt(h))


def line_length(coords):
    return sum(dist(coords[i], coords[i + 1]) for i in range(len(coords) - 1))


def interpolate(coords, d_m):
    """Точка на ломаной на расстоянии d_m от начала (метров)."""
    target = d_m
    for i in range(len(coords) - 1):
        seg = dist(coords[i], coords[i + 1])
        if seg <= 0:
            continue
        if target <= seg:
            t = target / seg
            return (coords[i][0] + (coords[i + 1][0] - coords[i][0]) * t,
                    coords[i][1] + (coords[i + 1][1] - coords[i][1]) * t)
        target -= seg
    return coords[-1]


def offset_pt(p, heading_rad, dist_m, rng):
    """Точка p, сдвинутая перпендикулярно направлению дороги на dist_m."""
    side = 1 if rng.random() < 0.5 else -1
    dlat = -side * math.sin(heading_rad) * dist_m / R_EARTH * (180.0 / math.pi)
    dlon = side * math.cos(heading_rad) * dist_m / R_EARTH * (180.0 / math.pi) / max(math.cos(math.radians(p[1])), 1e-9)
    return (p[0] + dlon, p[1] + dlat)


def heading(coords, d_m):
    """Азимут сегмента ломаной в точке на расстоянии d_m."""
    target = d_m
    for i in range(len(coords) - 1):
        seg = dist(coords[i], coords[i + 1])
        if seg <= 0:
            continue
        if target <= seg or i == len(coords) - 2:
            dx = coords[i + 1][0] - coords[i][0]
            dy = coords[i + 1][1] - coords[i][1]
            return math.atan2(dx * math.cos(math.radians(coords[i][1])), dy)
        target -= seg
    return 0.0


def db_query(sql):
    out = subprocess.run(
        ["docker", "compose", "exec", "-T", "db", "psql", "-U", "gis", "-d", "gis", "-tAc", sql],
        capture_output=True, text=True, cwd="/home/pelixm/d_map",
    )
    if out.returncode != 0:
        raise RuntimeError(f"psql failed: {out.stderr}")
    return out.stdout.strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="/tmp/sochi_roads.geojson")
    ap.add_argument("--output", default=str(Path(__file__).resolve().parent / "large-seed.sql"))
    args = ap.parse_args()

    rng = random.Random(42)
    data = json.load(open(args.input))
    roads = []
    for f in data["features"]:
        g = f.get("geometry")
        hw = f.get("properties", {}).get("highway", "")
        if not g or g["type"] != "LineString" or hw not in POLE_CLASSES:
            continue
        coords = g["coordinates"]
        if len(coords) < 2:
            continue
        length = line_length(coords)
        if length < 30:
            continue
        roads.append({"coords": coords, "hw": hw, "name": f.get("properties", {}).get("name", ""), "km": length / 1000.0})

    route_roads = [r for r in roads if r["hw"] in ROUTE_CLASSES]
    pole_length = sum(r["km"] * 1000.0 for r in roads)
    route_count = len(route_roads)

    pole_target = (TARGET_TOTAL - route_count) / (1 + 1.0 / SPLICE_EVERY)
    step = max(40.0, pole_length / max(pole_target, 1))
    print(f"roads: {len(roads)}, route_roads: {route_count}, pole_length km: {pole_length/1000:.1f}")
    print(f"pole_target: {pole_target:.0f}, step: {step:.1f} m")

    routes = []
    poles = []       # (coords, road_idx, idx_in_road)
    splice_idx = []

    for ri, r in enumerate(roads):
        is_route = r["hw"] in ROUTE_CLASSES
        if is_route:
            routes.append(r)
        rlen = line_length(r["coords"])
        d = 0.0
        while d <= rlen:
            pt = interpolate(r["coords"], d)
            off = offset_pt(pt, heading(r["coords"], d), rng.uniform(2.0, 6.0), rng)
            poles.append((off, ri))
            if len(poles) > 0 and len(poles) % SPLICE_EVERY == 0:
                splice_idx.append(len(poles) - 1)
            d += step

    print(f"routes: {len(routes)}, poles: {len(poles)}, splices: {len(splice_idx)}")
    total = len(routes) + len(poles) + len(splice_idx)
    print(f"TOTAL objects: {total}")

    oid_route = db_query("SELECT id FROM object_types WHERE code='route'")
    oid_pole = db_query("SELECT id FROM object_types WHERE code='pole'")
    oid_splice = db_query("SELECT id FROM object_types WHERE code='splice'")
    rid_flp = db_query("SELECT id FROM relation_types WHERE code='fiber_line_pole'")

    def geo(coord):
        return f'ST_GeomFromGeoJSON(\'{{"type":"Point","coordinates":[{coord[0]:.7f},{coord[1]:.7f}]}}\')'

    def line_geo(r):
        c = ",".join(f"[{p[0]:.7f},{p[1]:.7f}]" for p in r["coords"])
        return f'ST_GeomFromGeoJSON(\'{{"type":"LineString","coordinates":[{c}]}}\')'

    sql = []
    sql.append("BEGIN;")
    sql.append('TRUNCATE "object_relations", "objects" RESTART IDENTITY CASCADE;')
    sql.append("")
    sql.append("-- Трассы вдоль дорог")
    sql.append('INSERT INTO "objects" ("objectTypeId", geometry, attrs) VALUES')
    vals = []
    for r in routes:
        attrs = json.dumps({"laying_type": "aerial" if rng.random() < 0.5 else "underground", "name": r["name"]}, ensure_ascii=False)
        vals.append(f"  ({oid_route}, {line_geo(r)}, '{attrs}'::jsonb)")
    sql.append(",\n".join(vals) + ";")
    sql.append("")
    sql.append("-- Столбы")
    sql.append('INSERT INTO "objects" ("objectTypeId", geometry, attrs) VALUES')
    vals = []
    for i, (pt, ri) in enumerate(poles):
        mat = rng.choice(["concrete", "metal", "wood"])
        h = rng.choice([7.5, 9.0, 9.0, 12.0])
        attrs = json.dumps({"inventory_number": f"P-{i+1:06d}", "material": mat, "height_m": h}, ensure_ascii=False)
        vals.append(f"  ({oid_pole}, {geo(pt)}, '{attrs}'::jsonb)")
    sql.append(",\n".join(vals) + ";")
    sql.append("")
    sql.append("-- Муфты (на каждом 10-м столбе)")
    sql.append('INSERT INTO "objects" ("objectTypeId", geometry, attrs) VALUES')
    vals = []
    for k in splice_idx:
        pt = poles[k][0]
        attrs = json.dumps({"splice_type": "SM-48", "weld_count": rng.choice([12, 24, 48])}, ensure_ascii=False)
        vals.append(f"  ({oid_splice}, {geo(pt)}, '{attrs}'::jsonb)")
    sql.append(",\n".join(vals) + ";")
    sql.append("")
    sql.append("-- Связи между соседними столбами (по дорогам)")
    sql.append('INSERT INTO "object_relations" ("relationTypeId", "fromObjectId", "toObjectId") VALUES')
    rel = []
    rel_count = 0
    for i in range(1, len(poles)):
        if poles[i][1] == poles[i - 1][1]:
            frm = route_count + i          # объект (i)-го столба (смещение на трассы)
            to = route_count + i + 1       # (i+1)-го
            rel.append(f"  ({rid_flp}, {frm}, {to})")
            rel_count += 1
    sql.append(",\n".join(rel) + ";")
    sql.append("COMMIT;")

    Path(args.output).write_text("\n".join(sql))
    print(f"saved: {args.output}")
    print(f"relations: {rel_count}")


if __name__ == "__main__":
    main()
