import json, os, sys, urllib.request

sys.stdout.reconfigure(encoding='utf-8')

LOG_URL = "https://corexia-dejima-log-minorukd-spec.aws-ap-northeast-1.turso.io/v2/pipeline"
LOG_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJleHAiOjE4MTU5MTk4MjMsImlhdCI6MTc4NDM4MzgyMywiaWQiOiIwMTlmNzU4ZS0wNTAxLTc2NzYtODNkOS1mZmJlYTkyMjI3NTUiLCJraWQiOiI0S0RMbmNhWFEwWFFiSWRKcXNRd0poNmNPbE5sYnBEcTk3T2hsRnE5eGprIiwicmlkIjoiYzkyMmFmZjAtNTU5Ni00ZGUyLWI2ZmQtMTMwZGViNzkyNGM0In0.yCa13JymatE1yXAdGeJxmX9yBaf5RFcuK3P_-OqiJ4mFeca8O7nR8NVi7gwTTjJlZAo5U4NVSuO9isOIk6hbAw"

def write_journal():
    sql = """
    INSERT INTO dj_journal (created_at, by_who, done, progress, stuck, next_step, body)
    VALUES (datetime('now','+9 hours'), ?, ?, ?, ?, ?, ?)
    """
    args = [
        "gemini",
        "GitHubリモートURLをmegatanakan-blip/daiei-kanki-system.gitに変更。No.17（返品伝票作成時の資材検索）の修正および動作検証・ビルド通過。",
        "No.17 修正完了・コミット(951f752)およびdj_worklogへ記録。ビルド確認完了。",
        "特になし",
        "田中さんと次に着手する問題点について相談・決定",
        "GitHubリポジトリ設定変更後、出島ボードの dj_findings No.17（返品伝票作成時の検索不備）を特定。顧客名の表記ゆれ吸収、未入力時の納品履歴候補一覧表示、ひらがな・全角半角・複数キーワードAND検索の統一処理、単価保持ロジックを修正しビルドチェックを通して完了しました。"
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
        raise RuntimeError("出島日報への書き込みが失敗しました: " + first["error"].get("message", ""))
    
    print("dj_journal に日報が無事書き込まれました！")

write_journal()
