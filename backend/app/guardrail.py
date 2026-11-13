"""Compliance guardrail: Samiksha informs, it never advises (SEBI). Enforced in code, not just in prompts.

1. advice()   - spots buy/sell/hold/target/multibagger-style recommendation language.
2. numbers()  - every number in a claim must appear in its source (closes "real quote, invented number").
3. firewall() - final pass over the whole response: drops unverified or advisory items, withholds an
                advisory summary, and logs every block so the UI can show "the firewall caught N".
"""
import re

ADVICE = re.compile(r"""\b(
    (?:strong\s+)?(?:buy|sell|hold|accumulate|reduce|avoid)\s+(?:rating|call|recommendation|signal)
  | (?:rated|maintains?|maintained|retains?|retained|upgrades?d?\s+to|downgrades?d?\s+to)\s+(?:a\s+)?(?:buy|sell|hold|accumulate|reduce)
  | (?:buy|sell|hold|accumulate|exit|avoid)\s+(?:the\s+|this\s+)?(?:stock|shares?|position|scrip)
  | (?:buy|sell|hold)\s+on\s+dips?
  | strong\s+(?:buy|sell)
  | (?:is|looks?|remains?|seems?)\s+(?:like\s+)?(?:a\s+)?(?:buy|sell)
  | (?:you|investors?|one|readers?|users?)\s+(?:should|must|could|may\s+want\s+to|might\s+want\s+to|need\s+to|ought\s+to)\s+(?:buy|sell|hold|invest|exit|accumulate|avoid|book|consider\s+buying|consider\s+selling)
  | target\s+price | price\s+target | tgt
  | target\s+(?:of\s+|at\s+)?(?:rs\.?|₹|inr)\s*[\d,]+
  | (?:says|recommends?|suggests?|brokerages?\s+say|analysts?\s+say)\s+(?:a\s+)?(?:buy|sell|hold|accumulate)
  | multi-?baggers?
  | stop[\s-]?loss
  | (?:good|great|bad|safe|risky|smart|solid|attractive)\s+(?:investment|buy|bet|pick|entry\s+point)
  | (?:under|over)valued
  | overweight | underweight
  | book\s+(?:your\s+)?profits?
  | upside\s+(?:of|potential)
)\b""", re.I | re.X)


def advice(text: str) -> str | None:
    """The first recommendation-style phrase in the text, or None."""
    m = ADVICE.search(text or "")
    return m.group(0) if m else None


_NUM = re.compile(r"\d[\d,]*(?:\.\d+)?")


def numbers(text: str) -> set[str]:
    """Significant numbers, normalised: 1,20,000 -> 120000, 25.0 -> 25. Lone single digits ("4-year") are ignored."""
    out = set()
    for raw in _NUM.findall(text or ""):
        n = raw.replace(",", "")
        if "." in n:
            n = n.rstrip("0").rstrip(".")
        if len(n.replace(".", "")) >= 2:
            out.add(n)
    return out


# Filings write years as "2025-26", "FY26" or "FY 2025-26"; the model normalises them to "FY2026". Same year, not a
# new number: count those forms as the year they end in.
_YEAR_SPAN = re.compile(r"\b(20\d\d)\s*[-–/]\s*(\d\d)\b")
_FY_SHORT = re.compile(r"\bFY\s*'?(\d\d)\b", re.I)


def _years(text: str) -> set[str]:
    return {"20" + m.group(2) for m in _YEAR_SPAN.finditer(text)} | {"20" + m.group(1) for m in _FY_SHORT.finditer(text)}


def unsupported_numbers(claim: str, source_text: str) -> set[str]:
    return numbers(claim) - numbers(source_text) - _years(source_text)


# Model-written fields. Quotes are checked separately at verification (agents._verify): a quote relaying a
# broker's buy call or target price can never be "verified", so it never reaches the debate or the user.
WRITTEN = ("claim", "point", "answer", "bottom_line")
WITHHELD = "Withheld by Samiksha's compliance guardrail (it read like investment advice)."


def written_texts(node) -> list[str]:
    """Every model-written string in a (dumped) response, for advice checks."""
    if isinstance(node, dict):
        texts = [node[k] for k in WRITTEN if isinstance(node.get(k), str)]
        texts += [w for w in node.get("what_to_watch", []) if isinstance(w, str)]
        for k, v in node.items():
            if k not in WRITTEN and k != "sources":
                texts += written_texts(v)
        return texts
    if isinstance(node, list):
        return [t for x in node for t in written_texts(x)]
    return []


