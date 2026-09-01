import json, urllib.request

url = 'https://api.github.com/repos/megatanakan-blip/daiei-kanki-system/actions/runs'
req = urllib.request.Request(url, headers={'User-Agent': 'Python'})
res = json.load(urllib.request.urlopen(req))

runs = res.get('workflow_runs', [])
with open('scratch/out.txt', 'w', encoding='utf-8') as f:
    for r in runs[:5]:
        f.write(f"Run ID: {r['id']} | Name: {r['name']} | Status: {r['status']} | Conclusion: {r['conclusion']} | SHA: {r['head_sha'][:7]}\n")
