# LlamaCPP - Python wrapper

A tiny Python layer that sits in front of llama.cpp's `llama-server` and
re-exposes it as an **OpenAI-compatible HTTP API**. It does not modify any C++
code; llama.cpp stays a build dependency. Point it at a `.gguf` model and it
boots the engine, waits until it is healthy, and proxies the standard `/v1/...`
routes for you.

Useful when you want one command (`python server.py --model foo.gguf`) and a
stable OpenAI base URL, instead of hand-managing the `llama-server` process.

## Layout

```
LlamaCPP/
  server.py         # wrapper: process lifecycle + OpenAI-compatible proxy
  client.py         # minimal smoke-test client (no openai pkg needed)
  requirements.txt  # fastapi, uvicorn, httpx
  .env.example      # all configuration knobs
```

## 1. Build llama.cpp

You need the `llama-server` binary. From the llama.cpp source dir:

```sh
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --target llama-server
```

The binary lands in `build/bin/` (Windows: `build/bin/Release/llama-server.exe`).

## 2. Install Python deps

```sh
python -m pip install -r requirements.txt
```

## 3. Configure

Copy `.env.example` and set at least `LLAMA_SERVER_BIN` and `MODEL_PATH`,
or pass them on the command line. `.env` is read by your shell / launcher;
the wrapper itself reads plain environment variables.

## 4. Run

Spawn and manage llama-server automatically:

```sh
python server.py --model C:\models\qwen2-7b-instruct-q4_k_m.gguf \
                 --llama-server C:\...\llama-server.exe \
                 -- --n-gpu-layers 99 --ctx-size 4096
```

Everything after `--` is forwarded verbatim to `llama-server`.

Or attach to an already-running `llama-server` (wrapper will NOT spawn one):

```sh
set UPSTREAM_URL=http://127.0.0.1:8080
python server.py
```

By default the API listens on `http://127.0.0.1:8000`.

## 5. Use it

Any OpenAI SDK can point at it. Base URL `http://127.0.0.1:8000/v1`,
API key can be anything (llama-server does not authenticate; keep the port on
loopback or add auth in front).

```python
from openai import OpenAI
c = OpenAI(base_url="http://127.0.0.1:8000/v1", api_key="none")
r = c.chat.completions.create(
    model="local",
    messages=[{"role": "user", "content": "hello"}],
)
print(r.choices[0].message.content)
```

Or the bundled smoke-test client:

```sh
python client.py "tell me a short joke"
python client.py --models
```

### Proxied endpoints

`/v1/chat/completions` (incl. `stream: true` SSE), `/v1/completions`,
`/v1/models`, `/v1/embeddings`, `/health`, `/completion`, `/tokenize`,
`/detokenize`, `/props`. Requests to other paths return 404.

## Notes

- The wrapper binds loopback by default. Do **not** expose `PORT` publicly
  without adding authentication; there is none.
- The internal `llama-server` runs on `UPSTREAM_PORT` (8081), also loopback.
- Ctrl+C stops the wrapper and cleanly terminates the spawned `llama-server`.
- First request can be slow (model load / warmup); the read timeout is generous.
