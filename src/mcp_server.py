#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from typing import Any

from mcp.server.fastmcp import FastMCP
from mcp.types import ToolAnnotations


CONTROL_URL = os.getenv("SAMEWINDOW_CONTROL_URL", "http://127.0.0.1:6081").rstrip("/")
LIFECYCLE_URL = os.getenv("SAMEWINDOW_LIFECYCLE_URL", "http://127.0.0.1:6082").rstrip("/")
MCP_HOST = os.getenv("SAMEWINDOW_MCP_HOST", "127.0.0.1")
MCP_PORT = int(os.getenv("SAMEWINDOW_MCP_PORT", "6083"))
ENABLE_BROWSE_TOGETHER_MCP = os.getenv(
    "SAMEWINDOW_ENABLE_BROWSE_TOGETHER_MCP",
    "0",
).strip().lower() in {"1", "true", "yes", "on"}

READ_ONLY = ToolAnnotations(
    readOnlyHint=True,
    destructiveHint=False,
    idempotentHint=True,
    openWorldHint=True,
)
WRITE_ACTION = ToolAnnotations(
    readOnlyHint=False,
    destructiveHint=False,
    idempotentHint=False,
    openWorldHint=True,
)
STATE_ACTION = ToolAnnotations(
    readOnlyHint=False,
    destructiveHint=False,
    idempotentHint=True,
    openWorldHint=True,
)
CLOSE_ACTION = ToolAnnotations(
    readOnlyHint=False,
    destructiveHint=True,
    idempotentHint=False,
    openWorldHint=True,
)

mcp = FastMCP(
    "SameWindow",
    instructions=(
        "Control one browser shared visibly with the user. Check lifecycle status when it may be asleep. "
        "Take a fresh snapshot before ref-based actions and refresh after navigation or major DOM changes. "
        "Never request or enter passwords, one-time codes, recovery codes, payment data, or other secrets. "
        "Sensitive pages are intentionally blocked from agent automation; ask the user to complete them in the viewer."
    ),
    host=MCP_HOST,
    port=MCP_PORT,
    streamable_http_path="/mcp",
    stateless_http=True,
    json_response=True,
)


def _json_request(
    base_url: str,
    path: str,
    *,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    lifecycle: bool = False,
    timeout: float = 25.0,
) -> dict[str, Any]:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    if lifecycle:
        headers["X-SameWindow-Lifecycle"] = "1"
    request = urllib.request.Request(
        f"{base_url}{path}",
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"SameWindow request failed ({error.code}): {detail}") from error
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise RuntimeError(f"SameWindow is unavailable: {error}") from error
    if not isinstance(result, dict):
        raise RuntimeError("SameWindow returned a non-object response")
    if result.get("ok") is False:
        raise RuntimeError(str(result.get("error") or "SameWindow request failed"))
    return result


