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
        "siteHistoryItems の一意識別キー(historyKey)生成ロジックを追加し、getSuggestionKey による識別キーの統一を実施。同一資材マスターIDで同月納品された異なる単価/型番の履歴のキー衝突（複数同期チェックおよび単価上書きの不具合）を根本解決。コミット 62f7faf にてGitHubへプッシュ完了。",
        "返品候補の一覧で、同一の品名・同月納品でも単価や型番が異なる資材を選択した際、他アイテムまで同時に選択されたり納品単価が上書きされてしまう不具合を修正・改善しました。",
        "62f7fafb3967d686f05f5ce9953adcb1a90c01a9",
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
    
    print("dj_worklog への追記が成功しました！")

update_worklog()
