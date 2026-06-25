---
name: reverse-triage
description: Fast binary triage for reverse engineering and CTF: file type, architecture, strings, imports/exports, and entry point. Works with or without Ghidra. Use when a binary or challenge file is provided for initial assessment.
---
# Reverse Triage Skill

Perform rapid initial assessment of the provided binary or challenge file.

## Step 1 — Bash-first (always runs, even without Ghidra)

Run these regardless of Ghidra availability:
1. `file <binary>` — identify format, architecture, and packer indicators
2. `strings -n 8 <binary> | head -200` — surface URLs, IPs, file paths, keys, flags
3. If ELF: `readelf -h <binary> && readelf -d <binary> | head -40`
4. If PE: `objdump -x <binary> | head -60`
5. Search for flag patterns: `strings <binary> | grep -iE 'flag\{|ctf\{|key\{'`

## Step 2 — Ghidra MCP (if server is connected)

Only proceed if mcp__ghidra__* tools are available:
1. `mcp__ghidra__list_imports` (limit: 200) — categorize by capability
2. `mcp__ghidra__list_exports` (limit: 200)
3. `mcp__ghidra__list_strings` (limit: 2000) — cross-reference with Bash strings output
4. `mcp__ghidra__list_functions` — get overview of identified functions
5. `mcp__ghidra__decompile_function` on main / _start / entry point

## Capability categorization

Group imports by category:
- Network: connect, send, recv, WSAStartup, getaddrinfo
- Crypto: CryptEncrypt, EVP_*, bcrypt, AES
- Process injection: CreateRemoteThread, VirtualAllocEx, WriteProcessMemory
- Anti-debug: IsDebuggerPresent, CheckRemoteDebuggerPresent, NtQueryInformationProcess
- Persistence: RegSetValueEx, CreateService, schtasks
- File ops: CreateFile, ReadFile, WriteFile, fopen

## Output

Return a concise Markdown triage report:
- File metadata (format, arch, bits, size)
- Key strings found
- Capability summary from imports
- Entry point / main function summary (if decompiled)
- Suspicious indicators
- Recommended next steps (which functions to deep-dive)
