"""Differences between Linux and Windows for the browser tests.

- Browser: on Windows it uses the installed Microsoft Edge (channel 'msedge'), without downloading Playwright's
  Chromium. MELINA_E2E_CHANNEL switches the channel (e.g. 'chrome'); MELINA_E2E_CHANNEL=bundled uses Playwright's
  Chromium. On Linux it keeps the previous behavior (google-chrome, if present).
- Node: MELINA_NODE picks the executable (e.g. runtime\\node.exe, the same one as iniciar.bat); default 'node'.
- Console output in UTF-8 (the Windows console may be in cp1252 and break on ✔ and accents).
"""
import os, shutil, signal, subprocess, sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding='utf-8')
    except Exception:
        pass

IS_WINDOWS = os.name == 'nt'


def node_exe():
    return os.environ.get('MELINA_NODE', 'node')


def popen_kwargs():
    """A process group of its own, to stop the server without hitting the script."""
    if IS_WINDOWS:
        return {'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP}
    return {'start_new_session': True}


def stop_process(p):
    if p.poll() is not None:
        return
    if IS_WINDOWS:
        p.terminate()
    else:
        os.killpg(p.pid, signal.SIGTERM)
    try:
        p.wait(timeout=10)
    except subprocess.TimeoutExpired:
        p.kill()
        p.wait(timeout=5)


# The tests NEVER make noise: the app speaks with the Windows voice (speechSynthesis), which plays on the
# speakers even with the browser hidden. On every page: the app starts with sound off
# (same key as the speaker button), speech becomes a no-op and the browser starts with --mute-audio.
SILENCE_SCRIPT = """
try { localStorage.setItem('melina.muted', '1'); } catch (e) {}
try {
  if (window.speechSynthesis) {
    window.speechSynthesis.speak = function () {};
  }
} catch (e) {}
"""


def _silence(browser):
    orig_page, orig_ctx = browser.new_page, browser.new_context

    def new_context(*a, **k):
        ctx = orig_ctx(*a, **k)
        ctx.add_init_script(SILENCE_SCRIPT)
        return ctx

    def new_page(*a, **k):
        page = orig_page(*a, **k)
        page.context.add_init_script(SILENCE_SCRIPT)
        return page

    browser.new_context, browser.new_page = new_context, new_page
    return browser


def launch_browser(pw, **kw):
    """Opens the test browser, always muted."""
    kw['args'] = list(kw.get('args') or []) + ['--mute-audio']
    channel = os.environ.get('MELINA_E2E_CHANNEL', 'msedge' if IS_WINDOWS else '')
    if channel and channel != 'bundled':
        return _silence(pw.chromium.launch(channel=channel, **kw))
    if not IS_WINDOWS and channel != 'bundled':
        kw['args'].append('--no-sandbox')
        return _silence(pw.chromium.launch(executable_path=shutil.which('google-chrome') or None, **kw))
    return _silence(pw.chromium.launch(**kw))


FONT_CANDIDATES = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    r'C:\Windows\Fonts\arial.ttf',
    r'C:\Windows\Fonts\segoeui.ttf',
]
