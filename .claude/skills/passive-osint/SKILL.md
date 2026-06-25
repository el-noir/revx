---
name: passive-osint
description: Passive public-source research for hashes, domains, IP addresses, certificates, malware families, and related indicators.
---
# Passive OSINT

1. Normalize each supplied indicator before searching.
2. Use public search and fetch operations only; do not scan, probe, authenticate, or submit samples.
3. Prefer primary sources and reputable security vendors.
4. Record source URL, publication or observation date, and the exact indicator matched.
5. Separate sourced facts, correlations, and analyst inference.
6. Require multiple independent signals before suggesting attribution.
7. Flag stale, conflicting, or low-confidence information.

Return an indicator table, sourced findings, confidence assessment, and actionable correlations.
