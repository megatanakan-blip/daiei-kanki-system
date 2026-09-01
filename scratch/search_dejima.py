import json, urllib.request, sys

BOARD_URL = 'https://corexia-dejima-board-minorukd-spec.aws-ap-northeast-1.turso.io/v2/pipeline'
BOARD_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicm8iLCJleHAiOjE4MTU5MjA3NTEsImlhdCI6MTc4NDM4NDc1MSwiaWQiOiIwMTlmNzU2OC1mMzAxLTc1YmMtYjNmMS03ZjVlMjM5YzExYTAiLCJraWQiOiI0S0RMbmNhWFEwWFFiSWRKcXNRd0poNmNPbE5sYnBEcTk3T2hsRnE5eGprIiwicmlkIjoiYjkyMTg5OTItZGRjOS00NWViLTgxMDEtMjY3YTZmNGI5YTkyIn0.buMtB6Baw_24uyrr2FOrt5gtBcVpf9iEcFJvprZAIVUIvH9ztArrM2zQLt_jUTIBrVQYDc7SH1KPG1ZRQYozBg'

LOG_URL = 'https://corexia-dejima-log-minorukd-spec.aws-ap-northeast-1.turso.io/v2/pipeline'
LOG_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJleHAiOjE4MTU5MTk4MjMsImlhdCI6MTc4NDM4MzgyMywiaWQiOiIwMTlmNzU4ZS0wNTAxLTc2NzYtODNkOS1mZmJlYTkyMjI3NTUiLCJraWQiOiI0S0RMbmNhWFEwWFFiSWRKcXNRd0poNmNPbE5sYnBEcTk3T2hsRnE5eGprIiwicmlkIjoiYzkyMmFmZjAtNTU5Ni00ZGUyLWI2ZmQtMTMwZGViNzkyNGM0In0.yCa13JymatE1yXAdGeJxmX9yBaf5RFcuK3P_-OqiJ4mFeca8O7nR8NVi7gwTTjJlZAo5U4NVSuO9isOIk6hbAw'

def query_turso(url, token, sql):
    stmt = {'sql': sql}
    body = json.dumps({'requests': [{'type': 'execute', 'stmt': stmt}, {'type': 'close'}]}).encode()
    req = urllib.request.Request(url, data=body, headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as r:
        res = json.load(r)
    first = res['results'][0]
    if first.get('type') == 'error':
        raise RuntimeError(first['error'].get('message', ''))
    rows = first.get('response', {}).get('result', {}).get('rows', [])
    cols = [c['name'] for c in first.get('response', {}).get('result', {}).get('cols', [])]
    return cols, [[c.get('value') for c in row] for row in rows]

sys.stdout.reconfigure(encoding='utf-8')

print('=== dj_findings (Checking all items for 赤伝 / 返品 / 締日 / 請求 / 日付) ===')
cols, rows = query_turso(BOARD_URL, BOARD_TOKEN, "SELECT no, title, when_ctx, symptom, tech_what, tech_where, done_when, ripple FROM dj_findings")
matched_findings = []
for r in rows:
    item = dict(zip(cols, r))
    s = json.dumps(item, ensure_ascii=False)
    if any(k in s for k in ['赤伝', '返品', '締日', '締', '日付', '末日', '締め']):
        matched_findings.append(item)
        print(f"No.{item['no']}: {item['title']}\n  Symptom: {item['symptom']}\n  Tech: {item['tech_what']}\n  Where: {item['tech_where']}\n  DoneWhen: {item['done_when']}\n  Ripple: {item['ripple']}\n")

print('=== dj_qa ===')
cols, rows = query_turso(LOG_URL, LOG_TOKEN, "SELECT * FROM dj_qa")
for r in rows:
    item = dict(zip(cols, r))
    s = json.dumps(item, ensure_ascii=False)
    if any(k in s for k in ['赤伝', '返品', '締日', '締', '日付', '末日', '締め']):
        print(item)

print('=== dj_techdoc ===')
cols, rows = query_turso(BOARD_URL, BOARD_TOKEN, "SELECT section, title, body FROM dj_techdoc")
for r in rows:
    s = str(r[2])
    if any(k in s for k in ['赤伝', '締日', '締', '末日', '締め']):
        print(f"Sec {r[0]}: {r[1]}\n  Matches found in body\n")
