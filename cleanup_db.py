"""Clean up test profiles without unicode prints."""
import json, urllib.request, urllib.error

try:
    req = urllib.request.Request('http://localhost:8080/api/profiles')
    profiles = json.loads(urllib.request.urlopen(req).read())
    print(f'Total profiles found: {len(profiles)}')

    # Clean test profiles starts with Profile_ or Test_ or Import or 321
    test_keywords = ['Test_Import', 'Import_CSV', 'Import_API', 'Profile_', 'Profile_9', 'Profile_8', 'Profile_7', 'Profile_6', 'Profile_5', 'Profile_4', 'Profile_3', 'Profile_2', 'Profile_1', 'Profile_0', '321321']

    to_delete = []
    for p in profiles:
        name = p['name']
        for kw in test_keywords:
            if name.startswith(kw):
                to_delete.append(p)
                break

    print(f'Profiles to delete: {len(to_delete)}')
    
    deleted = 0
    for p in to_delete:
        pid = p['id']
        req2 = urllib.request.Request(f'http://localhost:8080/api/profiles/{pid}', method='DELETE')
        try:
            urllib.request.urlopen(req2)
            deleted += 1
        except Exception as e:
            print(f'Error deleting {p["name"]}: {e}')

    print(f'Deleted: {deleted}/{len(to_delete)} profiles')
except Exception as e:
    print("Error:", e)
