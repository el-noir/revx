---
name: ctf-solving
description: End-to-end CTF challenge solving across pwn, crypto, forensics, steganography, web, and reverse engineering. Use when the user wants to find a flag in a challenge file.
---
# CTF Solving Skill

Solve the provided CTF challenge and extract the flag.

## Step 0 — Reconnaissance (always first)

```bash
file <challenge_file>
strings -n 6 <challenge_file> | grep -iE 'flag\{|ctf\{|HTB\{|picoCTF\{|[A-Z0-9_]{3,}\{'
binwalk <challenge_file>
```

## Category detection and workflows

### PWN (binary exploitation)
Indicators: ELF/PE binary + challenge mentions "exploit", "shell", "overflow", or "ROP"
1. `checksec --file=<binary>` — identify protections (NX, PIE, canary, RELRO)
2. Triage via Ghidra MCP to find the vulnerable function
3. Identify vulnerability type:
   - Buffer overflow: gets(), strcpy(), fgets() with large fixed buffer
   - Format string: printf(user_input) pattern
   - Integer overflow: size calculation before malloc/alloc
4. Calculate offset: `python3 -c "import pwn; print(pwn.cyclic(200).decode())"`
5. Write exploit to exploit.py using pwntools and run `python3 exploit.py`

### CRYPTO (cryptography)
Indicators: ciphertext file, encoded string, .enc extension
1. Identify encoding: base64, hex, base32, rot13
2. Detect cipher from patterns:
   - Letter frequency uneven → classical substitution / frequency analysis
   - Repeating blocks → ECB mode AES
   - Two large numbers (n, e) + ciphertext → RSA
   - XOR: single-byte or repeating key
3. Bruteforce single-byte XOR; try RSA small e, Wiener, common factor attacks
4. For AES/DES: look for hardcoded keys in strings

### FORENSICS
Indicators: image files, pcap, memory dumps, archives
1. `exiftool <file>` — metadata
2. `binwalk -e <file>` — extract embedded files
3. For pcap: `tshark -r capture.pcap -T fields -e data.data 2>/dev/null | xxd -r -p | strings | grep -i flag`
4. For memory dump: `strings dump.mem | grep -iE 'flag\{|ctf\{'`
5. `foremost -i <file> -o ./extracted/`

### STEGANOGRAPHY
Indicators: image, audio, challenge mentions "hidden message"
1. `strings <image> | grep -i flag`
2. `exiftool <image>`
3. `steghide extract -sf <image> -p ""`
4. `zsteg <image>` for PNG LSB
5. For WAV: `sox <file> -n spectrogram -o spec.png`

### WEB
Indicators: URL provided, .html/.php source, SQL/XSS/SSRF/RCE mentions
1. Check source comments and hidden fields
2. SQL injection: `sqlmap -u "http://..." --dbs --batch`
3. Directory fuzzing: `ffuf -u http://.../FUZZ -w /usr/share/wordlists/dirb/common.txt`
4. Command injection variants: `; cat /flag`, `$(cat /flag)`

### REVERSE ENGINEERING (source or binary)
Indicators: binary without obvious exploit path, obfuscated code, serial validation
1. Triage via Ghidra MCP tools
2. Find flag comparison / validation function (strcmp, memcmp, strncmp)
3. Trace validation logic backward from the success branch
4. Implement the inverse in Python if math-based

## Flag output

When you find the flag:
1. Print it clearly: 🚩 FLAG: flag{...}
2. Write it to a file: `echo 'flag{...}' > solution.flag`
3. Explain briefly how you found it

If no flag found after exhausting approaches, summarize what was tried and what leads remain.
