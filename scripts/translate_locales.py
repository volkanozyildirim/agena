#!/usr/bin/env python3
import argparse
import json
import time
from pathlib import Path
from typing import Dict, Optional

from deep_translator import GoogleTranslator

LANGS = {
    "tr": "turkish",
    "de": "german",
    "es": "spanish",
    "it": "italian",
    "ja": "japanese",
    "zh": "chinese (simplified)",
}


def translate_dict(
    data: Dict[str, str],
    target_lang: str,
    existing: Optional[Dict[str, str]] = None,
    retries: int = 2,
) -> Dict[str, str]:
    translated: Dict[str, str] = {}
    translator = GoogleTranslator(source="en", target=target_lang)
    existing = existing or {}

    for key, value in data.items():
        if not isinstance(value, str):
            translated[key] = value
            continue
        done = False
        for _ in range(retries + 1):
            try:
                translated[key] = translator.translate(value)
                done = True
                break
            except Exception:
                time.sleep(0.2)
        if not done:
            translated[key] = existing.get(key, value)
        time.sleep(0.02)
    return translated


def main() -> None:
    parser = argparse.ArgumentParser(description="Translate locale json from en.json to target languages.")
    parser.add_argument(
        "--source",
        default="frontend/locales/en.json",
        help="Source english locale json file",
    )
    parser.add_argument(
        "--out-dir",
        default="frontend/locales",
        help="Output directory for translated locale files",
    )
    parser.add_argument(
        "--retries",
        type=int,
        default=2,
        help="Retry count for each translation request",
    )
    args = parser.parse_args()

    source_path = Path(args.source)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    with source_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, dict):
        raise ValueError("Source JSON must be an object (key-value map).")

    for code, lang in LANGS.items():
        print(f"Translating -> {code} ({lang})")
        out_path = out_dir / f"{code}.json"
        existing = {}
        if out_path.exists():
            try:
                existing = json.loads(out_path.read_text(encoding="utf-8"))
            except Exception:
                existing = {}
        result = translate_dict(data, lang, existing=existing, retries=max(0, args.retries))
        with out_path.open("w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
            f.write("\n")

    print("DONE")


if __name__ == "__main__":
    main()
