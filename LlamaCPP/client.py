# Minimal OpenAI-compatible client for the wrapper.
# Usage:  python client.py "tell me a short joke"
# Requires: pip install openai   (optional; uses raw HTTP if not installed)

import json
import sys
import urllib.request

BASE = "http://127.0.0.1:8000/v1"


def chat(prompt: str) -> None:
    payload = {
        "model": "local",
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
    }
    req = urllib.request.Request(
        f"{BASE}/chat/completions",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=300) as r:
        body = json.load(r)
    print(body["choices"][0]["message"]["content"])


def models() -> None:
    with urllib.request.urlopen(f"{BASE}/models", timeout=30) as r:
        print(json.dumps(json.load(r), indent=2))


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--models":
        models()
    else:
        chat(" ".join(sys.argv[1:]) or "hello")
