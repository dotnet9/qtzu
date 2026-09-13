#!/usr/bin/env python3
"""开发服务器：禁用缓存，避免改代码后浏览器用旧文件

接口: GET /api/leaderboard   POST /api/score   POST /api/register   POST /api/login
账号: 昵称唯一，密码至少 1 位；服务端用 MD5 迭代 3 次（带昵称加盐）后保存，不存明文。
"""
import http.server
import sys
import json
import os
import threading
import hashlib
from urllib.parse import urlparse

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8931
BOARD_FILE = os.path.join(os.path.dirname(__file__), "leaderboard.json")
ACCOUNTS_FILE = os.path.join(os.path.dirname(__file__), "accounts.json")
LEGACY_PASSWORD = ""   # 老账号（上线前只在排行榜里的名字）按空密码处理
BOARD_LOCK = threading.Lock()

def read_board():
    try:
        with open(BOARD_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []

def write_board(rows):
    tmp = BOARD_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    os.replace(tmp, BOARD_FILE)

def read_accounts():
    try:
        with open(ACCOUNTS_FILE, "r", encoding="utf-8") as f:
            obj = json.load(f)
        return obj if isinstance(obj, dict) else {}
    except (OSError, ValueError):
        return {}

def write_accounts(obj):
    tmp = ACCOUNTS_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, ACCOUNTS_FILE)

def hash_pwd(username, pwd):
    """md5(md5(md5(昵称:密码)))，昵称当盐，迭代 3 次"""
    h = str(pwd)
    salt = str(username).lower()
    for _ in range(3):
        h = hashlib.md5(f"{salt}:{h}".encode("utf-8")).hexdigest()
    return h

def is_legacy_name(username, rows):
    return any(str(x.get("username", "")) == username for x in rows)

def score_of(username, rows):
    row = next((x for x in rows if str(x.get("username", "")) == username), None)
    return int(row.get("score", 0)) if row else 0

def gender_of(username, rows):
    row = next((x for x in rows if str(x.get("username", "")) == username), None)
    return "girl" if row and row.get("gender") == "girl" else "boy"

