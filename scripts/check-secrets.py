"""
Secret guard for Git (guardian's request, 18/11/2026: never push passwords or API keys).

Runs by itself before every commit (--staged) and every push to GitHub (--push), through the hooks in .githooks/.
Blocks when the incoming changes contain:
  1. files that must never be committed: .env, ClaudeAPIKey.txt, data/ (Melina's real progress), databases, the
     server lock, backup copies, loose school tests in the repository root (PDFs and images);
  2. known key formats (Anthropic, OpenAI, GitHub, Google, AWS, Slack, private keys);
  3. "password/api_key/token = '...'" with a value that looks real;
  4. any secret VALUE currently in .env or ClaudeAPIKey.txt (compared in memory; never printed).
Messages name the file and line, never the value found.
Manual use: python scripts/check-secrets.py --staged | --push | --all
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True, check=True).stdout.strip())

FORBIDDEN_PATHS = [
    (re.compile(r'(^|/)\.env(\.[^/]*)?$'), '.env file (keys)'),
    (re.compile(r'(^|/)ClaudeAPIKey[^/]*$', re.I), 'API key file'),
    (re.compile(r'^data/'), "data/ folder (Melina's real progress)"),
    (re.compile(r'^copias-seguranca/'), 'backup copies'),
    (re.compile(r'\.(db|sqlite|sqlite3)(-wal|-shm)?$', re.I), 'database'),
    (re.compile(r'(^|/)melina\.lock$'), 'server lock file'),
    (re.compile(r'^[^/]+\.(pdf|jpe?g|png|webp|heic|gif|bmp|tiff?)$', re.I), 'loose school test in the repository root'),
]
ALLOWED_PATHS = [re.compile(r'(^|/)\.env\.example$')]

KEY_PATTERNS = [
    (re.compile(r'sk-ant-[A-Za-z0-9_-]{20,}'), 'an Anthropic key'),
    (re.compile(r'sk-(proj|svcacct|admin)-[A-Za-z0-9_-]{20,}'), 'an OpenAI key'),
    (re.compile(r'\bsk-[A-Za-z0-9]{32,}'), 'a secret key (sk-...)'),
    (re.compile(r'\bgh[pousr]_[A-Za-z0-9]{30,}'), 'a GitHub token'),
    (re.compile(r'\bgithub_pat_[A-Za-z0-9_]{40,}'), 'a GitHub token'),
    (re.compile(r'\bAIza[0-9A-Za-z_-]{35}'), 'a Google key'),
    (re.compile(r'\bAKIA[0-9A-Z]{16}\b'), 'an AWS key'),
    (re.compile(r'\bxox[abpr]-[A-Za-z0-9-]{10,}'), 'a Slack token'),
    (re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----'), 'a private key'),
]
# Names for passwords and keys in English, French and Portuguese (the family's languages)
ASSIGN = re.compile(r'(password|passwd|pwd|senha|mot[_ -]?de[_ -]?passe|api[_-]?key|secret|token)\s*["\']?\s*[:=]\s*["\']([^"\'\s]{10,})["\']', re.I)
SECRET_NAME = re.compile(r'key|token|secret|pass|pwd|senha|auth|credential', re.I)
# Obvious placeholders and test values (also in French and Portuguese)
PLACEHOLDER = re.compile(r'test|exemple|example|exemplo|xxx|dummy|fake|placeholder|changeme|your|sua|votre|<|\$\{|process\.env', re.I)


def secret_values() -> list[tuple[str, str]]:
    """(label, value) pairs from .env and ClaudeAPIKey.txt. Values stay in this process's memory only."""
    files = os.environ.get('MELINA_SECRETS_FILES')
    paths = [Path(p) for p in files.split(';')] if files else [ROOT / '.env', ROOT / 'ClaudeAPIKey.txt']
    out: list[tuple[str, str]] = []
    for p in paths:
        try:
            text = p.read_text(encoding='utf-8', errors='ignore')
        except OSError:
            continue
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            name, value = (line.split('=', 1) + [''])[:2] if '=' in line else (p.name, line)
            value = value.strip().strip('"').strip("'")
            # only secrets (key, token, password); model names, ports etc. are public configuration
            secret_name = '=' not in line or SECRET_NAME.search(name)
            if secret_name and len(value) >= 12 and value.lower() not in ('true', 'false'):
                out.append((f'value of {name.strip()} from {p.name}', value))
    return out


