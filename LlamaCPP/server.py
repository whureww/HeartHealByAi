"""
Thin Python wrapper around llama.cpp's llama-server.

It boots (or attaches to) a llama-server process and re-exposes its
OpenAI-compatible endpoints on a single configurable port, so any
OpenAI client can talk to a local GGUF model.

Run:  python server.py --model path/to/model.gguf
See README.md for build + config details.
"""

from __future__ import annotations

import argparse
import contextlib
import os
import shutil
import signal
import socket
import subprocess
import sys
import time

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse


# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------

class Config:
    def __init__(self) -> None:
        self.llama_bin = os.environ.get("LLAMA_SERVER_BIN", "")
        self.model = os.environ.get("MODEL_PATH", "")
        self.host = os.environ.get("HOST", "127.0.0.1")
        self.port = int(os.environ.get("PORT", "8000"))
        # internal llama-server, kept on loopback only
        self.upstream_host = os.environ.get("UPSTREAM_HOST", "127.0.0.1")
        self.upstream_port = int(os.environ.get("UPSTREAM_PORT", "8081"))
        # if UPSTREAM_URL is set, attach to an already-running server instead
        # of spawning one
        self.upstream_url = os.environ.get("UPSTREAM_URL", "")
        # extra args forwarded verbatim to llama-server
        self.extra_args = os.environ.get("LLAMA_ARGS", "").split() if os.environ.get("LLAMA_ARGS") else []
        self.startup_timeout = int(os.environ.get("STARTUP_TIMEOUT", "120"))

    @property
    def upstream_base(self) -> str:
        if self.upstream_url:
            return self.upstream_url.rstrip("/")
        return f"http://{self.upstream_host}:{self.upstream_port}"


CFG = Config()

# Endpoints forwarded straight to llama-server. Everything under /v1 plus /health
# is OpenAI-compatible or a health probe; the proxy is transparent.
PROXY_PREFIXES = ("/v1", "/health", "/completion", "/tokenize", "/detokenize", "/props")

client: httpx.AsyncClient | None = None
proc: subprocess.Popen | None = None


# --------------------------------------------------------------------------
# llama-server lifecycle
# --------------------------------------------------------------------------

def find_llama_server() -> str:
    if CFG.llama_bin:
        if not os.path.exists(CFG.llama_bin):
            sys.exit(f"LLAMA_SERVER_BIN not found: {CFG.llama_bin}")
        return CFG.llama_bin
    found = shutil.which("llama-server")
    if not found:
        sys.exit("llama-server not found. Build llama.cpp and set LLAMA_SERVER_BIN "
                 "or put llama-server on PATH.")
    return found


def free_port(host: str, port: int) -> bool:
    with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
        return s.connect_ex((host, port)) != 0


def start_llama_server() -> subprocess.Popen:
    binary = find_llama_server()
    if not CFG.model:
        sys.exit("No model set. Pass --model or set MODEL_PATH.")
    if not os.path.exists(CFG.model):
        sys.exit(f"Model file not found: {CFG.model}")
    if not free_port(CFG.upstream_host, CFG.upstream_port):
        sys.exit(f"Internal port {CFG.upstream_port} is busy. "
                 "Set UPSTREAM_PORT or stop the process using it.")

    cmd = [
        binary,
        "--model", CFG.model,
        "--host", CFG.upstream_host,
        "--port", str(CFG.upstream_port),
        *CFG.extra_args,
    ]
    print(f"[wrapper] launching: {' '.join(cmd)}", flush=True)
    # newline-buffered so we can stream llama-server logs through
    return subprocess.Popen(cmd, stdout=sys.stdout, stderr=sys.stderr)


def wait_for_health(base: str, timeout: int) -> None:
    deadline = time.time() + timeout
    url = f"{base}/health"
    last = None
    while time.time() < deadline:
        try:
            r = httpx.get(url, timeout=5)
            if r.status_code == 200:
                print(f"[wrapper] llama-server ready at {base}", flush=True)
                return
            last = f"{r.status_code}"
        except Exception as e:  # connection refused while still booting
            last = repr(e)
        time.sleep(1)
    sys.exit(f"[wrapper] llama-server not healthy after {timeout}s (last: {last}).")


