# SameWindow

**One browser. Two sets of hands.**

SameWindow runs a persistent Chrome on a Linux host and lets a person and an AI
agent use that exact browser together. The person sees and controls it through
noVNC; the agent reads semantic snapshots and acts through small MCP tools.
Both sides share the same tabs, history, focus, and authenticated browser
profile.

SameWindow is the public shared-browser core only. It does not include a chat
client, personal assistant prompts, private APIs, or any accounts.

## What it includes

- A visible Chrome desktop: Xvfb → Openbox → Chrome → x11vnc → noVNC
- A Playwright/CDP control service with tab, snapshot, click, type, key, cursor,
  and screenshot operations
- A Python MCP façade for agent clients
- A small start/stop dashboard so the heavy browser stack can sleep
- Optional “Browse together” semantic events for deliberate clicks, dwell,
  stable page text, and near-pointer moments
- A persistent, dedicated Chrome profile

```text
Person ── SSH tunnel ── noVNC ───────┐
                                     ├── the same Chrome profile
Agent  ── MCP ──────── Playwright ───┘
```

## Safety model

All services bind to `127.0.0.1` by default. SameWindow intentionally has no
Internet-facing authentication layer: use SSH forwarding or another
authenticated private transport and never expose ports `6080`–`6083` publicly.

The agent cannot access cookies, browser storage, arbitrary JavaScript
evaluation, or arbitrary CSS selectors through the public tools. Actions use
temporary references from a fresh snapshot. Login, password, one-time-code,
identity, checkout, and payment pages are blocked from snapshots, screenshots,
and actions by default.

Screenshots are PNG bytes returned once as an MCP image. Internally they cross
the local JSON boundary as base64 because JSON cannot carry raw binary; the MCP
server immediately decodes them. They are not written to disk, so there is
nothing to delete after 24 hours.

See [SECURITY.md](SECURITY.md) before deploying.

## Requirements

A small Ubuntu 22.04/24.04 server with:

- Node.js 20+
- Python 3.10+
- Google Chrome or Chromium
- `xvfb`, `openbox`, `x11vnc`, `novnc`, `websockify`, `dbus-x11`, and
  `python3-venv`

For example:

```bash
sudo apt update
sudo apt install -y xvfb openbox x11vnc novnc websockify dbus-x11 python3-venv
```

Install Node.js 20+ and Chrome using their official packages. If the Chrome
binary is not `/usr/bin/google-chrome-stable`, change
`SAMEWINDOW_CHROME_BIN` in `.env.example` before installation or in
`/etc/samewindow.env` afterward.

## Install

```bash
git clone https://github.com/Yinglianchun/SameWindow.git
cd SameWindow
sudo ./scripts/install-ubuntu.sh
```

The installer creates:

- application files in `/opt/samewindow`
- the browser profile and noVNC state in `/var/lib/samewindow`
- configuration in `/etc/samewindow.env`
- systemd units named `samewindow-*`

It starts only the lightweight lifecycle dashboard. The browser itself starts
when you press **Start** or call `shared_browser_lifecycle_start`.

## Open the shared window

Forward the three viewer/control ports from your computer:

```bash
ssh -N \
  -L 6080:127.0.0.1:6080 \
  -L 6081:127.0.0.1:6081 \
  -L 6082:127.0.0.1:6082 \
  your-user@your-server
```

Then open <http://127.0.0.1:6082>. The dashboard starts and stops the shared
browser without deleting its profile.

## Connect an MCP client

The simplest remote setup uses MCP over SSH stdio, so no MCP port needs to be
opened:

```json
{
  "mcpServers": {
    "samewindow": {
      "command": "ssh",
      "args": [
        "-T",
        "your-user@your-server",
        "/opt/samewindow/.venv/bin/python",
        "/opt/samewindow/src/mcp_server.py",
        "--transport",
        "stdio"
      ]
    }
  }
}
```

An optional loopback-only streamable HTTP service is also installed:

```bash
sudo systemctl enable --now samewindow-mcp.service
ssh -N -L 6083:127.0.0.1:6083 your-user@your-server
```

Its endpoint is `http://127.0.0.1:6083/mcp`. It has no application-level auth;
the SSH tunnel is part of the security boundary.

## Typical agent flow

1. Check `shared_browser_lifecycle_status`; start it if needed.
2. Call `shared_browser_snapshot` on the visible tab.
3. Click or type using a returned element reference.
4. Take a new snapshot after navigation or a major page change.
5. Let the person enter secrets manually in the visible viewer.
6. Stop the browser only when the person is finished or resources should be
   released.

If no `tab_ref` is supplied, snapshots and screenshots follow the actually
focused/visible tab rather than a stale cached selection.

## Development

```bash
npm install
python -m venv .venv
.venv/bin/pip install -r requirements.txt
npm run check
python -m py_compile src/mcp_server.py
python tests/mcp_smoke.py
./scripts/check-secrets.sh
```

The Node tests start the loopback services on temporary ports; they do not need
Chrome or systemd. Full end-to-end verification requires a Linux host with the
desktop dependencies above.

## License

MIT
