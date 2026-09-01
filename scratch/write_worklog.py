import json, os, sys, urllib.request

sys.stdout.reconfigure(encoding='utf-8')

LOG_URL = "https://corexia-dejima-log-minorukd-spec.aws-ap-northeast-1.turso.io/v2/pipeline"
LOG_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJleHAiOjE4MTU5MTk4MjMsImlhdCI6MTc4NDM4MzgyMywiaWQiOiIwMTlmNzU4ZS0wNTAxLTc2NzYtODNkOS1mZmJlYTkyMjI3NTUiLCJraWQiOiI0S0RMbmNhWFEwWFFiSWRKcXNRd0poNmNPbE5sYnBEcTk3T2hsRnE5eGprIiwicmlkIjoiYzkyMmFmZjAtNTU5Ni00ZGUyLWI2ZmQtMTMwZGViNzkyNGM0In0.yCa13JymatE1yXAdGeJxmX9yBaf5RFcuK3P_-OqiJ4mFeca8O7nR8NVi7gwTTjJlZAo5U4NVSuO9isOIk6hbAw"

def write_worklog():
    sql = """
    INSERT INTO dj_worklog (finding_no, kind, body, report_plain, commit_ref, by_who, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now','+9 hours'))
    """
    args = [
        "17",
        "修正済",
        "siteHistoryItems の顧客名正規化（normalizeForSearch）による表記ゆれ吸収、itemSuggestions で返品モード時の未入力時納品履歴全件表示（100件）、filterAndSortItems による複数語AND・ひらがな/全角半角正規化検索適用、searchUtils での historyMonth 検索対象追加、返品時の適用単価保持を修正。",
        "返品伝票作成時、検索窓が空の状態でも納品履歴から資材の一覧がすぐ表示され、複数キーワードやひらがな・全角半角の違いがあっても正しく検索ヒットするように改善しました。",
        "951f7525818774953ca0767842900aa22a5fb156",
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
    
    print("dj_worklog に無事記録が書き込まれました！")

write_worklog()
