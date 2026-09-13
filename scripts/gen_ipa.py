#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 game/data/ipa.json：{ "en": "美式音标", ... }
音标来自 eng_to_ipa（CMU 词典 + G2P），供前端在单词卡上显示 /.../ 音标。
"""
import json
import os

import eng_to_ipa

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "game", "data"))


def collect():
    ens = []
    words = json.load(open(os.path.join(HERE, "words_data.json"), encoding="utf-8"))
    ens += [w["en"] for w in words]
    cur = json.load(open(os.path.join(HERE, "curriculum_data.json"), encoding="utf-8"))
    for sem in cur.values():
        for unit in sem["units"]:
            for item in unit["words"]:
                ens.append(item.split("|")[0].strip())
    seen, uniq = set(), []
    for en in ens:
        k = en.lower()
        if k and k not in seen:
            seen.add(k)
            uniq.append(en)
    return uniq


def main():
    os.makedirs(OUT, exist_ok=True)
    ipa = {}
    for en in collect():
        try:
            t = eng_to_ipa.convert(en).strip()
            if t and t != en.lower() and "*" not in t:
                ipa[en.lower()] = t
        except Exception:
            pass
    with open(os.path.join(OUT, "ipa.json"), "w", encoding="utf-8") as f:
        json.dump(ipa, f, ensure_ascii=False, indent=0, sort_keys=True)
    print("ipa.json: %d 词" % len(ipa))


if __name__ == "__main__":
    main()
