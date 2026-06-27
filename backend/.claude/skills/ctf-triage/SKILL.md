---
name: ctf-triage
description: Rapid CTF challenge triage and categorization. Use when the user mentions CTF, capture the flag, flag, pwn, exploit, cipher, steganography, forensics, or provides a challenge file to solve.
---
# CTF Triage Skill

Quickly categorize a CTF challenge and route it to the correct specialist.

## When to use
- User says "solve this CTF", "find the flag", "crack this", "exploit this"
- User provides a file with challenge context
- User mentions pwn, rev, crypto, forensics, stego, or web challenge

## Triage workflow
1. Run `file <artifact>` on every provided file
2. Run `strings -n 6 <artifact> | grep -iE 'flag\{|ctf\{|HTB\{|[A-Z]{2,}\{'` — check for instant flag
3. Run `binwalk <artifact>` — check for embedded files
4. Classify:
   - ELF/PE binary → pwn or rev
   - Image (PNG/JPG/BMP) → stego or forensics
   - Encoded text / numbers → crypto
   - PCAP / memory dump → forensics
   - URL / web source → web

5. Delegate with the absolute path, authorization, recon output, exact question, and expected response:
   - Reverse engineering or multi-function decompilation → `static_analysis`
   - Runtime debugging, tracing, or execution → `dynamic_analysis`
   - Public indicator research → `osint_analysis`
   - Pwn, vulnerability validation, or proof-of-concept construction → `exploit_dev`

The orchestrator may finish directly when reconnaissance reveals the flag or the remaining work is a simple single-step decode.

Every delegated prompt must include:
   - Absolute file path
   - Category detected
   - Full recon output (strings, file, binwalk results)
   - Challenge description if provided

## Do not
- Perform complex specialist work in the orchestrator
- Skip the recon step — it often reveals the flag directly
- Invoke Ghidra tools before basic Bash recon
