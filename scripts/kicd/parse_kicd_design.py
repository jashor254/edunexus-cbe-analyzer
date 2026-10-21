#!/usr/bin/env python3
"""
scripts/kicd/parse_kicd_design.py

Parses a KICD curriculum-design PDF (JSS Grade 7-9 or Senior Grade 10, English
or Kiswahili) into per-sub-strand entries:

  title, number, suggested_lessons, content (sub-strand bullet points),
  learning_outcomes, learning_experiences, key_inquiry_questions,
  core_competencies, values, pcis

Column-aware: uses word coordinates from poppler's `pdftotext -bbox`, finds
each page's table header (Strand | Sub Strand | Specific Learning Outcomes |
Suggested Learning Experiences | Key Inquiry Question(s), or the Kiswahili
Mada | Mada Ndogo | Matokeo Maalum | Mapendekezo ya Shughuli | Swali Dadisi),
carries the columns across continuation pages, and reads the "Core
competencies / Values / PCIs" (Umilisi / Maadili / Masuala Mtambuko) blocks
that follow each sub-strand.

Stdlib only + the `pdftotext` binary. Writes JSON to stdout.

  python3 scripts/kicd/parse_kicd_design.py data/kicd-pdfs/jss/integrated-science-grade8.pdf
"""
import html
import json
import re
import subprocess
import sys

BULLETS = '●•▪◦■➢✓'
BULLET_RE = re.compile('[' + re.escape(BULLETS) + ']')

HEADER_COL2 = re.compile(r'^(specific|matokeo)$', re.I)
HEADER_COL3 = re.compile(r'^(suggested|mapendekezo)$', re.I)
HEADER_COL3_FALLBACK = re.compile(r'^(learning|shughuli)$', re.I)
HEADER_COL4 = re.compile(r'^(suggested|key|swali|maswali)$', re.I)

ATTR_HEADINGS = [
    ('core_competencies', re.compile(r'^\s*(core\s+competenc|umilisi\s+wa\s+kimsingi)', re.I)),
    ('values', re.compile(r'^\s*(values|maadili)\b', re.I)),
    ('pcis', re.compile(r'^\s*(pertinent\s+and\s+contemporary|pcis?\b|masuala\s+mtambuko)', re.I)),
    ('_links', re.compile(r'^\s*(link(s)?\s+to\s+other|uhusiano\s+na\s+masomo)', re.I)),
    ('_rubric', re.compile(r'^\s*(appendix|annex|suggested\s+assessment\s+rubric|assessment\s+rubric|kiambatisho|mapendekezo\s+ya\s+tathmini|muhtasari\s+wa\s+mbinu|vigezo)', re.I)),
    ('_csl', re.compile(r'^\s*(community\s+service\s+learning|kazi\s+mradi\s+ya\s+shughuli)', re.I)),
]

SUBSTRAND_NO = re.compile(r'^(\d{1,2})\s?\.\s?(\d{1,2})(?:\s?\.\s?(\d{1,2}))?\b')
LESSONS_RE = re.compile(r'\(?\s*(\d{1,3})\s*(lessons?|vipindi|periods?)\s*\)?|\(?\s*(vipindi|lessons?)\s*(\d{1,3})\s*\)?', re.I)


