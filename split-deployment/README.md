# SameWindow Split Deployment

[中文说明](README.zh-CN.md)

Run the **browser half** of SameWindow on the machine next to you; leave the
**agent half** on your remote server. An SSH reverse tunnel stitches them
together.

Built with gratitude on top of [SameWindow](https://github.com/Yinglianchun/SameWindow)
by 小雨 × Haven — the shared window itself, the semantic snapshots, the two
cursors meeting on one page: all theirs. This directory only changes *where*
the window lives.

## Why

SameWindow's default layout runs everything on a VPS, and you watch the screen
remotely. That is perfect when the VPS is close to you. It falls apart when it
isn't: VNC pushes *frames* across the wire and every frame needs a round trip,
so at 300 ms RTT the shared desktop becomes a slideshow at exactly the moment
you wanted to browse together.

The fix is to notice the two halves have opposite needs:

- **The screen** is heavy traffic and belongs *next to the human* — localhost,
  zero latency, immune to evening congestion.
- **The agent's commands** are a few hundred bytes of CDP calls and don't care
  about 300 ms — they can cross an ocean.

```
Your machine (laptop / home box)              Remote server
┌────────────────────────────────┐            ┌──────────────────────────┐
│ docker: Xvfb → Chromium(CDP)   │  ssh -R    │ agent (MCP client)       │
│   x11vnc → noVNC :6080 ────────┼── tunnel ──┤   SAMEWINDOW_CONTROL_URL │
│   control server :6081 ────────┼─→ :16081   │   = http://127.0.0.1:16081│
└──────────────┬─────────────────┘            └──────────────────────────┘
               │ localhost (zero latency)
        your browser: http://127.0.0.1:6080/samewindow.html
```

Everything you love survives the split: both cursors, the click ripples, the
browse-together toggle, the sensitive-page guard.

## Quick start

Prereqs: Docker (Desktop or OrbStack on macOS — Apple Silicon works, the image
uses Debian's arm64-native Chromium), and SSH key access to your server.

```bash
git clone https://github.com/ElianeClair/SameWindow.git
cd SameWindow/split-deployment
docker compose up -d --build          # first build takes a few minutes
```

Open <http://127.0.0.1:6080/samewindow.html> — the shared desktop, at your
screen's own frame rate.

Then hand the control API to your server:

```bash
# edit SERVER= and PORT= in tunnel.sh first
chmod +x tunnel.sh && ./tunnel.sh     # silence = working; keep it running
```

On the server, point your agent at the tunnel instead of a local instance:

```bash
SAMEWINDOW_CONTROL_URL=http://127.0.0.1:16081  # env for mcp_server.py
```

Everything else in the upstream MCP setup is unchanged. For autostart of the
tunnel on macOS see `launchd.example.plist`; on Linux use autossh or a systemd
user unit.

## Privacy exit (optional)

With the browser at your home, websites would see your home IP — in the
original layout they saw the server's. To keep that property, `tunnel.sh`
also opens a local SOCKS (`-D 1080`); uncomment `SAMEWINDOW_PROXY` in
`docker-compose.yml` and page traffic egresses from your server again.
DNS is forced through the proxy (bare socks5 leaks it) and WebRTC is barred
from bypassing it. The screen never touches the proxy — it stays local.

Note: with the proxy enabled, pages load only while the tunnel is up.

## Hardening

The tunnel key only needs port forwarding. On the server, restrict it in
`~/.ssh/authorized_keys`:

```
restrict,port-forwarding,permitlisten="16081" ssh-ed25519 AAAA... you@machine
```

A stolen laptop key then opens no shell. All container ports bind to
127.0.0.1 on both machines; nothing faces the network.

## Troubleshooting

- **Chromium loops with "profile in use by another computer"** — a stale
  singleton lock from an unclean shutdown. The container clears it on start
  automatically; if you hit it in other setups: delete `Singleton*` from the
  profile directory.
- **Pages won't load but the desktop renders** — proxy is enabled and the
  tunnel isn't up. Start `tunnel.sh` (or comment out `SAMEWINDOW_PROXY`).
- **Laptop lid closed = desktop asleep** — the tunnel drops and reconnects on
  wake; the agent's probes fail gracefully in between. This is by design.
- **Verify the mask**: open `ipify.org` inside the shared browser — it should
  print your server's IP, not your home IP.

## Credits & license

- SameWindow — 小雨 × Haven ([official repository](https://github.com/Yinglianchun/SameWindow)).
  Please share the original project by linking there.
- Split deployment & docs: Fable 5
- License: same as upstream — [SameWindow Noncommercial Share-Alike License 1.0](../LICENSE).
