#!/usr/bin/env python3
"""Build normalized food-library datasets from the annual workbook and Memphis overrides.

This script parses the mislabeled `.xls` file as an XLSX workbook, normalizes the
annual menu dataset into an app-friendly CSV, then applies Memphis manual overrides
for chains where we have fresher official-source rows.
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Dict, Iterable, List
from xml.etree import ElementTree as ET
from zipfile import ZipFile


ROOT = Path("/Users/kp/Documents/FitTrack")
RESEARCH_DIR = ROOT / "research"
ANNUAL_SOURCE = Path("/Users/kp/Downloads/ms_annual_data_2022.xls")
MEMPHIS_SOURCE = RESEARCH_DIR / "memphis-metro-chain-food-library-first-pass.csv"
ANNUAL_OUTPUT = RESEARCH_DIR / "annual-chain-food-library-2022-normalized.csv"
MERGED_OUTPUT = RESEARCH_DIR / "food-library-merged.csv"
SUMMARY_OUTPUT = RESEARCH_DIR / "food-library-merged-summary.md"
RESTAURANT_JSON_OUTPUT = ROOT / "public" / "restaurant-library.json"

XML_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

OUTPUT_FIELDS = [
    "id",
    "brand",
    "item_name",
    "category",
    "description",
    "serving_amount",
    "serving_unit",
    "serving_label",
    "calories",
    "fat_g",
    "carbs_g",
    "protein_g",
    "fiber_g",
    "sugar_g",
    "sodium_mg",
    "cholesterol_mg",
    "potassium_mg",
    "source_type",
    "source_date",
    "source_detail",
    "source_url",
    "region",
    "is_manual_override",
]


EXCLUDED_RESTAURANT_CATEGORY_TERMS = {
    "beverages",
    "beverage",
    "drinks",
    "drink",
}

TACO_BELL_MENU_LABELS = {
    "value menu",
    "online exclusive",
    "specialties",
}

TACO_BELL_VARIANT_PREFIXES = {
    "quesadilla",
    "breakfast quesadilla",
    "breakfast crunchwrap",
    "cheesy toasted breakfast burrito",
    "grande toasted breakfast burrito",
    "hash brown toasted breakfast burrito",
    "burrito supreme",
    "chalupa supreme",
    "crunchwrap supreme",
    "nachos bellgrande",
    "power menu bowl",
    "quesarito",
    "soft taco",
    "soft taco supreme",
}


def col_to_index(cell_ref: str) -> int:
    letters = "".join(ch for ch in cell_ref if ch.isalpha())
    value = 0
    for ch in letters:
        value = value * 26 + (ord(ch.upper()) - ord("A") + 1)
    return value - 1


def parse_xlsx_rows(path: Path) -> Iterable[List[str]]:
    with ZipFile(path) as archive:
        names = set(archive.namelist())
        shared_strings: List[str] = []
        if "xl/sharedStrings.xml" in names:
            sst = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in sst:
                shared_strings.append("".join(t.text or "" for t in item.iter(XML_NS + "t")))

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        first_sheet = workbook.find(XML_NS + "sheets")[0]
        rel_id = first_sheet.attrib[f"{REL_NS}id"]

        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        rel_map = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
        target = rel_map[rel_id]
        if not target.startswith("xl/"):
            target = f"xl/{target}"

        sheet = ET.fromstring(archive.read(target))
        for row in sheet.findall(f".//{XML_NS}row"):
            cells: Dict[int, str] = {}
            max_index = -1
            for cell in row.findall(XML_NS + "c"):
                cell_ref = cell.attrib.get("r", "")
                index = col_to_index(cell_ref) if cell_ref else max_index + 1
                max_index = max(max_index, index)
                value_node = cell.find(XML_NS + "v")
                if value_node is None:
                    cells[index] = ""
                    continue
                value = value_node.text or ""
                if cell.attrib.get("t") == "s" and value.isdigit():
                    shared_index = int(value)
                    value = shared_strings[shared_index] if shared_index < len(shared_strings) else value
                cells[index] = value
            yield [cells.get(i, "") for i in range(max_index + 1)]


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def normalize_key(brand: str, item_name: str) -> str:
    brand_key = re.sub(r"[^a-z0-9]+", "", brand.lower())
    item_key = re.sub(r"[^a-z0-9]+", "", item_name.lower())
    return f"{brand_key}::{item_key}"


def parse_number(value: str) -> str:
    text = clean_text(value).replace(",", "")
    if not text:
        return ""
    return text


def should_exclude_restaurant_row(row: Dict[str, str]) -> bool:
    category = clean_text(row.get("category", "")).lower()
    return category in EXCLUDED_RESTAURANT_CATEGORY_TERMS


def normalize_taco_bell_item_name(item_name: str) -> str:
    if " - " not in item_name:
        return item_name

    prefix, suffix = [clean_text(part) for part in item_name.split(" - ", 1)]
    normalized_prefix = prefix.lower()
    normalized_suffix = suffix.lower()

    if normalized_suffix in TACO_BELL_MENU_LABELS:
        return prefix

    if normalized_prefix not in TACO_BELL_VARIANT_PREFIXES:
        return item_name

    return f"{suffix} {prefix}"


def normalize_item_name(brand: str, item_name: str) -> str:
    if brand == "Taco Bell":
        return normalize_taco_bell_item_name(item_name)
    return item_name


def load_annual_rows(path: Path) -> List[Dict[str, str]]:
    rows = list(parse_xlsx_rows(path))
    if not rows:
        return []

    header = rows[0]
    annual_rows: List[Dict[str, str]] = []

    for raw_row in rows[1:]:
        row = raw_row + [""] * (len(header) - len(raw_row))
        source = {header[i]: row[i] for i in range(len(header))}
        brand = clean_text(source.get("restaurant", ""))
        item_name = normalize_item_name(brand, clean_text(source.get("item_name", "")))
        if not brand or not item_name:
            continue
        annual_rows.append(
            {
                "id": clean_text(source.get("menu_item_id", "")),
                "brand": brand,
                "item_name": item_name,
                "category": clean_text(source.get("food_category", "")),
                "description": clean_text(source.get("item_description", "")),
                "serving_amount": parse_number(source.get("serving_size", "")),
                "serving_unit": clean_text(source.get("serving_size_unit", "")),
                "serving_label": clean_text(
                    source.get("serving_size_text", "") or source.get("serving_size_household", "")
                ),
                "calories": parse_number(source.get("calories", "")),
                "fat_g": parse_number(source.get("total_fat", "")),
                "carbs_g": parse_number(source.get("carbohydrates", "")),
                "protein_g": parse_number(source.get("protein", "")),
                "fiber_g": parse_number(source.get("dietary_fiber", "")),
                "sugar_g": parse_number(source.get("sugar", "")),
                "sodium_mg": parse_number(source.get("sodium", "")),
                "cholesterol_mg": parse_number(source.get("cholesterol", "")),
                "potassium_mg": parse_number(source.get("potassium", "")),
                "source_type": "annual_dataset",
                "source_date": "2022",
                "source_detail": clean_text(
                    f"Annual chain menu dataset; matched_2021={source.get('matched_2021', '')}; "
                    f"new_item_2022={source.get('new_item_2022', '')}"
                ),
                "source_url": "",
                "region": "US",
                "is_manual_override": "0",
            }
        )

    return annual_rows


def load_memphis_rows(path: Path) -> List[Dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        output = []
        for index, row in enumerate(reader, start=1):
            output.append(
                {
                    "id": f"memphis-{index}",
                    "brand": clean_text(row.get("chain", "")),
                    "item_name": normalize_item_name(
                        clean_text(row.get("chain", "")),
                        clean_text(row.get("item_name", "")),
                    ),
                    "category": clean_text(row.get("category", "")),
                    "description": "",
                    "serving_amount": "",
                    "serving_unit": "",
                    "serving_label": clean_text(row.get("serving_size", "")),
                    "calories": parse_number(row.get("calories", "")),
                    "fat_g": parse_number(row.get("fat_g", "")),
                    "carbs_g": parse_number(row.get("carbs_g", "")),
                    "protein_g": parse_number(row.get("protein_g", "")),
                    "fiber_g": "",
                    "sugar_g": "",
                    "sodium_mg": "",
                    "cholesterol_mg": "",
                    "potassium_mg": "",
                    "source_type": "official_manual_research",
                    "source_date": clean_text(row.get("source_document_or_date", "")),
                    "source_detail": clean_text(row.get("source_document_or_date", "")),
                    "source_url": clean_text(row.get("source_url", "")),
                    "region": "Memphis metro",
                    "is_manual_override": "1",
                }
            )
        return output


def write_csv(path: Path, rows: Iterable[Dict[str, str]]) -> int:
    row_count = 0
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in OUTPUT_FIELDS})
            row_count += 1
    return row_count


def build_serving_size(row: Dict[str, str]) -> str:
    parts = [
        clean_text(row.get("serving_amount", "")),
        clean_text(row.get("serving_unit", "")),
        clean_text(row.get("serving_label", "")),
    ]
    return " ".join(part for part in parts if part).strip()


def build_restaurant_json(rows: List[Dict[str, str]]) -> List[Dict[str, object]]:
    restaurant_rows = []
    for row in rows:
        restaurant_rows.append(
            {
                "id": row.get("id", ""),
                "brand": row.get("brand", ""),
                "name": row.get("item_name", ""),
                "category": row.get("category", ""),
                "description": row.get("description", ""),
                "servingSize": build_serving_size(row),
                "calories": row.get("calories", ""),
                "protein": row.get("protein_g", ""),
                "carbs": row.get("carbs_g", ""),
                "fat": row.get("fat_g", ""),
                "sourceType": row.get("source_type", ""),
                "sourceDate": row.get("source_date", ""),
                "sourceUrl": row.get("source_url", ""),
                "region": row.get("region", ""),
                "isManualOverride": row.get("is_manual_override", "") == "1",
            }
        )
    return restaurant_rows


def build_summary(
    annual_rows: List[Dict[str, str]],
    memphis_rows: List[Dict[str, str]],
    merged_rows: List[Dict[str, str]],
    overrides_applied: int,
    excluded_rows: int,
) -> str:
    annual_brands = len({row["brand"] for row in annual_rows if row["brand"]})
    merged_brands = len({row["brand"] for row in merged_rows if row["brand"]})
    return "\n".join(
        [
            "# Food Library Merge Summary",
            "",
            "Generated by `research/build_food_library_datasets.py`.",
            "",
            f"- Annual dataset source: `{ANNUAL_SOURCE}`",
            f"- Memphis override source: `{MEMPHIS_SOURCE}`",
            f"- Annual normalized rows: `{len(annual_rows)}`",
            f"- Memphis manual rows: `{len(memphis_rows)}`",
            f"- Merged rows: `{len(merged_rows)}`",
            f"- Restaurant JSON rows: `{len(merged_rows)}`",
            f"- Annual unique brands: `{annual_brands}`",
            f"- Merged unique brands: `{merged_brands}`",
            f"- Manual overrides applied over annual rows: `{overrides_applied}`",
            f"- Excluded beverage rows: `{excluded_rows}`",
            "",
            "Merge rule:",
            "- Start from the annual 2022 baseline dataset.",
            "- Replace rows when the Memphis manual dataset has the same normalized `brand + item_name` key.",
            "- Append Memphis rows that do not exist in the annual dataset.",
            "- Exclude restaurant beverage-category rows so overlapping soft drinks do not appear in search.",
            "",
            "Caveat:",
            "- The annual workbook is still older source data. Manual official-source rows are treated as higher-trust overrides where available.",
        ]
    )


def main() -> None:
    annual_rows = load_annual_rows(ANNUAL_SOURCE)
    memphis_rows = load_memphis_rows(MEMPHIS_SOURCE)

    annual_rows = sorted(
        annual_rows,
        key=lambda row: (
            row.get("brand", "").lower(),
            row.get("item_name", "").lower(),
            row.get("id", ""),
        ),
    )
    annual_count = write_csv(ANNUAL_OUTPUT, annual_rows)

    memphis_by_key = {normalize_key(row["brand"], row["item_name"]): row for row in memphis_rows}
    annual_override_keys = {
        normalize_key(row["brand"], row["item_name"])
        for row in annual_rows
        if normalize_key(row["brand"], row["item_name"]) in memphis_by_key
    }
    overrides_applied = len(annual_override_keys)

    merged_rows = []
    replaced_keys = set()
    for row in annual_rows:
        key = normalize_key(row["brand"], row["item_name"])
        if key in memphis_by_key:
            if key not in replaced_keys:
                merged_rows.append(memphis_by_key[key])
                replaced_keys.add(key)
            continue
        merged_rows.append(row)

    for row in memphis_rows:
        key = normalize_key(row["brand"], row["item_name"])
        if key not in annual_override_keys:
            merged_rows.append(row)

    excluded_rows = sum(1 for row in merged_rows if should_exclude_restaurant_row(row))
    merged_rows = [row for row in merged_rows if not should_exclude_restaurant_row(row)]

    merged_rows = sorted(
        merged_rows,
        key=lambda row: (
            row.get("brand", "").lower(),
            row.get("item_name", "").lower(),
            row.get("id", ""),
        ),
    )
    merged_count = write_csv(MERGED_OUTPUT, merged_rows)
    restaurant_json = build_restaurant_json(merged_rows)
    RESTAURANT_JSON_OUTPUT.write_text(json.dumps(restaurant_json, separators=(",", ":")), encoding="utf-8")

    SUMMARY_OUTPUT.write_text(
        build_summary(annual_rows, memphis_rows, merged_rows, overrides_applied, excluded_rows),
        encoding="utf-8",
    )

    print(f"annual_rows={annual_count}")
    print(f"memphis_rows={len(memphis_rows)}")
    print(f"merged_rows={merged_count}")
    print(f"overrides_applied={overrides_applied}")
    print(f"excluded_rows={excluded_rows}")
    print(f"annual_output={ANNUAL_OUTPUT}")
    print(f"merged_output={MERGED_OUTPUT}")
    print(f"summary_output={SUMMARY_OUTPUT}")
    print(f"restaurant_json_output={RESTAURANT_JSON_OUTPUT}")


if __name__ == "__main__":
    main()
