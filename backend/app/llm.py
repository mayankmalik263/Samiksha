"""Qwen via BharatCode (OpenAI-compatible). One helper: ask for JSON, get a validated pydantic object."""
import json
import os
import re

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, ValidationError

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

API_KEY = os.getenv("BHARATCODE_API_KEY", "").strip()
if not API_KEY.startswith("bc_"):
    # Fail loudly: an empty/wrong key makes BharatCode answer with a confusing "OAuth session" 401.
    print("WARNING: BHARATCODE_API_KEY missing or not a bc_live_... key. Create one at https://bharatcode.ai/build and put it in backend/.env")

client = OpenAI(
    api_key=API_KEY or "missing",
    base_url=os.getenv("LLM_BASE_URL", "https://bharatcode.ai/api/model/v1"),
)
MODEL = os.getenv("LLM_MODEL", "qwen-3.8-27b")


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


def chat_json(system: str, user: str, schema: type[BaseModel], example: str, retries: int = 1) -> BaseModel:
    """example: a filled-in sample of the output. Qwen echoes raw JSON Schemas back, so we show an instance instead."""
    messages = [
        {"role": "system", "content": f"{system}\n\nReply with ONLY one JSON object shaped exactly like this example (no schema, no prose):\n{example}"},
        {"role": "user", "content": user},
    ]
    for attempt in range(retries + 1):
        out = client.chat.completions.create(model=MODEL, messages=messages, temperature=0.2).choices[0].message.content or ""
        try:
            return parse(out, schema)
        except ValueError as e:
            if attempt == retries:
                raise
            messages += [{"role": "assistant", "content": out}, {"role": "user", "content": f"Invalid output ({e}). Return only the JSON object, shaped like the example."}]