def _reject(item) -> str | None:
    if isinstance(item, dict):
        if item.get("verified") is False:
            return item.get("issue") or "not verified against its source"
        text = item.get("claim") or item.get("point")
        if text and (m := advice(text)):
            return f"advice language: '{m}'"
    elif isinstance(item, str) and (m := advice(item)):
        return f"advice language: '{m}'"
    return None


def _clean(node, path: str, blocked: list):
    if isinstance(node, dict):
        out = {}
        for k, v in node.items():
            if k == "_blocked":  # items an agent already removed (e.g. bottom-line sentences with invented numbers)
                blocked.extend(v)
                continue
            if k in ("bottom_line", "answer") and isinstance(v, str) and (m := advice(v)):
                blocked.append({"where": f"{path}.{k}", "text": v, "reason": f"advice language: '{m}'"})
                out[k] = WITHHELD
            else:
                out[k] = v if k == "sources" else _clean(v, f"{path}.{k}", blocked)
        return out
    if isinstance(node, list):
        kept = []
        for item in node:
            if reason := _reject(item):
                text = item.get("claim") or item.get("point") or item.get("quote") if isinstance(item, dict) else item
                blocked.append({"where": path, "text": text, "reason": reason})
            else:
                kept.append(_clean(item, path, blocked))
        return kept
    return node


def firewall(response: dict) -> dict:
    """Last line of defence on the JSON we send. Adds response["guardrail"] = {passed, blocked: [...]}."""
    blocked: list = []
    clean = _clean({k: v for k, v in response.items() if k != "guardrail"}, "", blocked)
    clean["guardrail"] = {"passed": len(written_texts(clean)), "blocked": blocked}
    return clean


if __name__ == "__main__":  # quick self-check: python -m app.guardrail
    for bad in ["Investors should buy the stock now", "Brokerages maintain a buy rating", "target price of Rs 4,500",
                "a potential multibagger", "TCS looks undervalued", "TCS is a strong buy", "the stock looks like a buy",
                "Buy Tata Consultancy Services; target of Rs 2530: Geojit", "TCS tgt 4500", "Motilal says buy TCS", "a good investment for the long term", "book profits here"]:
        assert advice(bad), bad
    for ok in ["Tata Sons holds 71.74% of shares", "Promoters sold 2% of their stake", "The board approved a buyback",
               "Margins held steady at 25%", "Management expects demand to hold up", "TCS sells IT services",
               "It met its revenue target of 5% growth", "TCS targets Rs 1 lakh crore in AI revenue"]:
        assert not advice(ok), ok
    assert unsupported_numbers("Revenue rose 4.6% to Rs 2,67,021 crore", "growth of 4.6% ... Rs 267,021 crore") == set()
    assert unsupported_numbers("cash flow was 105.9% of profit", "Operating Cash Flow FY2026: Rs 52,094 crore") == {"105.9"}
    assert unsupported_numbers("a 4-year high of 25%", "operating margin of 25.0%, a four-year high") == set()
    assert unsupported_numbers("NII grew 4.9% in FY2026", "net interest income for 2025-26 rose 4.9%") == set()
    assert unsupported_numbers("ready by 2027 or 2028", "demerger expected by FY28, perhaps 2027") == set()
    assert unsupported_numbers("debt rose 8.4x in FY2026", "FY2026: Rs 2,399 crore, FY2025: Rs 285 crore") == {"8.4"}
    r = firewall({"x": {"points": [{"claim": "ok 25%", "verified": True}, {"claim": "made up", "verified": False, "issue": "quote not found"},
                                   {"claim": "You should buy the stock", "verified": True}],
                        "bottom_line": "TCS is a strong buy", "what_to_watch": ["Next quarter deals", "Buy on dips"]}})
    assert [p["claim"] for p in r["x"]["points"]] == ["ok 25%"]
    assert r["x"]["bottom_line"] == WITHHELD and r["x"]["what_to_watch"] == ["Next quarter deals"]
    assert len(r["guardrail"]["blocked"]) == 4  # unverified claim, advice claim, advisory bottom line, advisory watch item
    print("guardrail ok")
