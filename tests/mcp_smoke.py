#!/usr/bin/env python3

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


ROOT = Path(__file__).resolve().parent.parent


async def main() -> None:
    parameters = StdioServerParameters(
        command=sys.executable,
        args=[str(ROOT / "src" / "mcp_server.py"), "--transport", "stdio"],
        cwd=str(ROOT),
    )
    async with stdio_client(parameters) as (reader, writer):
        async with ClientSession(reader, writer) as session:
            await session.initialize()
            result = await session.list_tools()

    names = {tool.name for tool in result.tools}
    expected = {
        "shared_browser_lifecycle_status",
        "shared_browser_snapshot",
        "shared_browser_screenshot",
        "shared_browser_click",
        "shared_browser_watch_set",
    }
    missing = expected - names
    if missing:
        raise SystemExit(f"MCP smoke test is missing tools: {sorted(missing)}")
    print(f"MCP handshake passed with {len(names)} tools.")


if __name__ == "__main__":
    asyncio.run(main())
