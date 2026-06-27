---
name: deep-decompilation
description: Deep analysis of specific functions using Ghidra decompilation, cross-references, data flow tracing, and vulnerability identification. Use when the user asks for a focused deep dive on one or more functions.
---
# Deep Decompilation Skill

Perform deep analysis of the target function(s) in the provided binary.

## Workflow for each target function

1. **Decompile**
   - `mcp__ghidra__decompile_function` by name, or
   - `mcp__ghidra__decompile_function_by_address` if only an address is given

2. **Cross-references**
   - `mcp__ghidra__get_xrefs_to <function>` — who calls this function?
   - `mcp__ghidra__get_xrefs_from <function>` — what does this function call?

3. **Assembly (when decompilation is unclear)**
   - `mcp__ghidra__disassemble_function` for raw assembly

4. **Rename and annotate**
   - As you understand variables and sub-functions, rename them immediately:
     `mcp__ghidra__rename_function`, `mcp__ghidra__rename_variable`
   - Add comments with `mcp__ghidra__set_comment` for key logic

5. **Follow call graph**
   - Recursively analyze callees if they are relevant to understanding the target

## Vulnerability patterns to check

- Buffer overflow: strcpy, gets, sprintf, memcpy without bounds check
- Format string: printf/fprintf called with user-controlled first argument
- Integer overflow: size calculations before malloc
- Use-after-free: free() followed by dereference
- Command injection: system(), popen() with user input
- Crypto weakness: hardcoded keys, ECB mode, MD5/SHA1 for security

## Output

Return a detailed Markdown report per function:
- Purpose and behavior
- Input/output parameters
- Call graph summary (callers and callees)
- Decompiled pseudocode (abbreviated to key logic)
- Vulnerabilities found with line references
- Renamed symbols list
