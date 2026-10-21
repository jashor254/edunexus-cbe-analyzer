# KICD curriculum-design data

Loads the official KICD curriculum designs into `sow_strands.kicd_data`, the
grounding source for scheme-of-work generation (`lib/sow/kicdGrounding.ts`):
per sub-strand, the specific learning outcomes, suggested learning
experiences, key inquiry questions, suggested lessons, content points, core
competencies, values and PCIs.

| File | Purpose |
|---|---|
| `parse_kicd_design.py` | PDF → per-sub-strand JSON (column-aware, English + Kiswahili, JSS + Grade 10) |
| `test_parse_kicd_design.py` | Regression tests against real designs |
| `designs.json` | Which PDF feeds which grade(s) + learning area(s), and how (`replace` / `merge-attributes`) |
| `load-kicd-data.ts` | Maps each DB strand to its design strand with the generator's own matcher and writes `kicd_data` |

Sources: `data/kicd-pdfs/` (Grade 10 + Kiswahili 7–9) and `data/kicd-pdfs/jss/`
(Grades 7–9, other subjects).

```bash
# tests (needs python3 + poppler's pdftotext)
python3 -m unittest scripts/kicd/test_parse_kicd_design.py

# dry run — prints per-subject strand mapping and grounding coverage, writes nothing
npx tsx -r dotenv/config scripts/kicd/load-kicd-data.ts --verbose dotenv_config_path=.env.local

# write (backs up the touched strands' previous kicd_data to scripts/kicd/backups/ first)
npx tsx -r dotenv/config scripts/kicd/load-kicd-data.ts --apply dotenv_config_path=.env.local
```

`.env.local` targets the local database; production needs
`dotenv_config_path=.env.local.kangai.bak`.

**Mapping rules.** A DB strand is matched to a design strand by strand-title
agreement, then rows matching entry titles (strict — no fallbacks), then
position in the design; each design strand is claimed by at most one DB strand
per learning area. Rows the design does not cover (seeded topics from another
grade, extra strands) stay ungrounded and the generator says so — they are
never given another sub-strand's outcomes. `merge-attributes` (Kiswahili,
whose entries were already loaded) only adds competencies / values / PCIs by
sub-strand number.

**Rollback.** Each `--apply` writes `scripts/kicd/backups/kicd_data-<time>.json`
(`[{ id, kicd_data }]` — the previous values); upsert those rows back to restore.