def _control(path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    return _json_request(
        CONTROL_URL,
        path,
        method="POST" if payload is not None else "GET",
        payload=payload,
    )


@mcp.tool(annotations=READ_ONLY)
def shared_browser_lifecycle_status() -> dict[str, Any]:
    """Return whether the shared browser services are stopped, starting, or ready."""
    return _json_request(LIFECYCLE_URL, "/api/status")


@mcp.tool(annotations=STATE_ACTION)
def shared_browser_lifecycle_start() -> dict[str, Any]:
    """Start the shared display, Chrome, noVNC viewer, and control service."""
    return _json_request(
        LIFECYCLE_URL,
        "/api/start",
        method="POST",
        payload={},
        lifecycle=True,
        timeout=40,
    )


@mcp.tool(annotations=STATE_ACTION)
def shared_browser_lifecycle_stop() -> dict[str, Any]:
    """Stop the heavy shared-browser services while preserving the Chrome profile."""
    return _json_request(
        LIFECYCLE_URL,
        "/api/stop",
        method="POST",
        payload={},
        lifecycle=True,
        timeout=40,
    )


@mcp.tool(annotations=READ_ONLY)
def shared_browser_status() -> dict[str, Any]:
    """Return the control connection and currently selected tab summary."""
    return _control("/browser/status")


@mcp.tool(annotations=READ_ONLY)
def shared_browser_tabs() -> dict[str, Any]:
    """List the tabs open in the shared Chrome with temporary tab references."""
    return _control("/browser/tabs")


@mcp.tool(annotations=WRITE_ACTION)
def shared_browser_open(url: str, new_tab: bool = True, tab_ref: str = "") -> dict[str, Any]:
    """Open an HTTP(S) URL in a new tab or replace the referenced tab."""
    return _control(
        "/browser/open",
        {"url": url, "newTab": new_tab, "tabRef": tab_ref},
    )


@mcp.tool(annotations=STATE_ACTION)
def shared_browser_select(tab_ref: str) -> dict[str, Any]:
    """Bring one shared-browser tab to the visible foreground."""
    return _control("/browser/select", {"tabRef": tab_ref})


@mcp.tool(annotations=CLOSE_ACTION)
def shared_browser_close(tab_ref: str) -> dict[str, Any]:
    """Close a tab, refusing to close the final shared-browser tab."""
    return _control("/browser/close", {"tabRef": tab_ref})


@mcp.tool(annotations=READ_ONLY)
def shared_browser_snapshot(
    tab_ref: str = "",
    limit: int = 50,
    include_pointer_extras: bool = False,
) -> dict[str, Any]:
    """Read visible text and interactive elements from the foreground or referenced tab."""
    return _control(
        "/browser/snapshot",
        {
            "tabRef": tab_ref,
            "limit": limit,
            "includePointerExtras": include_pointer_extras,
        },
    )


@mcp.tool(annotations=WRITE_ACTION)
def shared_browser_click(
    tab_ref: str,
    ref: str,
    wait_after_ms: int = 0,
) -> dict[str, Any]:
    """Click an element reference from the most recent snapshot."""
    return _control(
        "/browser/click",
        {"tabRef": tab_ref, "ref": ref, "waitAfterMs": wait_after_ms},
    )


@mcp.tool(annotations=WRITE_ACTION)
def shared_browser_type(
    tab_ref: str,
    ref: str,
    text: str,
    clear: bool = True,
    submit: bool = False,
) -> dict[str, Any]:
    """Type non-sensitive text into an element reference from the latest snapshot."""
    return _control(
        "/browser/type",
        {
            "tabRef": tab_ref,
            "ref": ref,
            "text": text,
            "clear": clear,
            "submit": submit,
        },
    )


@mcp.tool(annotations=WRITE_ACTION)
def shared_browser_press(tab_ref: str, key: str, wait_after_ms: int = 0) -> dict[str, Any]:
    """Press a keyboard key or shortcut in the referenced tab."""
    return _control(
        "/browser/press",
        {"tabRef": tab_ref, "key": key, "waitAfterMs": wait_after_ms},
    )


if ENABLE_BROWSE_TOGETHER_MCP:

    @mcp.tool(annotations=READ_ONLY)
    def shared_browser_watch_status() -> dict[str, Any]:
        """Return whether the person enabled browse-together observation in the viewer."""
        return _control("/browser/watch")


    @mcp.tool(annotations=READ_ONLY)
    def shared_browser_events(after: int = 0, limit: int = 20) -> dict[str, Any]:
        """Read queued opt-in semantic events after a sequence number."""
        return _control(f"/browser/events?after={max(0, after)}&limit={max(1, min(50, limit))}")


def main() -> None:
    parser = argparse.ArgumentParser(description="SameWindow MCP server")
    parser.add_argument(
        "--transport",
        choices=("stdio", "streamable-http"),
        default=os.getenv("SAMEWINDOW_MCP_TRANSPORT", "stdio"),
    )
    args = parser.parse_args()
    mcp.run(transport=args.transport)


if __name__ == "__main__":
    main()