def git(*args: str, stdin: str | None = None) -> str:
    return subprocess.run(['git', *args], capture_output=True, text=True, encoding='utf-8', errors='replace', input=stdin, cwd=ROOT).stdout


def scan_patch(patch: str, problems: list[str], values: list[tuple[str, str]]) -> None:
    """Looks only at the ADDED lines of a diff."""
    current = '?'
    line_no = 0
    for raw in patch.splitlines():
        if raw.startswith('+++ '):
            current = raw[6:] if raw.startswith('+++ b/') else raw[4:]
            continue
        m = re.match(r'@@ -\d+(?:,\d+)? \+(\d+)', raw)
        if m:
            line_no = int(m.group(1)) - 1
            continue
        if raw.startswith('+') and not raw.startswith('+++'):
            line_no += 1
            text = raw[1:]
            where = f'{current}:{line_no}'
            for pat, what in KEY_PATTERNS:
                if pat.search(text):
                    problems.append(f'{where}: looks like {what}')
            for am in ASSIGN.finditer(text):
                if not PLACEHOLDER.search(am.group(2)):
                    problems.append(f'{where}: "{am.group(1)} = ..." with a value that looks real')
            for label, value in values:
                if value in text:
                    problems.append(f'{where}: contains the {label}')
        elif not raw.startswith('-'):
            line_no += 1


def check_paths(paths: list[str], problems: list[str]) -> None:
    for p in paths:
        p = p.strip().replace('\\', '/')
        if not p or any(a.search(p) for a in ALLOWED_PATHS):
            continue
        for pat, what in FORBIDDEN_PATHS:
            if pat.search(p):
                problems.append(f'{p}: {what} must not be committed')


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # correct accents in the terminal
    except (AttributeError, ValueError):
        pass
    mode = sys.argv[1] if len(sys.argv) > 1 else '--staged'
    problems: list[str] = []
    values = secret_values()
    if mode == '--staged':
        check_paths(git('diff', '--cached', '--name-only', '--diff-filter=ACMR').splitlines(), problems)
        scan_patch(git('diff', '--cached', '-U0', '--no-color', '--diff-filter=ACMR'), problems, values)
    elif mode == '--push':
        # hook stdin: <local ref> <local sha> <remote ref> <remote sha>
        for line in sys.stdin.read().splitlines():
            parts = line.split()
            if len(parts) < 4 or set(parts[1]) == {'0'}:
                continue
            local, remote = parts[1], parts[3]
            known_remote = set(remote) != {'0'} and git('cat-file', '-t', remote).strip() == 'commit'
            rng = [f'{remote}..{local}'] if known_remote else [local, '--not', '--remotes']
            commits = git('rev-list', *rng).split()
            for c in commits:
                check_paths(git('diff-tree', '--no-commit-id', '--name-only', '-r', '--root', '--diff-filter=ACMR', c).splitlines(), problems)
                scan_patch(git('show', '--format=', '-U0', '--no-color', '--diff-filter=ACMR', c), problems, values)
    elif mode == '--all':
        check_paths(git('ls-files').splitlines(), problems)
        scan_patch(git('log', '--all', '-p', '-U0', '--no-color', '--format='), problems, values)
    else:
        print(__doc__)
        return 2
    if problems:
        print('\n[secret guard] BLOCKED: something looks like a password or a key.\n')
        for p in sorted(set(problems))[:30]:
            print('  -', p)
        print('\nRemove it from the commit (the value is never shown here). Keys live only in .env.\n')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
