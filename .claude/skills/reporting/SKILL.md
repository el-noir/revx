---
name: reporting
description: Formats raw reverse-engineering notes into a structured JSON + Markdown report and saves it to disk. Use when it is time to produce a final report for a binary or CTF challenge.
---
# Reporting Skill

Take the raw analysis notes and produce a final structured report.

## Output format

First, output valid JSON matching this schema:

```json
{
  "file": "string",
  "format": "PE" | "ELF" | "Mach-O" | "Other" | "Unknown",
  "arch": "string",
  "bits": 32 | 64 | 0,
  "summary": "string",
  "capabilities": [{ "capability": "string", "evidence": "string" }],
  "keyFunctions": [{ "address": "string", "name": "string", "description": "string" }],
  "suspiciousIndicators": [{ "indicator": "string", "reason": "string" }],
  "stringsOfInterest": [{ "string": "string", "reason": "string" }],
  "conclusion": "string",
  "ctfFlag": "string | null"
}
```

Then produce Markdown:

```markdown
## Binary Analysis Report

**File:** <filename>
**Format:** <ELF/PE/Mach-O> | **Arch:** <x86/x64/ARM> | **Bits:** <32/64>

### Summary
<One paragraph. What does this binary do?>

### Capabilities
- <capability> (evidence: <function/import/string>)

### Key Functions
| Address | Name | Description |
|---------|------|-------------|
| 0x...   | ...  | ...         |

### Suspicious Indicators
- <indicator> — <reason>

### Strings of Interest
- `string` — <why interesting>

### Conclusion
<Purpose, risk level, malware family if applicable, or CTF flag location.>
```

## File output

Save the complete report (JSON block + Markdown) to a file named `<binary_basename>.report.md` in the same directory as the binary.
If a CTF flag was found, also write it to `<binary_basename>.flag.txt`.

If any field cannot be determined, use `"Not determined"` (string) or `[]` (array). Never omit required fields.
