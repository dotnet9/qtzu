#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成词宠岛发音语音，输出到 game/audio/ 并生成 manifest.json：
  word/<id>.mp3        单词（正常语速）
  word/<id>_slow.mp3   单词（慢速，保持原音高）
  syl/<syllable>.mp3   音节（慢速，兼容旧功能保留）
  letter/<ch>.mp3      字母 A-Z

发音来源（按优先级）：
  1. Wikimedia Commons「En-us-*.ogg」—— 维基词典/AHD 计划的真人标准美式录音
     （接口查询文件是否存在，下载后 ffmpeg 统一转成 mp3）
  2. 微软 edge-tts 神经声音 en-US-JennyNeural（短语、未收录的单词、音节、字母）

用法：
  python make_voice.py            # 增量生成（真人录音的单词强制重做，其余已有文件跳过）
  python make_voice.py --all      # 全部强制重做
"""
import asyncio
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import edge_tts

VOICE = "en-US-JennyNeural"
BASE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "game", "audio"))
CONCURRENCY = 4
SLOW_TEMPO = 0.72           # 慢速倍率（atempo 保音高）
UA = "WordPetIsland/1.0 (kids edu game; contact: local)"
FFMPEG = shutil.which("ffmpeg")

if not FFMPEG:
    try:
        import imageio_ffmpeg
        FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        FFMPEG = None


def sanitize(en):
    return re.sub(r"[^a-z0-9]+", "-", en.lower()).strip("-")


def is_single_word(en):
    return bool(re.fullmatch(r"[a-z][a-z'\-]*", en.lower().strip())) and "-" not in en


# ---------------- Wikimedia Commons 真人美音 ----------------
_commons_cache = {}


def preload_commons(ens):
    """批量预查 En-us-<word>.ogg/.oga 直链（一次 API 查 40 个标题，避免 429 限流）；
    结果缓存到本地 .commons_cache.json，重跑不再查 API"""
    cache_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".commons_cache.json")
    try:
        with open(cache_file, encoding="utf-8") as f:
            _commons_cache.update(json.load(f))
    except Exception:
        pass
    singles = sorted({e.lower().strip() for e in ens if is_single_word(e)})
    todo = [w for w in singles if w not in _commons_cache]
    print("Commons 预查：%d 个待查（缓存 %d）" % (len(todo), len(_commons_cache)))
    for i in range(0, len(todo), 40):
        batch = todo[i:i + 40]
        titles = "|".join("File:En-us-%s.%s" % (w, ext) for w in batch for ext in ("ogg", "oga"))
        api = ("https://commons.wikimedia.org/w/api.php?action=query&format=json"
               "&prop=imageinfo&iiprop=url&titles=" + urllib.parse.quote(titles))
        for attempt in (1, 2, 3, 4, 5):
            try:
                req = urllib.request.Request(api, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=30) as r:
                    d = json.load(r)
                for p in d.get("query", {}).get("pages", {}).values():
                    m = re.match(r"File:En-us-(.+)\.(ogg|oga)$", p["title"], re.I)
                    if "imageinfo" in p and m:
                        _commons_cache[m.group(1)] = p["imageinfo"][0]["url"].split("?")[0]
                break
            except Exception as e:
                if attempt == 5:
                    print("commons batch fail", i, e)
                else:
                    time.sleep(min(60, 8 * attempt))
        time.sleep(1.5)
    try:
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(_commons_cache, f)
    except Exception:
        pass
    got = sum(1 for w in singles if w in _commons_cache)
    print("Commons 预查完成：%d/%d 个单词有真人录音" % (got, len(singles)))
    return got


_last_dl = 0.0


def download(url, dst, min_gap=1.3):
    """限速下载：请求间隔 min_gap 秒，429 时指数退避（Wikimedia 对突发流量很敏感）"""
    global _last_dl
    for attempt in (1, 2, 3, 4, 5, 6):
        wait = _last_dl + min_gap - time.time()
        if wait > 0:
            time.sleep(wait)
        _last_dl = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r, open(dst, "wb") as f:
                shutil.copyfileobj(r, f)
            return os.path.getsize(dst) > 1500
        except Exception as e:
            if os.path.exists(dst):
                os.remove(dst)
            if attempt == 6:
                print("download fail", url, e)
                return False
            if "429" in str(e):
                time.sleep(min(90, 15 * attempt))
            else:
                time.sleep(2 * attempt)


def ffmpeg_run(args):
    if not FFMPEG:
        return False
    r = subprocess.run([FFMPEG, "-y", "-loglevel", "error"] + args,
                       capture_output=True, text=True)
    if r.returncode != 0:
        print("ffmpeg fail:", " ".join(args[:4]), r.stderr[:200])
        return False
    return True


def make_word_audio(en, out_mp3, out_slow_mp3):
    """返回 'commons' / None"""
    key = sanitize(en)
    if is_single_word(en):
        w = en.lower().strip()
        u = _commons_cache.get(w)
        if u:
            tmp = out_mp3 + ".tmp"
            try:
                if download(u, tmp) and ffmpeg_run(
                        ["-i", tmp, "-ac", "1", "-ar", "44100", "-codec:a", "libmp3lame", "-b:a", "96k", out_mp3]):
                    # 慢速版直接由真人录音变速，发音与标准音完全一致
                    ffmpeg_run(["-i", out_mp3, "-filter:a", "atempo=%s" % SLOW_TEMPO,
                                "-codec:a", "libmp3lame", "-b:a", "96k", out_slow_mp3])
                    return "commons"
            finally:
                if os.path.exists(tmp):
                    os.remove(tmp)
    return None


# ---------------- 任务计划 ----------------
def plan_tasks():
    here = os.path.dirname(os.path.abspath(__file__))
    words = json.load(open(os.path.join(here, "words_data.json"), encoding="utf-8"))
    ens = []
    for w in words:
        ens.append(w["en"])
    try:
        cur = json.load(open(os.path.join(here, "curriculum_data.json"), encoding="utf-8"))
        for sem in cur.values():
            for unit in sem["units"]:
                for item in unit["words"]:
                    ens.append(item.split("|")[0].strip())
    except FileNotFoundError:
        print("（无 curriculum_data.json，跳过课程语音）")
    seen = set()
    uniq_ens = []
    for en in ens:
        k = sanitize(en)
        if k and k not in seen:
            seen.add(k)
            uniq_ens.append(en)

    tasks = []  # (key, en, kind)  kind: word / slow / tts / fx
    for en in uniq_ens:
        tasks.append(("word/" + sanitize(en), en, "word"))
        tasks.append(("word/" + sanitize(en) + "_slow", en, "slow"))
    syls = sorted({s.lower() for w in words for s in w["syl"]})
    for s in syls:
        tasks.append(("syl/" + s, s, "tts"))
    for i in range(26):
        tasks.append(("letter/" + chr(ord("a") + i), chr(ord("a") + i).upper(), "tts"))
    # 劲舞团式评分喝彩（童声带情绪）
    for key, text, rate, pitch in FX_CLIPS:
        tasks.append(("fx/" + key, text, ("fx", rate, pitch)))
    return tasks


# (key, 文本, rate, pitch) —— 用 AnaNeural 童声，情绪拉满
FX_CLIPS = [
    ("perfect", "Perfect!", "+12%", "+25Hz"),
    ("great", "Great!", "+10%", "+18Hz"),
    ("cool", "Cool!", "+8%", "+12Hz"),
    ("nice", "Nice try!", "+4%", "+5Hz"),
    ("bad", "Oh, bad...", "-4%", "-10Hz"),
    ("miss", "Miss...", "-8%", "-18Hz"),
]


# ---------------- 生成 ----------------
DONE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".commons_done.json")


def load_done():
    try:
        with open(DONE_FILE, encoding="utf-8") as f:
            return set(json.load(f))
    except Exception:
        return set()


def save_done(done):
    try:
        with open(DONE_FILE, "w", encoding="utf-8") as f:
            json.dump(sorted(done), f)
    except Exception:
        pass


def gen_word_sync(key, en, kind, refresh, done):
    """真人录音部分（下载+转码）。返回 (来源, 是否需要TTS兜底)：'commons' / 'kept' / None
    done 集合记录已完成词，进程中断后重跑只补剩余部分（断点续传）"""
    out = os.path.join(BASE, key + ".mp3")
    slow_out = os.path.join(BASE, key + "_slow.mp3")
    if kind == "word" and is_single_word(en):
        if not refresh and en.lower() in done and os.path.exists(out):
            return "kept", False
        src = make_word_audio(en, out, slow_out)
        if src:
            done.add(en.lower())
            save_done(done)
            return "commons", False
        if os.path.exists(out) and os.path.getsize(out) > 1500:
            return "kept", False                  # Commons 没有，但已有可用发音
    return None, True


async def gen_tts(key, text, rate, refresh, voice=VOICE, pitch=None):
    out = os.path.join(BASE, key + ".mp3")
    if not refresh and os.path.exists(out) and os.path.getsize(out) > 500:
        return True
    for attempt in (1, 2, 3):
        try:
            kwargs = {"rate": rate}
            if pitch:
                kwargs["pitch"] = pitch
            tts = edge_tts.Communicate(text, voice, **kwargs)
            await tts.save(out)
            if os.path.getsize(out) > 500:
                return True
        except Exception as e:
            if attempt == 3:
                print("FAIL", key, e)
            else:
                await asyncio.sleep(1.5 * attempt)
    return False


async def main():
    refresh = "--all" in sys.argv
    resume_only = "--resume-only" in sys.argv   # 只用已缓存直链下载，不查 API（限流期的快速增量模式）
    for sub in ("word", "syl", "letter", "fx"):
        os.makedirs(os.path.join(BASE, sub), exist_ok=True)
    tasks = plan_tasks()
    print("共 %d 个语音文件" % len(tasks))

    # 1) 批量预查真人美音直链（规避 API 限流），再串行下载+转码（Wikimedia 讨厌突发并发）
    if not resume_only:
        preload_commons([e for _, e, kd in tasks if kd == "word"])
    else:
        try:
            with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".commons_cache.json"), encoding="utf-8") as f:
                _commons_cache.update(json.load(f))
            print("resume-only：使用缓存直链 %d 条" % len(_commons_cache))
        except Exception:
            print("resume-only：无缓存")
    print("等待 30s 让限流惩罚过期…")
    time.sleep(30)
    commons_cnt = 0
    done = load_done()
    word_items = [(k, e, kd) for k, e, kd in tasks if kd == "word"]
    tts_fallback = []  # (key, en, rate)
    with ThreadPoolExecutor(max_workers=1) as ex:
        futs = {ex.submit(gen_word_sync, k, e, kd, refresh, done): (k, e) for k, e, kd in word_items}
        done_cnt = 0
        for ft in list(futs):
            key, en = futs[ft]
            try:
                src, need_tts = ft.result()
                if src == "commons":
                    commons_cnt += 1
                if need_tts:
                    tts_fallback.append((key, en, "+0%"))
                    tts_fallback.append((key + "_slow", en, "-35%"))
            except Exception as e:
                print("word fail", key, e)
                tts_fallback.append((key, en, "+0%"))
                tts_fallback.append((key + "_slow", en, "-35%"))
            done_cnt += 1
            if done_cnt % 50 == 0:
                print("  真人音 %d/%d（已用 Commons %d）" % (done_cnt, len(word_items), commons_cnt))
    print("真人美音覆盖 %d/%d 个单词" % (commons_cnt, len(word_items)))

    # 2) 其余走 edge-tts（慢速版若已由真人录音变速生成则跳过）
    sem = asyncio.Semaphore(CONCURRENCY)
    tts_jobs = list(tts_fallback)
    tts_meta = {}   # key -> (voice, pitch)
    seen_fb = {k for k, _, _ in tts_jobs}
    for key, en, kind in tasks:
        if isinstance(kind, tuple) and kind[0] == "fx":     # 评分喝彩：童声带情绪
            if key not in seen_fb:
                tts_jobs.append((key, en, kind[1]))
                tts_meta[key] = ("en-US-AnaNeural", kind[2])
                seen_fb.add(key)
            continue
        if kind == "word" or key in seen_fb:
            continue
        if kind == "slow":
            if os.path.exists(os.path.join(BASE, key + ".mp3")):
                continue  # 慢速版已存在（真人变速或旧文件）
            tts_jobs.append((key, en, "-35%"))
        else:
            tts_jobs.append((key, en, "-25%"))
        seen_fb.add(key)
    print("edge-tts 兜底 %d 个" % len(tts_jobs))

    async def run_one(t):
        async with sem:
            voice, pitch = tts_meta.get(t[0], (VOICE, None))
            return await gen_tts(t[0], t[1], t[2], refresh, voice, pitch)

    results = await asyncio.gather(*[run_one(t) for t in tts_jobs])

    # 3) manifest
    manifest = {}
    for key, _, _ in tasks:
        p = os.path.join(BASE, key + ".mp3")
        if os.path.exists(p) and os.path.getsize(p) > 300:
            manifest[key] = "audio/" + key + ".mp3"
    with open(os.path.join(BASE, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=1)
    ok = len(manifest)
    print("完成 %d/%d" % (ok, len(tasks)))
    sys.exit(0 if ok >= len(tasks) - 5 else 1)


if __name__ == "__main__":
    asyncio.run(main())
