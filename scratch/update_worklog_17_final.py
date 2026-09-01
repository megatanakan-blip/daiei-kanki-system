import json, os, sys, urllib.request

sys.stdout.reconfigure(encoding='utf-8')

LOG_URL = "https://corexia-dejima-log-minorukd-spec.aws-ap-northeast-1.turso.io/v2/pipeline"
LOG_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJleHAiOjE4MTU5MTk4MjMsImlhdCI6MTc4NDM4MzgyMywiaWQiOiIwMTlmNzU4ZS0wNTAxLTc2NzYtODNkOS1mZmJlYTkyMjI3NTUiLCJraWQiOiI0S0RMbmNhWFEwWFFiSWRKcXNRd0poNmNPbE5sYnBEcTk3T2hsRnE5eGprIiwicmlkIjoiYzkyMmFmZjAtNTU5Ni00ZGUyLWI2ZmQtMTMwZGViNzkyNGM0In0.yCa13JymatE1yXAdGeJxmX9yBaf5RFcuK3P_-OqiJ4mFeca8O7nR8NVi7gwTTjJlZAo5U4NVSuO9isOIk6hbAw"

def update_worklog():
    sql = """
    INSERT INTO dj_worklog (finding_no, kind, body, report_plain, commit_ref, by_who, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now','+9 hours'))
    """
    args = [
        "17",
        "修正済",
        "siteHistoryItems の独自IDプロパティ(id)へ独自一意キー(hist__...)を直接割り当て。過去伝票の明細においてappliedPriceが未定義・0の場合のフォールバックをsellingPriceも含めて強化。コミット f05d035 をリモートへプッシュ。",
        "返品候補の独自ID設定と過去伝票の単価取得フォールバック処理を強化しました。",
        "f05d035b88235222ef50f44358a98b46617bbd37",
        "gemini"
    ]
    
    stmt = {
        "sql": sql,
        "args": [{"type": "text", "value": str(a)} for a in args]
    }
    body = json.dumps({"requests": [{"type": "execute", "stmt": stmt}, {"type": "close"}]}).encode()
    req = urllib.request.Request(LOG_URL, data=body, headers={
        "Authorization": f"Bearer {LOG_TOKEN}",
        "Content-Type": "application/json"
    })
    
    with urllib.request.urlopen(req) as r:
        res = json.load(r)

    first = res["results"][0]
    if first.get("type") == "error":
        raise RuntimeError("出島ログへの書き込みが失敗しました: " + first["error"].get("message", ""))
    
    print("dj_worklog への最終追記が成功しました！")

update_worklog()
