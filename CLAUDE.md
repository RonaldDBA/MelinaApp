# Le jardin de Melina — rules for Claude

A private, non-commercial educational app for Melina (7 years old, 2e année du primaire, Québec).
The whole app (child screens, parents' area, art studio and server messages) is in Canadian French, as decided
by the guardian on 17/11/2026.
**The repository is English-only** (guardian's decision, 18/11/2026): code comments, documentation, tests,
research notes and commit messages are written in English. Only the app's own text stays French.
Always reply to the guardian in **Portuguese** (in the chat; nothing in the repository).

Before changing anything, read `README.md` and the documents in `docs\`
(`architecture.md`, `visual-architecture.md`, `testing.md`, `roadmap.md`, `curriculum.md`, `privacy.md`).

## Permanent rules

1. Work only inside `C:\MelinaApp`. Do not change or delete anything outside it.
2. The loose PDFs and images in the root are Melina's school tests: do not change, move or delete them, and do
   not send them to any external service.
3. Keys live only in the `.env` file. Never show, copy to another file or log the contents of `.env` or of
   `ClaudeAPIKey.txt`.
4. No request to an external API may carry the child's name, photo or answers, except the handwriting reading,
   which already exists and depends on the consent given in the parents' area.
5. No third-party protected characters, text or art. Original content only.
6. Never say something was tested without having run the test and seen the result. Always separate "tested",
   "not tested" and "could not be tested".
7. Ask before installing programs, deleting files, and before any decision that cannot be undone.
8. The `data\` folder holds the database with Melina's real progress. Never run tests against it. Before
   migrations, the app's own automatic backup is enough: do not create extra backups (guardian's request).

9. Tests make no noise and open no windows on the guardian's screen: he uses the PC while we work.
   The test browser always goes through `tests\e2e\_platform.py` (`launch_browser`: headless, `--mute-audio`, app
   with sound off and speech disabled). Do not open the app through `iniciar.bat` (it opens Edge with sound)
   without asking first.
10. Never commit or push passwords or API keys. The guards in `.githooks/` (`scripts/check-secrets.py` and
    `scripts/check-language.py`) run before every commit and push; never bypass them with `--no-verify`.

## Development environment (installed on 17/11/2026, with permission)

- Git 2.56, Node.js 26 LTS (`C:\Program Files\nodejs`), pnpm 10 (npm global), Python 3.13 (user scope).
- Browser tests: use `.venv\Scripts\python.exe` (Playwright + Pillow, inside the project) and the installed Edge
  (`channel='msedge'`), without downloading Playwright's Chromium.
- The family's app keeps running on `runtime\node.exe` (24.22.3), which `iniciar.bat` looks for first.
- In Claude Desktop sessions PowerShell may not see the new PATH: start commands with
  `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`.
- Packages installed by this session inside `AppData` (global pnpm, `pip --user`) live in the Claude app's private
  area and may not show up in a regular Windows terminal.
- Hooks: after a fresh clone, run `git config core.hooksPath .githooks` once.

## How to work

- One commit per finished step, with a clear English message; after each finished phase (tests passing), push to
  the private GitHub repository (authorized by the guardian).
- Update `docs\testing.md` and `docs\visual-architecture.md` when something changes.
- At the end of each stage, stop and show the result to the guardian before starting the next one.
- New games follow the existing pattern: a round generator with tests in `packages\curriculum`, evaluation on the
  server, a screen on the fixed 1920×1080 stage with its scene in `content\scenes`, and a browser test.
