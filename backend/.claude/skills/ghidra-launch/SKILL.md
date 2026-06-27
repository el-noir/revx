---
name: ghidra-launch
description: Initializes a binary in Ghidra via the MCP server. Use when the user wants to open or import a new binary into Ghidra for analysis.
---
# Ghidra Launch Skill

## When to use
- User says "load this into Ghidra", "open in Ghidra", "import binary"
- Ghidra MCP server is connected

## Workflow
1. Verify binary exists: `Read` or `Bash ls -la <path>`
2. Import: `mcp__ghidra__import_binary` if available
3. Confirm load: `mcp__ghidra__list_functions` — wait for analysis to complete (may take 30-120s for large binaries)
4. Report: file format, function count, and readiness for analysis

## If import tool unavailable
Ask user to import manually in Ghidra GUI and re-run analysis,
then confirm readiness with `mcp__ghidra__list_functions`.
