"""Import public chapter names only; no video, textbook content or account data."""
import json, re, urllib.request, xml.etree.ElementTree as ET
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
def text(url):
    with urllib.request.urlopen(url, timeout=40) as response:
        return response.read()

def group(sections):
    groups = {}
    for code, name in sections:
        chapter = re.search(r'\d+', code).group()
        groups.setdefault(chapter, []).append([code, name])
    return [[f'第{chapter}章', entries] for chapter, entries in groups.items()]

xml = ET.fromstring(text('https://digitalmaster.knsh.com.tw/all/video/public/j_math.xml'))
kangxuan = {}
for grade in range(7, 10):
    for semester, label in [(1, '上'), (2, '下')]:
        sections = []
        for record in xml:
            data = {item.tag: item.text or '' for item in record}
            if data.get('影片分類') != '課本解題' or data.get('冊次') != str(grade) + label:
                continue
            match = re.match(r'(\d+-\d+)\s+(.+)', data.get('章節名稱', ''))
            if match and list(match.groups()) not in sections:
                sections.append(list(match.groups()))
        assert sections, f'No chapters for Kangxuan {grade}-{semester}'
        kangxuan[f'{grade}-{semester}'] = group(sections)

def hanlin_term(item):
    grade, semester = item
    path = str(grade - 6) + ('A' if semester == 1 else 'B')
    soup = BeautifulSoup(text(f'https://mathvideo.hle.com.tw/{path}/'), 'html.parser')
    sections = []
    for link in soup.find_all('a'):
        match = re.match(r'^(\d+-\d+|CH\d+)\s*(.+)$', link.get_text(' ', strip=True))
        if match and link.get('href', '').startswith('/' + path + '/'):
            pair = [match[1], match[2]]
            if pair not in sections:
                sections.append(pair)
    assert sections, f'No chapters for Hanlin {path}'
    return f'{grade}-{semester}', group(sections)

with ThreadPoolExecutor(max_workers=6) as pool:
    hanlin = dict(pool.map(hanlin_term, [(g, s) for g in range(7, 10) for s in [1, 2]]))
result = '/** Public publisher chapter titles, imported 2026-11-13. See docs/curriculum-sources.md. */\n'
result += 'const KANGXUAN = ' + json.dumps(kangxuan, ensure_ascii=False, indent=2) + ';\n'
result += 'const HANLIN = ' + json.dumps(hanlin, ensure_ascii=False, indent=2) + ';\n'
(ROOT / 'apps-script' / 'PublisherCatalog.gs').write_text(result, encoding='utf-8')
print('Imported Kangxuan and Hanlin:', sum(len(c[1]) for data in [kangxuan, hanlin] for terms in data.values() for c in terms), 'sections in 12 volumes.')