def words_by_page(pdf):
    out = subprocess.run(['pdftotext', '-bbox', pdf, '-'], capture_output=True, text=True, check=True).stdout
    pages = []
    for page_xml in re.findall(r'<page[^>]*>(.*?)</page>', out, re.S):
        words = []
        for m in re.finditer(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', page_xml):
            x0, y0, x1, y1 = map(float, m.groups()[:4])
            words.append((x0, y0, x1, y1, html.unescape(m.group(5))))
        pages.append(words)
    return pages


def lines_of(words, tol=3.0):
    lines = []
    for w in sorted(words, key=lambda w: (round(w[1], 1), w[0])):
        if lines and abs(lines[-1]['y'] - w[1]) <= tol:
            lines[-1]['words'].append(w)
        else:
            lines.append({'y': w[1], 'words': [w]})
    for ln in lines:
        ln['words'].sort(key=lambda w: w[0])
        ln['text'] = ' '.join(w[4] for w in ln['words'])
    return lines


def header_edges(line):
    """Column left edges if this line is a table header, else None."""
    ws = line['words']
    texts = [w[4].strip(':').lower() for w in ws]
    if not ws or texts[0] not in ('strand', 'mada', 'theme', 'topic'):
        return None
    try:
        i2 = next(i for i, t in enumerate(texts) if HEADER_COL2.match(t))
        i3 = next((i for i in range(i2 + 1, len(texts)) if HEADER_COL3.match(texts[i]) and ws[i][0] - ws[i2][0] > 40), None)
        if i3 is None:  # header without "Suggested": "Learning Experiences" well right of "Specific"
            i3 = next(i for i in range(i2 + 1, len(texts)) if HEADER_COL3_FALLBACK.match(texts[i]) and ws[i][0] - ws[i2][0] > 80)
        i4 = next(i for i in range(i3 + 1, len(texts)) if HEADER_COL4.match(texts[i]) and ws[i][0] - ws[i3][0] > 40)
    except StopIteration:
        return None
    i1 = next((i for i in range(1, i2) if texts[i] in ('sub', 'sub-strand', 'substrand', 'sub-', 'mada', 'sub-theme', 'subtopic')), None)
    if i1 is None:
        return None
    return [ws[0][0], ws[i1][0], ws[i2][0], ws[i3][0], ws[i4][0]]


def column_of(x, edges):
    col = 0
    for i, e in enumerate(edges):
        if x + 3 >= e:
            col = i
    return col


def attr_heading(text):
    for key, rx in ATTR_HEADINGS:
        if rx.match(text):
            return key
    return None


def is_page_number(line, page_h):
    return re.fullmatch(r'[ivxlc\d]{1,4}', line['text'].strip(), re.I) is not None


def split_items(text):
    parts = BULLET_RE.split(text)
    return [p for p in (clean(x) for x in parts) if p]


FURNITURE = re.compile(r'(?i)\bnot\s+for\s+sale\b|\bpage\s*\|\s*\d+\b|\b(?:suggested\s+)?(?:key\s+)?(?:inquiry\s+)?question\s*\(s\)\s*:?')


def scrub(text):
    """Page furniture that lands inside table cells: watermark, page labels,
    the wrapped "Question(s)" header word."""
    return re.sub(r'\s+', ' ', FURNITURE.sub(' ', text)).strip()


def clean(s):
    s = re.sub(r'\s+', ' ', s).strip()
    s = re.sub(r'^[\-–,;:.\s]+', '', s)
    s = re.sub(r'[\s,;.]+$', '', s)
    return s


def parse_outcomes(text):
    t = re.sub(r'(?is)^.*?(be able to|aweze|ataweza)\s*:?', '', text, count=1)
    items = re.split(r'(?:^|\s)\(?([a-z])\)\s+', ' ' + t)
    out = []
    for i in range(2, len(items), 2):
        c = clean(items[i])
        if c:
            out.append(c)
    if not out:
        out = split_items(t)
    return out


def parse_experiences(text):
    t = re.sub(r'(?is)^.*?(is guided to|are guided to|aelekezwe|waelekezwe)\s*:?', '', text, count=1)
    items = split_items(t)
    if len(items) <= 1:
        items = [clean(x) for x in re.split(r'(?:^|\s)\d{1,2}\.\s+', ' ' + t) if clean(x)]
    return items


def parse_kiq(text):
    t = re.sub(r'\s+', ' ', text).strip()
    qs = [clean(q) + '?' for q in re.split(r'\?', t) if clean(q)]
    qs = [re.sub(r'^\d{1,2}\.\s*', '', q) for q in qs]
    junk = re.compile(r'^((suggested\s+)?(key\s+)?inquiry\s+)?questions?\s*\(s\)\??$|^(suggested\s+)?key\s+inquiry|^(swali|maswali)\s+dadisi', re.I)
    return [q for q in qs if len(q) > 8 and not junk.match(q)]


CANONICAL_CC = [
    'Communication and collaboration', 'Critical thinking and problem solving', 'Creativity and imagination',
    'Citizenship', 'Digital literacy', 'Learning to learn', 'Self-efficacy',
    'Mawasiliano na ushirikiano', 'Uwazaji kina na utatuzi wa matatizo', 'Ubunifu', 'Uraia',
    'Ujuzi wa kidijitali', 'Hamu ya ujifunzaji', 'Kujiamini',
]
CANONICAL_VALUES = [
    'Love', 'Responsibility', 'Respect', 'Unity', 'Peace', 'Patriotism', 'Integrity', 'Social justice',
    'Upendo', 'Uwajibikaji', 'Heshima', 'Umoja', 'Amani', 'Uzalendo', 'Uadilifu', 'Haki ya kijamii', 'Uaminifu',
]

# Where an item's name ends: "Name: …", "Name; …", "Name- …", "Name is enhanced …",
# "Name enhanced as …", "Name through …", "Name as learners …".
NAME_END = re.compile(
    r'\s*[:;]|\s*[-–]\s+|\s+(?:is|are|was)\s+(?:being\s+)?(?:enhanced|nurtured|inculcated|developed|promoted|acquired|instilled|fostered|demonstrated|built|portrayed|exercised|exhibited|displayed|practised|practiced|shown|upheld)\b'
    r'|\s+(?:enhanced|nurtured|inculcated|developed|promoted|fostered)\b|\s+through\b|\s+as\s+(?:the\s+)?learners?\b|\s+when\s+(?:the\s+)?learners?\b'
    r'|\s+mwanafunzi\b|\s+wanafunzi\b',
    re.I,
)


ALIASES = {
    'imagination and creativity': 'Creativity and imagination',
    'creativity': 'Creativity and imagination',
    'problem solving and critical thinking': 'Critical thinking and problem solving',
    'critical thinking': 'Critical thinking and problem solving',
    'communication': 'Communication and collaboration',
    'self efficacy': 'Self-efficacy',
    'honesty': 'Integrity',
    'ubunifu na mawazo': 'Ubunifu',
    'fikra makini na utatuzi wa matatizo': 'Uwazaji kina na utatuzi wa matatizo',
    'kujifunza kujifunza': 'Hamu ya ujifunzaji',
}


def canonical(name, vocabulary):
    low = name.lower().replace('-', ' ').strip()
    alias = ALIASES.get(low)
    if alias and alias in vocabulary:
        return alias
    for v in vocabulary:
        vl = v.lower()
        if low == vl or low.startswith(vl) or vl.startswith(low) and len(low) > 5:
            return v
    first = ' '.join(low.split()[:2])
    for v in vocabulary:
        if v.lower().startswith(first) and len(first) > 5:
            return v
    return None


def attr_items(lines):
    """Bullet- or line-delimited items of one attribute block."""
    joined = '\n'.join(lines)
    if BULLET_RE.search(joined):
        return [clean(x.replace('\n', ' ')) for x in BULLET_RE.split(joined) if clean(x)]
    items = []
    for ln in lines:
        t = ln.strip()
        starts_item = re.match(r'^[A-Z\u00C0-\u024F]', t) and NAME_END.search(t[:90] + ' ')
        if starts_item or not items:
            items.append(t)
        else:
            items[-1] += ' ' + t
    return [clean(x) for x in items if clean(x)]


def parse_attr(lines, kind):
    names = []
    for item in attr_items(lines):
        m = NAME_END.search(item + ' ')
        name = clean(item[:m.start()]) if m else ''
        if not name or len(name.split()) > 8 or not re.match(r'^[A-Z\u00C0-\u024F]', name):
            continue
        # Competencies and values come from fixed official lists: a name that
        # maps to none of them is a parsing fragment, so it is dropped rather
        # than stored as if KICD listed it. PCIs are an open list.
        if kind == 'core_competencies':
            name = canonical(name, CANONICAL_CC)
        elif kind == 'values':
            name = next((c for c in (canonical(part.strip(), CANONICAL_VALUES) for part in name.split(',')) if c), None)
        elif len(name.split()) > 7 or re.search(r'\b(and|of|the|in|na|ya|wa)$', name, re.I):
            name = None
        if not name:
            continue
        if name.lower() in ('note', 'tanbihi') or re.fullmatch(r'[A-Z0-9 ]{4,}', name):
            continue
        names.append(name)
    seen, out = set(), []
    for n in names:
        if n.lower() not in seen:
            seen.add(n.lower())
            out.append(n)
    return out


def title_and_lessons(col1_text):
    t = re.sub(r'\s+', ' ', col1_text).strip()
    lessons = None
    m = LESSONS_RE.search(t)
    if m:
        lessons = int(m.group(1) or m.group(4))
    head = BULLET_RE.split(t)[0]
    head = LESSONS_RE.split(head)[0] if m and m.start() < len(BULLET_RE.split(t)[0]) else head
    head = re.sub(r'\(\s*$', '', head)
    content = split_items(t[len(BULLET_RE.split(t)[0]):]) if BULLET_RE.search(t) else []
    content = [LESSONS_RE.sub('', c).strip() for c in content]
    return clean(head), lessons, [c for c in content if c]


def parse(pdf):
    pages = words_by_page(pdf)
    edges = None
    in_table = False
    attr_key = None
    strands = {}          # theme number -> {'number', 'title'}
    entries = []
    cur = None
    theme_titles = {}

    def start_entry(number, theme):
        nonlocal cur
        cur = {'number': number, 'theme': theme, 'cols': {0: [], 1: [], 2: [], 3: [], 4: []},
               'attrs': {'core_competencies': [], 'values': [], 'pcis': []}}
        entries.append(cur)

    for words in pages:
        if not words:
            continue
        lines = lines_of(words)
        header_idx = None
        for i, ln in enumerate(lines):
            e = header_edges(ln)
            if e:
                header_idx, edges = i, e
                break
        for i, ln in enumerate(lines):
            text = ln['text'].strip()
            if not text or is_page_number(ln, None):
                continue
            # A strand's title is the line above its table header ("STRAND 1.0:
            # MIXTURES…", "11.0 HAKI ZA KIBINADAMU"). Only those lines count —
            # table-of-contents and appendix-table lines also start "1.0 …".
            above_header = header_idx is not None and i < header_idx
            if (above_header or not in_table) and not re.search(r'\.{4,}', text):
                mt = re.match(r'^(?:(?:strand|mada|theme)\s*(\d{1,2})(?:\.0)?|(\d{1,2})\.0)\s*[:.\-]?\s+(.{3,})$', text, re.I)
                keyword = re.match(r'^(strand|mada|theme)\b', text, re.I)
                if mt and (above_header or keyword):
                    num = mt.group(1) or mt.group(2)
                    if num not in theme_titles:
                        theme_titles[num] = clean(mt.group(3))
            if above_header:
                continue
            if header_idx is not None and i == header_idx:
                in_table, attr_key = True, None
                continue
            if header_idx is not None and i in (header_idx + 1,) and re.match(r'^(outcomes|yanayotarajiwa|inquiry|ujifunzaji)', text, re.I):
                continue
            key = attr_heading(text)
            if key:
                in_table = False
                attr_key = key
                rest = re.sub(r'^[^:]*:\s*', '', text) if ':' in text else ''
                if rest and cur and not key.startswith('_'):
                    cur['attrs'][key].append(rest)
                continue
            if in_table and edges:
                # sub-strand starts?
                col_words = {}
                for w in ln['words']:
                    col_words.setdefault(column_of(w[0], edges), []).append(w[4])
                c1 = ' '.join(col_words.get(1, []))
                m = SUBSTRAND_NO.match(c1)
                if m and (m.group(2) != '0'):
                    number = '.'.join(g for g in m.groups() if g)
                    start_entry(number, m.group(1))
                c0 = ' '.join(col_words.get(0, []))
                m0 = re.match(r'^(\d{1,2})\.0\b\s*(.*)$', c0)
                if m0:
                    strands.setdefault(m0.group(1), {'number': m0.group(1), 'title': ''})
                    strands[m0.group(1)]['title'] = clean(m0.group(2))
                    strands[m0.group(1)]['_open'] = True
                elif c0 and cur and strands.get(cur['theme'], {}).get('_open'):
                    # The strand cell wraps over a few lines; anything numbered,
                    # lettered or long is a different cell's content.
                    if re.search(r'\d|[a-z]\)|' + BULLET_RE.pattern, c0) or len((strands[cur['theme']]['title'] + ' ' + c0).split()) > 10:
                        strands[cur['theme']]['_open'] = False
                    else:
                        strands[cur['theme']]['title'] = clean(strands[cur['theme']]['title'] + ' ' + c0)
                if cur is None:
                    continue
                for c, ws in col_words.items():
                    cur['cols'][c].append(' '.join(ws))
            elif attr_key and cur and not attr_key.startswith('_'):
                cur['attrs'][attr_key].append(text)

    out_strands = {}
    for e in entries:
        title, lessons, content = title_and_lessons(scrub(' '.join(e['cols'][1])))
        title = re.sub(r'^' + re.escape(e['number']) + r'\s*', '', title).strip()
        title = re.sub(r'^[.\s]+', '', title)
        entry = {
            'title': f"{e['number']} {title}".strip(),
            'number': e['number'],
            'suggested_lessons': lessons,
            'content': content,
            'learning_outcomes': parse_outcomes(scrub(' '.join(e['cols'][2]))),
            'learning_experiences': parse_experiences(scrub(' '.join(e['cols'][3]))),
            'key_inquiry_questions': parse_kiq(scrub(' '.join(e['cols'][4]))),
            'core_competencies': parse_attr([scrub(x) for x in e['attrs']['core_competencies']], 'core_competencies'),
            'values': parse_attr([scrub(x) for x in e['attrs']['values']], 'values'),
            'pcis': parse_attr([scrub(x) for x in e['attrs']['pcis']], 'pcis'),
        }
        theme = e['theme']
        st = out_strands.setdefault(theme, {
            'number': theme,
            'title': theme_titles.get(theme) or strands.get(theme, {}).get('title', ''),
            'sub_strands': [],
        })
        # The same sub-strand number can re-open across a page break with a
        # repeated header; merge into the existing entry.
        prev = next((s for s in st['sub_strands'] if s['number'] == entry['number']), None)
        if prev:
            for k in ('content', 'learning_outcomes', 'learning_experiences', 'key_inquiry_questions', 'core_competencies', 'values', 'pcis'):
                prev[k] += [x for x in entry[k] if x not in prev[k]]
            prev['suggested_lessons'] = prev['suggested_lessons'] or entry['suggested_lessons']
        else:
            st['sub_strands'].append(entry)
    return {'source': pdf, 'strands': sorted(out_strands.values(), key=lambda s: int(s['number']))}


if __name__ == '__main__':
    print(json.dumps(parse(sys.argv[1]), ensure_ascii=False, indent=1))
