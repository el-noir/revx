---
name: static-analysis
description: Deep static reverse engineering across multiple functions, call graphs, data flow, capabilities, and suspicious behavior without executing the artifact.
---
# Static Analysis

1. Verify the absolute artifact path and collect format, architecture, hashes, sections, imports, and strings.
2. Identify entry points, exported functions, suspicious imports, validation paths, and high-value strings.
3. Use Ghidra to decompile relevant functions and follow callers, callees, and data references.
4. Rename symbols and annotate only when evidence supports the interpretation.
5. Correlate every conclusion with an address, symbol, string, import, or command result.
6. Never execute the artifact. Recommend dynamic analysis when behavior cannot be established statically.

Report verified findings, function relationships, capability assessment, uncertainty, and next steps.
