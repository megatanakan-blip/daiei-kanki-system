import json, os, sys, urllib.request

sys.stdout.reconfigure(encoding='utf-8')

BOARD_URL = "https://corexia-dejima-board-minorukd-spec.aws-ap-northeast-1.turso.io/v2/pipeline"
BOARD_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicm8iLCJleHAiOjE4MTU5MjA3NTEsImlhdCI6MTc4NDM4NDc1MSwiaWQiOiIwMTlmNzU2OC1mMzAxLTc1YmMtYjNmMS03ZjVlMjM5YzExYTAiLCJraWQiOiI0S0RMbmNhWFEwWFFiSWRKcXNRd0poNmNPbE5sYnBEcTk3T2hsRnE5eGprIiwicmlkIjoiYjkyMTg5OTItZGRjOS00NWViLTgxMDEtMjY3YTZmNGI5YTkyIn0.buMtB6Baw_24uyrr2FOrt5gtBcVpf9iEcFJvprZAIVUIvH9ztArrM2zQLt_jUTIBrVQYDc7SH1KPG1ZRQYozBg"

LOG_URL = "https://corexia-dejima-log-minorukd-spec.aws-ap-northeast-1.turso.io/v2/pipeline"
LOG_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJleHAiOjE4MTU5MTk4MjMsImlhdCI6MTc4NDM4MzgyMywiaWQiOiIwMTlmNzU4ZS0wNTAxLTc2NzYtODNkOS1mZmJlYTkyMjI3NTUiLCJraWQiOiI0S0RMbmNhWFEwWFFiSWRKcXNRd0poNmNPbE5sYnBEcTk3T2hsRnE5eGprIiwicmlkIjoiYzkyMmFmZjAtNTU5Ni00ZGUyLWI2ZmQtMTMwZGViNzkyNGM0In0.yCa13JymatE1yXAdGeJxmX9yBaf5RFcuK3P_-OqiJ4mFeca8O7nR8NVi7gwTTjJlZAo5U4NVSuO9isOIk6hbAw"

def dejima(sql, args=None, which="board"):
    url = BOARD_URL if which == "board" else LOG_URL
    token = BOARD_TOKEN if which == "board" else LOG_TOKEN
    stmt = {"sql": sql}
    if args:
        stmt["args"] = [{"type": "text", "value": str(a)} for a in args]
    body = json.dumps({"requests": [{"type": "execute", "stmt": stmt}, {"type": "close"}]}).encode()
    req = urllib.request.Request(url, data=body, headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        res = json.load(r)

    first = res["results"][0]
    if first.get("type") == "error":
        raise RuntimeError("出島への操作が失敗しました: " + first["error"].get("message", ""))

    rows = first.get("response", {}).get("result", {}).get("rows", [])
    cols = [c["name"] for c in first.get("response", {}).get("result", {}).get("cols", [])]
    return cols, [[c.get("value") for c in row] for row in rows]

print("=== Search dj_findings for 返品 / 検索 ===")
cols, rows = dejima("SELECT no, area, title, when_ctx, symptom, tech_what, tech_where, done_when, ripple FROM dj_findings WHERE title LIKE '%返品%' OR symptom LIKE '%返品%' OR tech_what LIKE '%返品%' OR tech_where LIKE '%返品%' OR title LIKE '%検索%' OR symptom LIKE '%検索%' ORDER BY CAST(no AS INTEGER)")
for r in rows:
    item = dict(zip(cols, r))
    print(f"No.{item['no']} [{item['area']}] {item['title']}")
    print(f"  状況: {item['when_ctx']}")
    print(f"  現象: {item['symptom']}")
    print(f"  技術概要: {item['tech_what']}")
    print(f"  対象箇所: {item['tech_where']}")
    print(f"  完了条件: {item['done_when']}")
    print(f"  影響: {item['ripple']}")
    print("-" * 50)