# --------------------------------------------------------------------------
# App
# --------------------------------------------------------------------------

app = FastAPI(title="llama.cpp python wrapper")


@app.on_event("startup")
async def _startup() -> None:
    global client, proc
    if not CFG.upstream_url:
        proc = start_llama_server()
    wait_for_health(CFG.upstream_base, CFG.startup_timeout)
    client = httpx.AsyncClient(base_url=CFG.upstream_base, timeout=httpx.Timeout(
        # long read timeout for slow first-token / long generations
        connect=10, read=CFG.startup_timeout * 5, write=30, pool=10,
    ))


@app.on_event("shutdown")
async def _shutdown() -> None:
    if client:
        await client.aclose()
    if proc and proc.poll() is None:
        print("[wrapper] stopping llama-server", flush=True)
        proc.send_signal(signal.SIGTERM)
        with contextlib.suppress(Exception):
            proc.wait(timeout=15)
        if proc.poll() is None:
            proc.kill()


@app.get("/")
async def index() -> JSONResponse:
    return JSONResponse({
        "service": "llama.cpp python wrapper",
        "openai_base": f"http://{CFG.host}:{CFG.port}/v1",
        "upstream": CFG.upstream_base,
        "model": CFG.model or "(attached)",
        "endpoints": ["/v1/chat/completions", "/v1/completions",
                      "/v1/models", "/v1/embeddings", "/health"],
    })


async def _forward(request: Request) -> httpx.Response | StreamingResponse:
    path = request.url.path
    if request.url.query:
        path = f"{path}?{request.url.query}"

    # skip hop-by-hop headers; httpx sets content-length/host itself
    headers = {k: v for k, v in request.headers.items()
               if k.lower() not in ("host", "content-length", "connection")}

    body = await request.body()
    req = client.build_request(
        method=request.method,
        url=path,
        headers=headers,
        content=body,
    )
    # stream=True so SSE (stream:true chat) passes through unbuffered
    upstream = await client.send(req, stream=True)

    resp_headers = {k: v for k, v in upstream.headers.items()
                    if k.lower() not in ("content-length", "content-encoding",
                                         "transfer-encoding", "connection")}

    async def _body():
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        finally:
            await upstream.aclose()

    return StreamingResponse(_body(), status_code=upstream.status_code,
                             headers=resp_headers, media_type=upstream.headers.get("content-type"))


# Catch-all: transparent proxy for the known llama-server routes.
@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy(request: Request, path: str):
    full = f"/{path}"
    if not any(full.startswith(p) for p in PROXY_PREFIXES):
        return JSONResponse({"error": "unknown route", "path": full}, status_code=404)
    return await _forward(request)


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def parse_args() -> None:
    p = argparse.ArgumentParser(description="OpenAI-compatible wrapper for llama-server")
    p.add_argument("--model", help="path to a .gguf model (sets MODEL_PATH)")
    p.add_argument("--llama-server", help="path to llama-server binary")
    p.add_argument("--host", help="bind address for this wrapper")
    p.add_argument("--port", type=int, help="port for this wrapper")
    p.add_argument("--upstream-url", help="attach to a running llama-server instead of spawning")
    p.add_argument("--", dest="llama_args", nargs=argparse.REMAINDER,
                   help="everything after -- is passed to llama-server")
    a = p.parse_args()
    if a.model:
        CFG.model = a.model
    if a.llama_server:
        CFG.llama_bin = a.llama_server
    if a.host:
        CFG.host = a.host
    if a.port:
        CFG.port = a.port
    if a.upstream_url:
        CFG.upstream_url = a.upstream_url
    if a.llama_args:
        # argparse leaves the leading "--" in REMAINDER on some versions
        CFG.extra_args = [x for x in a.llama_args if x != "--"]


if __name__ == "__main__":
    import uvicorn
    parse_args()
    uvicorn.run(app, host=CFG.host, port=CFG.port, log_level="info")
