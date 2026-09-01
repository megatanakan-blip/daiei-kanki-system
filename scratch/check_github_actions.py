import json, urllib.request

url = 'https://api.github.com/repos/megatanakan-blip/daiei-kanki-system/actions/runs/32698048011/jobs'
req = urllib.request.Request(url, headers={'User-Agent': 'Python'})
res = json.load(urllib.request.urlopen(req))

for j in res.get('jobs', []):
    print("Job Name:", j['name'])
    for s in j.get('steps', []):
        print(f"  Step: {s['name']} -> status: {s['status']}, conclusion: {s['conclusion']}")