def clean_creds(body):
    username = str(body.get("username") or "").strip()[:20]
    password = str(body.get("password") or "")
    if not username:
        return None, "先写一个名字"
    if any(ord(c) < 32 for c in username):
        return None, "名字里有特殊字符"
    if len(password) > 64:
        return None, "密码最多 64 位"
    return (username, password), None


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def _json(self, status, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/leaderboard":
            with BOARD_LOCK:
                rows = sorted(read_board(), key=lambda x: (-int(x.get("score", 0)), x.get("username", "")))[:5]
            return self._json(200, rows)
        if path == "/api/stats":
            with BOARD_LOCK:
                accounts = read_accounts()
                rows = read_board()
            saves = sum(1 for a in accounts.values() if a.get("save_data"))
            return self._json(200, {
                "registered": len(accounts),
                "syncedSaves": saves,
                "players": len(rows),
                "totalScore": sum(int(x.get("score", 0)) for x in rows),
                "top": sorted(rows, key=lambda x: -int(x.get("score", 0)))[:10],
            })
        if path == "/admin":
            html = """<!DOCTYPE html><html lang="zh-CN"><meta charset="utf-8"><title>词宠岛 · 运营看板</title>
<style>body{font-family:"Microsoft YaHei",sans-serif;background:#FFF7E8;margin:24px;color:#5C4A38}
h2{color:#C4577E}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}
.cell{background:#fff;border:2px solid #FFE0B8;border-radius:14px;padding:14px;text-align:center}
.cell b{display:block;font-size:26px;color:#C4577E}table{width:100%;border-collapse:collapse;background:#fff}
td,th{border:1px solid #FFE0B8;padding:8px 12px;text-align:left}</style>
<h2>🏝️ 词宠岛 · 运营看板</h2><div class="grid" id="g"></div>
<h3>排行榜 Top 10</h3><table id="t"></table>
<script>fetch('/api/stats').then(r=>r.json()).then(d=>{
document.getElementById('g').innerHTML=[['注册账号',d.registered],['已云同步存档',d.syncedSaves],['上榜玩家',d.players],['累计积分',d.totalScore]]
.map(x=>`<div class="cell"><b>${x[1]}</b>${x[0]}</div>`).join('');
document.getElementById('t').innerHTML='<tr><th>名字</th><th>分数</th></tr>'+d.top.map(x=>`<tr><td>${x.username}</td><td>${x.score}</td></tr>`).join('');
});</script>"""
            body = html.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/register":
            return self._register()
        if path == "/api/login":
            return self._login()
        if path == "/api/update":
            return self._update()
        if path == "/api/push-save":
            return self._push_save()
        if path == "/api/pull-save":
            return self._pull_save()
        if path != "/api/score":
            return self._json(404, {"error": "not found"})
        try:
            length = min(int(self.headers.get("Content-Length", "0")), 4096)
            body = json.loads(self.rfile.read(length) or b"{}")
            username = str(body.get("username", "")).strip()[:20]
            delta = max(0, min(100, int(body.get("delta", 1))))
            gender = "girl" if body.get("gender") == "girl" else "boy"  # 未上报的老数据默认男孩
            password = str(body.get("password") or "")
            if not username or not delta:
                return self._json(400, {"error": "invalid score"})
        except (ValueError, TypeError, json.JSONDecodeError):
            return self._json(400, {"error": "invalid json"})
        with BOARD_LOCK:
            # 记账必须带对密码，否则别人用同名就能改你的分数
            accounts = read_accounts()
            acc = accounts.get(username)
            if not acc or acc.get("pwd") != hash_pwd(username, password):
                return self._json(401, {"error": "请先登录"})
            rows = read_board()
            row = next((x for x in rows if x.get("username") == username), None)
            if row is None:
                row = {"username": username, "score": 0, "gender": gender}
                rows.append(row)
            row["score"] = int(row.get("score", 0)) + delta
            row["gender"] = gender
            write_board(rows)
        return self._json(200, row)

    def _read_json_body(self, max_len=4096):
        length = min(int(self.headers.get("Content-Length", "0")), max_len)
        return json.loads(self.rfile.read(length) or b"{}")

    def _check_creds(self, body):
        """校验用户名+密码，返回账户 dict 或 None"""
        username = str(body.get("username") or "").strip()[:20]
        password = str(body.get("password") or "")
        accounts = read_accounts()
        acc = accounts.get(username)
        if not acc or acc.get("pwd") != hash_pwd(username, password):
            return None
        return acc

    def _push_save(self):
        """上传完整存档（换设备同步用）"""
        try:
            body = self._read_json_body(max_len=131072)
        except (ValueError, json.JSONDecodeError):
            return self._json(400, {"error": "invalid json"})
        acc = self._check_creds(body)
        if not acc:
            return self._json(401, {"error": "请先登录"})
        save = body.get("save")
        if not isinstance(save, dict):
            return self._json(400, {"error": "invalid save"})
        raw = json.dumps(save, ensure_ascii=False)
        if len(raw) > 131072:
            return self._json(413, {"error": "存档太大"})
        username = str(body.get("username") or "").strip()[:20]
        with BOARD_LOCK:
            accounts = read_accounts()
            if username in accounts:
                accounts[username]["save_data"] = save
                write_accounts(accounts)
        return self._json(200, {"ok": True})

    def _pull_save(self):
        """拉取完整存档（换设备登录时补齐历史进度）"""
        try:
            body = self._read_json_body()
        except (ValueError, json.JSONDecodeError):
            return self._json(400, {"error": "invalid json"})
        acc = self._check_creds(body)
        if not acc:
            return self._json(401, {"error": "请先登录"})
        return self._json(200, {"save": acc.get("save_data") or None})

    def _register(self):
        try:
            body = self._read_json_body()
        except (ValueError, json.JSONDecodeError):
            return self._json(400, {"error": "invalid json"})
        creds, err = clean_creds(body)
        if err:
            return self._json(400, {"error": err})
        username, password = creds
        with BOARD_LOCK:
            accounts = read_accounts()
            # 昵称唯一：已注册的、或老排行榜里已有的名字，都不能再注册，只能登录
            if username in accounts or is_legacy_name(username, read_board()):
                return self._json(409, {"error": "这个名字已经有人用了"})
            gender = "girl" if body.get("gender") == "girl" else "boy"
            accounts[username] = {"pwd": hash_pwd(username, password), "gender": gender}
            write_accounts(accounts)
        return self._json(201, {"username": username, "gender": gender, "score": 0})

    def _login(self):
        try:
            body = self._read_json_body()
        except (ValueError, json.JSONDecodeError):
            return self._json(400, {"error": "invalid json"})
        creds, err = clean_creds(body)
        if err:
            return self._json(400, {"error": err})
        username, password = creds
        with BOARD_LOCK:
            accounts = read_accounts()
            rows = read_board()
            acc = accounts.get(username)
            if not acc:
                # 老账号：还没登记过密码，默认密码 000000；登录成功后补登记
                if not is_legacy_name(username, rows):
                    return self._json(404, {"error": "还没有这个名字，去注册吧"})
                if password != LEGACY_PASSWORD:
                    return self._json(401, {"error": "密码不对"})
                acc = {"pwd": hash_pwd(username, LEGACY_PASSWORD), "gender": gender_of(username, rows)}
                accounts[username] = acc
                write_accounts(accounts)
            elif acc.get("pwd") != hash_pwd(username, password):
                return self._json(401, {"error": "密码不对"})
            gender = "girl" if acc.get("gender") == "girl" else gender_of(username, rows)
            score = score_of(username, rows)
        return self._json(200, {"username": username, "gender": gender, "score": score})

    def _update(self):
        """改档案：改昵称 / 改密码（改完昵称后密码按新昵称重新加盐）"""
        try:
            body = self._read_json_body()
        except (ValueError, json.JSONDecodeError):
            return self._json(400, {"error": "invalid json"})
        cur, err = clean_creds(body)
        if err:
            return self._json(400, {"error": err})
        nxt, err = clean_creds({"username": body.get("newUsername"), "password": body.get("newPassword")})
        if err:
            return self._json(400, {"error": err})
        cur_name, cur_pwd = cur
        new_name, new_pwd = nxt
        with BOARD_LOCK:
            accounts = read_accounts()
            rows = read_board()
            acc = accounts.get(cur_name)
            # 先验证当前身份；老名字（没登记过）按空密码验证；没出现过的名字当新注册放行
            if acc:
                if acc.get("pwd") != hash_pwd(cur_name, cur_pwd):
                    return self._json(401, {"error": "密码不对"})
            elif is_legacy_name(cur_name, rows):
                if cur_pwd != LEGACY_PASSWORD:
                    return self._json(401, {"error": "密码不对"})
            # 改昵称要保证新名字没被别人占用
            if new_name != cur_name and (new_name in accounts or is_legacy_name(new_name, rows)):
                return self._json(409, {"error": "这个名字已经有人用了"})
            gender = "girl" if (acc and acc.get("gender") == "girl") or gender_of(cur_name, rows) == "girl" else "boy"
            if new_name != cur_name:
                accounts.pop(cur_name, None)
            accounts[new_name] = {"pwd": hash_pwd(new_name, new_pwd), "gender": gender}
            write_accounts(accounts)
            # 排行榜里的分数跟着改名，别丢进度
            if new_name != cur_name:
                row = next((x for x in rows if str(x.get("username", "")) == cur_name), None)
                if row:
                    row["username"] = new_name
                    write_board(rows)
            score = score_of(new_name, read_board())
        return self._json(200, {"username": new_name, "gender": gender, "score": score})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def end_headers(self):
        # 与 serve.js 缓存策略一致：模型几十 MB 且内容不变，长缓存避免每次进游戏重复下载；
        # 音频 7 天；API 保持不缓存；其余代码文件不缓存（Python 版不做 ETag 协商）
        path = urlparse(self.path).path
        if "/models/" in path:
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        elif "/audio/" in path:
            self.send_header("Cache-Control", "public, max-age=604800")
        elif path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store, must-revalidate")
            self.send_header("Expires", "0")
        else:
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("0.0.0.0", PORT), NoCacheHandler).serve_forever()
