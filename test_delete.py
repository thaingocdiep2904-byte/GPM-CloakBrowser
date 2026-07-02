import json, urllib.request, urllib.error

req = urllib.request.Request('http://localhost:8080/api/profiles')
profiles = json.loads(urllib.request.urlopen(req).read())
print('Total profiles:', len(profiles))

test_profiles = [p for p in profiles if 'Test' in p['name'] or 'Import' in p['name'] or '321' in p['name']]
print('Test profiles:', [p['name'] for p in test_profiles])

for p in test_profiles[:3]:
    pid = p['id']
    name = p['name']
    req = urllib.request.Request(f'http://localhost:8080/api/profiles/{pid}', method='DELETE')
    try:
        r = urllib.request.urlopen(req)
        print(f'Delete OK: {name} status={r.status}')
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f'Delete FAIL {name} HTTP {e.code}: {body}')
    except Exception as e:
        print(f'Delete ERROR {name}: {e}')
