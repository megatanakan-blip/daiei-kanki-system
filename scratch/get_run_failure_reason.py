import json, urllib.request

url = 'https://api.github.com/repos/megatanakan-blip/daiei-kanki-system/actions/runs/32700611429'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
res = json.load(urllib.request.urlopen(req))

jobs_url = res['jobs_url']
req2 = urllib.request.Request(jobs_url, headers={'User-Agent': 'Mozilla/5.0'})
res2 = json.load(urllib.request.urlopen(req2))

with open('scratch/out.txt', 'w', encoding='utf-8') as f:
    f.write(json.dumps(res2, indent=2))
