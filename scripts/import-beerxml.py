"""
Minimal BeerXML 1.0 → BeerJSON 2.x converter.

Scope: handles the fields used in `examples/double-ipa-mandarina.beerjson`.
Not feature-complete — extends as we encounter new BeerXML shapes. Target is
correctness over coverage: better to leave a field out than to lie about units.

Usage: python3 scripts/import-beerxml.py <input.xml> <output.beerjson>
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

# ────────────────────────────────────────────────────────────────────────────
# BeerXML enums → BeerJSON enums.
# ────────────────────────────────────────────────────────────────────────────

RECIPE_TYPE = {
    "All Grain": "all grain",
    "Extract": "extract",
    "Partial Mash": "partial mash",
}

FERMENTABLE_TYPE = {
    "Grain": "grain",
    "Sugar": "sugar",
    "Extract": "extract",
    "Dry Extract": "dry extract",
    "Adjunct": "other",
    "Fruit": "fruit",
    "Honey": "honey",
}

HOP_FORM = {
    "Pellet": "pellet",
    "Plug": "plug",
    "Leaf": "leaf",
    "Extract": "extract",
}

# BeerXML USE → BeerJSON timing.use
HOP_USE = {
    "Mash": "add_to_mash",
    "First Wort": "add_to_boil",
    "Boil": "add_to_boil",
    "Aroma": "add_to_boil",   # whirlpool / late addition
    "Dry Hop": "add_to_fermentation",
}

CULTURE_FORM = {
    "Liquid": "liquid",
    "Dry": "dry",
    "Slant": "slant",
    "Culture": "culture",
}

MASH_STEP_TYPE = {
    "Infusion": "infusion",
    "Temperature": "temperature",
    "Decoction": "decoction",
}


# ────────────────────────────────────────────────────────────────────────────
# Helpers.
# ────────────────────────────────────────────────────────────────────────────

def text(el: ET.Element | None, tag: str) -> str | None:
    if el is None:
        return None
    child = el.find(tag)
    if child is None or child.text is None:
        return None
    return child.text.strip()


def num(el: ET.Element | None, tag: str) -> float | None:
    raw = text(el, tag)
    if raw in (None, ""):
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def vol_l(value: float | None):
    return None if value is None else {"value": value, "unit": "l"}


def mass_kg(value: float | None):
    return None if value is None else {"value": value, "unit": "kg"}


def temp_c(value: float | None):
    return None if value is None else {"value": value, "unit": "C"}


def time_min(value: float | None):
    return None if value is None else {"value": value, "unit": "min"}


def percent(value: float | None):
    return None if value is None else {"value": value, "unit": "%"}


def color_ebc(value: float | None):
    return None if value is None else {"value": value, "unit": "EBC"}


def gravity_sg(value: float | None):
    return None if value is None else {"value": value, "unit": "sg"}


def prune(obj):
    """Drop None values recursively, but preserve required-empty containers."""
    if isinstance(obj, dict):
        return {k: prune(v) for k, v in obj.items() if v is not None}
    if isinstance(obj, list):
        return [prune(x) for x in obj if x is not None]
    return obj


# ────────────────────────────────────────────────────────────────────────────
# Per-section converters.
# ────────────────────────────────────────────────────────────────────────────

def convert_fermentable(el: ET.Element):
    name = text(el, "NAME") or "Unknown"
    raw_type = text(el, "TYPE") or "Grain"
    yield_pct = num(el, "YIELD")
    color = num(el, "COLOR")  # BeerXML COLOR for grains is interpreted from DISPLAY_COLOR units
    display_color = text(el, "DISPLAY_COLOR") or ""
    color_unit = "EBC" if "EBC" in display_color else "SRM"
    return {
        "name": name,
        "type": FERMENTABLE_TYPE.get(raw_type, "other"),
        "producer": text(el, "SUPPLIER"),
        "yield": {"fine_grind": percent(yield_pct)} if yield_pct is not None else None,
        "color": {"value": color, "unit": color_unit} if color is not None else None,
        "amount": mass_kg(num(el, "AMOUNT")),
    }


def convert_hop(el: ET.Element):
    use_raw = text(el, "USE") or "Boil"
    use = HOP_USE.get(use_raw, "add_to_boil")
    time_raw = num(el, "TIME") or 0
    timing: dict = {"use": use, "time": time_min(time_raw)}
    return {
        "name": text(el, "NAME") or "Unknown",
        "alpha_acid": percent(num(el, "ALPHA")),
        "form": HOP_FORM.get(text(el, "FORM") or "Pellet", "pellet"),
        "amount": mass_kg(num(el, "AMOUNT")),
        "timing": timing,
        # Preserve the raw BeerXML use as a hint for downstream UI ("Aroma"
        # vs "Boil" both map to add_to_boil but the user-facing label differs).
        "notes": text(el, "NOTES"),
    }


def convert_yeast(el: ET.Element):
    return {
        "name": text(el, "NAME") or "Unknown",
        "type": "ale",  # BeerXML doesn't carry yeast type; default and let the user correct
        "form": CULTURE_FORM.get(text(el, "FORM") or "Dry", "dry"),
        "producer": text(el, "LABORATORY"),
        "product_id": text(el, "PRODUCT_ID") or None,
        "amount": mass_kg(num(el, "AMOUNT")) if (text(el, "AMOUNT_IS_WEIGHT") or "").upper() == "TRUE" else vol_l(num(el, "AMOUNT")),
        "attenuation": percent(num(el, "ATTENUATION")),
    }


def convert_mash_step(el: ET.Element):
    raw_type = text(el, "TYPE") or "Infusion"
    return {
        "name": text(el, "NAME") or raw_type,
        "type": MASH_STEP_TYPE.get(raw_type, "temperature"),
        "step_temperature": temp_c(num(el, "STEP_TEMP")),
        "step_time": time_min(num(el, "STEP_TIME")),
        "infuse_temperature": temp_c(num(el, "INFUSE_TEMP")),
        "amount": vol_l(num(el, "INFUSE_AMOUNT")),
    }


def convert_mash(el: ET.Element | None):
    if el is None:
        return None
    steps_root = el.find("MASH_STEPS")
    steps = [convert_mash_step(s) for s in steps_root.findall("MASH_STEP")] if steps_root is not None else []
    return {
        "name": text(el, "NAME") or "Mash",
        # BeerXML doesn't carry grain temperature explicitly — assume room temp.
        "grain_temperature": temp_c(20.0),
        "notes": text(el, "NOTES"),
        "mash_steps": steps,
    }


def convert_style(el: ET.Element | None):
    if el is None:
        return None
    # BeerXML <STYLE><TYPE> is the brewing classification (Ale/Lager/Wheat/Mead/Cider/etc.)
    # BeerJSON Style.type is the beverage family (beer/cider/mead/...). Map across.
    raw_style_type = (text(el, "TYPE") or "").lower()
    bj_style_type = {
        "ale": "beer", "lager": "beer", "wheat": "beer", "mixed": "beer",
        "cider": "cider", "mead": "mead", "kombucha": "kombucha",
        "wine": "wine", "soda": "soda",
    }.get(raw_style_type, "beer")
    return {
        "name": text(el, "NAME") or "Unknown",
        "category": text(el, "CATEGORY"),
        "category_number": int(num(el, "CATEGORY_NUMBER") or 0) or None,
        "style_letter": text(el, "STYLE_LETTER"),
        "style_guide": text(el, "STYLE_GUIDE"),
        "type": bj_style_type,
    }


def convert_recipe(rec: ET.Element):
    ingredients = {
        "fermentable_additions": [
            convert_fermentable(f)
            for ferms in [rec.find("FERMENTABLES")]
            if ferms is not None
            for f in ferms.findall("FERMENTABLE")
        ],
        "hop_additions": [
            convert_hop(h)
            for hops in [rec.find("HOPS")]
            if hops is not None
            for h in hops.findall("HOP")
        ],
        "culture_additions": [
            convert_yeast(y)
            for yeasts in [rec.find("YEASTS")]
            if yeasts is not None
            for y in yeasts.findall("YEAST")
        ],
    }

    return {
        "name": text(rec, "NAME") or "Untitled recipe",
        "type": RECIPE_TYPE.get(text(rec, "TYPE") or "All Grain", "all grain"),
        "author": "(imported from BeerXML)",
        "batch_size": vol_l(num(rec, "BATCH_SIZE")),
        "efficiency": {"brewhouse": percent(num(rec, "EFFICIENCY"))},
        "style": convert_style(rec.find("STYLE")),
        "original_gravity": gravity_sg(num(rec, "EST_OG") or num(rec, "OG")),
        "final_gravity": gravity_sg(num(rec, "EST_FG") or num(rec, "FG")),
        "alcohol_by_volume": percent(num(rec, "EST_ABV") or num(rec, "ABV")),
        "ibu_estimate": (
            {"method": "Tinseth", "ibu": {"value": num(rec, "IBU"), "unit": "IBUs"}}
            if num(rec, "IBU") is not None else None
        ),
        "color_estimate": color_ebc(num(rec, "EST_COLOR")),
        "ingredients": ingredients,
        "mash": convert_mash(rec.find("MASH")),
        "boil": {"boil_time": time_min(num(rec, "BOIL_TIME") or 60)},
        "notes": text(rec, "NOTES") or None,
    }


# ────────────────────────────────────────────────────────────────────────────
# Main.
# ────────────────────────────────────────────────────────────────────────────

def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__, file=sys.stderr)
        return 1

    src = Path(argv[1])
    dst = Path(argv[2])
    tree = ET.parse(src)
    root = tree.getroot()
    if root.tag != "RECIPES":
        print(f"Expected <RECIPES> root, got <{root.tag}>", file=sys.stderr)
        return 2

    recipes = [convert_recipe(r) for r in root.findall("RECIPE")]
    output = {
        "beerjson": {
            "version": 2.06,
            "recipes": recipes,
        }
    }
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(prune(output), indent=2, ensure_ascii=False) + "\n")
    print(f"✓ {src.name} → {dst}  ({len(recipes)} recipe(s))")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
