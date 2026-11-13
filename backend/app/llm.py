"""Qwen via BharatCode (OpenAI-compatible). One helper: ask for JSON, get a validated pydantic object."""
import json
import os
import re
import time
from typing import Callable

from dotenv import load_dotenv
from openai import APIConnectionError, APIError, APIStatusError, OpenAI, Timeout

try:  # mid-stream stalls surface as the SDK's HTTP library's own exceptions; openai>=3 is built on httpx2
    import httpx2 as http
except ImportError:
    import httpx as http
from pydantic import BaseModel, ValidationError

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

API_KEY = os.getenv("BHARATCODE_API_KEY", "").strip()
if not API_KEY.startswith("bc_"):
    # Fail loudly: an empty/wrong key makes BharatCode answer with a confusing "OAuth session" 401.
    print("WARNING: BHARATCODE_API_KEY missing or not a bc_live_... key. Create one at https://bharatcode.ai/build and put it in backend/.env")

# We stream every call, so the read timeout is the longest SILENCE allowed, not the total time: a slow-but-alive
# generation (BharatCode has dropped to ~1 tok/s) never times out, a stuck one is cut after STALL seconds and retried.
# (A plain total timeout couldn't tell slow from stuck: live, one agent burned 3 x 300s timeouts.)
STALL = float(os.getenv("LLM_STALL_TIMEOUT", "180"))
client = OpenAI(
    api_key=API_KEY or "missing",
    base_url=os.getenv("LLM_BASE_URL", "https://bharatcode.ai/api/model/v1"),
    timeout=Timeout(STALL, connect=15),
    max_retries=0,  # retries are handled in complete() so stalls, 503s and network blips are all treated the same
)
MODEL = os.getenv("LLM_MODEL", "qwen-3.8-27b")
def _retryable(e: Exception) -> bool:
    """Stalls, network blips and server-side errors (incl. "Model unavailable" sent mid-stream) are worth a retry;
    our own mistakes (4xx: bad key, bad request) are not."""
    if isinstance(e, (http.TimeoutException, http.TransportError, APIConnectionError)):
        return True
    return isinstance(e, APIError) and not (isinstance(e, APIStatusError) and e.status_code < 500)


def complete(messages: list[dict], extra: dict) -> str:
    """One streamed chat completion -> full text, with up to 2 retries for retryable failures."""
    for attempt in range(3):
        try:
            stream = client.chat.completions.create(model=MODEL, messages=messages, temperature=0.2, extra_body=extra, stream=True)
            return "".join(c.choices[0].delta.content or "" for c in stream if c.choices)
        except Exception as e:
            if attempt == 2 or not _retryable(e):
                raise
            print(f"LLM {type(e).__name__}: {e} - retrying ({attempt + 1}/2)...")
            time.sleep(5 * (attempt + 1))  # "Model unavailable" needs a few seconds, not milliseconds


def json_objects(text: str):
    """Yield every top-level JSON object in the text (Qwen may add <think>, fences, or echo extra objects)."""
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S)
    dec, i = json.JSONDecoder(), text.find("{")
    while i != -1:
        try:
            obj, end = dec.raw_decode(text, i)
            yield obj
            i = text.find("{", end)
        except ValueError:
            i = text.find("{", i + 1)


def parse(text: str, schema: type[BaseModel]) -> BaseModel:
    errors = []
    for obj in json_objects(text):
        try:
            return schema.model_validate(obj)
        except ValidationError as e:
            errors.append(e)
    raise ValueError(f"no valid {schema.__name__} JSON in model output" + (f": {errors[-1]}" if errors else ""))


def chat_json(system: str, user: str, schema: type[BaseModel], example: str, retries: int = 1, think: bool = False,
              check: Callable[[BaseModel], str | None] | None = None) -> BaseModel:
    """example: a filled-in sample of the output. Qwen echoes raw JSON Schemas back, so we show an instance instead.
    think: Qwen's hidden reasoning was ~90% of tokens (140s vs ~15s) on extraction tasks; off unless an agent needs it.
    check: returns a problem description (e.g. advice language) -> regenerate once with that feedback. If it still
    fails, the object is returned anyway: the guardrail firewall strips the offending parts downstream."""
    extra = {"chat_template_kwargs": {"enable_thinking": think}}
    messages = [
        {"role": "system", "content": f"{system}\n\nReply with ONLY one JSON object shaped exactly like this example (no schema, no prose):\n{example}"},
        {"role": "user", "content": user},
    ]
    for attempt in range(retries + 1):
        out = complete(messages, extra)
        try:
            obj = parse(out, schema)
        except ValueError as e:
            if attempt == retries:
                raise
            feedback = f"Invalid output ({e}). Return only the JSON object, shaped like the example."
        else:
            problem = check(obj) if check else None
            if not problem or attempt == retries:
                return obj
            feedback = f"Compliance problem: {problem}. Rewrite it as neutral information: no buy/sell/hold advice, rating, target or valuation call."
        messages += [{"role": "assistant", "content": out}, {"role": "user", "content": feedback}]
