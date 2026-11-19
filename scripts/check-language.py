"""
Language guard: the repository is English-only (code comments, docs, tests, notes, commit messages).
The app's child- and parent-facing text stays French (fr-CA); this guard only looks for PORTUGUESE.

A line is flagged when it has Portuguese-only letters/endings (ã, õ, -ção, -ções) or at least two
Portuguese-only words. French shares many words with Portuguese, so the word list avoids them.

Usage:
  python scripts/check-language.py --all        # every tracked text file (report)
  python scripts/check-language.py --staged     # lines being committed (used by .githooks/pre-commit)
  python scripts/check-language.py --message F  # a commit message file (used by .githooks/commit-msg)
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True, check=True).stdout.strip())

STRONG = re.compile(r'[ãõÃÕ]|ç[ãõ]o|ções\b|\bnão\b', re.I)
WORDS = {
    'também', 'você', 'vocês', 'está', 'estão', 'então', 'porque', 'isso', 'esse', 'essa', 'isto', 'aqui', 'depois',
    'ainda', 'sempre', 'nunca', 'muito', 'muita', 'pouco', 'sem', 'para', 'pela', 'pelo', 'pelos', 'pelas', 'uma',
    'umas', 'já', 'só', 'até', 'quando', 'onde', 'cada', 'criança', 'resposta', 'respostas', 'rodada', 'rodadas',
    'nível', 'níveis', 'acerto', 'acertos', 'erro', 'erros', 'dica', 'dicas', 'jogo', 'jogos', 'teste', 'testes',
    'ela', 'ele', 'eles', 'elas', 'dela', 'dele', 'deve', 'pode', 'fica', 'ficam', 'agora', 'porém', 'mas', 'num',
    'numa', 'nos', 'das', 'dos', 'em', 'é', 'ou', 'quer', 'tem', 'têm', 'foi', 'ser', 'são', 'vez', 'vezes', 'senão',
    'antes', 'mesmo', 'mesma', 'outra', 'outro', 'certo', 'errado', 'aparece', 'conta', 'contam', 'volta', 'tela',
    'pasta', 'arquivo', 'arquivos', 'banco', 'servidor', 'pergunta', 'perguntas', 'semana', 'dia', 'dias', 'hoje',
    'pais', 'filho', 'filha', 'menina', 'etapa', 'missão', 'semente', 'flor', 'jardim', 'competência', 'etiqueta',
}
# 'nos', 'des', 'sur', 'mais', 'que', 'pas', 'tu' etc. are French too: they only count with another Portuguese word
WORD = re.compile(r"[a-zà-ÿ]+", re.I)

SKIP = re.compile(r'^(scripts/check-language\.py$|apps/[^/]+/dist/|content/|tests/fixtures/|pnpm-lock\.yaml$|.*\.(png|jpe?g|webp|gif|ico|woff2?|mp4|webm|wav|mp3|pdf|bundle)$)')
# French UI text that legitimately contains words from the list (e.g. French 'ou' = 'or')
FRENCH_FILES = re.compile(r'^(packages/shared/src/i18n\.ts)$')


def flagged(line: str) -> bool:
    if STRONG.search(line):
        return True
    words = {w.lower() for w in WORD.findall(line)}
    hits = words & WORDS
    # 'ou', 'em', 'é', 'nos', 'das', 'dos' alone are ambiguous (French/English); require 2 Portuguese words
    return len(hits) >= 2 and not hits <= {'ou', 'nos', 'des', 'em', 'é'}


def git(*args: str) -> str:
    return subprocess.run(['git', *args], capture_output=True, text=True, encoding='utf-8', errors='replace', cwd=ROOT).stdout


def scan_all() -> list[str]:
    out: list[str] = []
    for path in git('ls-files').splitlines():
        if SKIP.match(path) or FRENCH_FILES.match(path):
            continue
        try:
            text = (ROOT / path).read_text(encoding='utf-8')
        except (UnicodeDecodeError, OSError):
            continue
        for i, line in enumerate(text.splitlines(), 1):
            if flagged(line):
                out.append(f'{path}:{i}: {line.strip()[:110]}')
    return out


def scan_staged() -> list[str]:
    out: list[str] = []
    current = '?'
    line_no = 0
    for raw in git('diff', '--cached', '-U0', '--no-color', '--diff-filter=ACMR').splitlines():
        if raw.startswith('+++ '):
            current = raw[6:] if raw.startswith('+++ b/') else raw[4:]
            continue
        m = re.match(r'@@ -\d+(?:,\d+)? \+(\d+)', raw)
        if m:
            line_no = int(m.group(1)) - 1
            continue
        if raw.startswith('+') and not raw.startswith('+++'):
            line_no += 1
            if SKIP.match(current) or FRENCH_FILES.match(current):
                continue
            if flagged(raw[1:]):
                out.append(f'{current}:{line_no}: {raw[1:].strip()[:110]}')
    return out


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, ValueError):
        pass
    mode = sys.argv[1] if len(sys.argv) > 1 else '--staged'
    if mode == '--all':
        found = scan_all()
    elif mode == '--staged':
        found = scan_staged()
    elif mode == '--message' and len(sys.argv) > 2:
        lines = Path(sys.argv[2]).read_text(encoding='utf-8', errors='replace').splitlines()
        found = [f'commit message:{i}: {l[:110]}' for i, l in enumerate(lines, 1) if not l.startswith('#') and flagged(l)]
    else:
        print(__doc__)
        return 2
    if found:
        print(f'\n[language guard] BLOCKED: {len(found)} line(s) look Portuguese. The repository is English-only.\n')
        for f in found[:40]:
            print('  -', f)
        if len(found) > 40:
            print(f'  ... and {len(found) - 40} more')
        print()
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
