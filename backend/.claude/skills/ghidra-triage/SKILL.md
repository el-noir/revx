---
name: ghidra-triage
description: Structured binary triage using the Ghidra MCP server. Use when a binary has been provided and Ghidra MCP is connected AND Bash-based pre-triage has already been run.
---
# Ghidra Triage Skill

## When to use
- User explicitly asks to analyze a binary with Ghidra
- Bash pre-triage (file + strings) has already been done
- The Ghidra MCP server is available (mcp__ghidra__* tools present)

## Workflow
1. Confirm a program is loaded: `mcp__ghidra__list_functions` (fast check)
2. `mcp__ghidra__list_imports` — categorize imports by capability group
3. `mcp__ghidra__list_exports` — identify exposed surface
4. `mcp__ghidra__list_strings` (limit: 2000) — cross-reference with Bash strings
5. Decompile entry: `mcp__ghidra__decompile_function` on main / _start / entry
6. Summarize in structured Markdown report

## Fallback
If Ghidra MCP is not connected: tell the user to start Ghidra and load the binary,
or proceed with Bash-only analysis (file, strings, readelf/objdump).
