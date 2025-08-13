# scripts/preprocessing.py
import re
try:
    import emoji as _emoji
    HAS_EMOJI = True
except Exception:
    HAS_EMOJI = False

EMOTICON_MAP = {
    ":-)": "smile", ":)": "smile", ":-(": "sad", ":(": "sad",
    ";)": "wink", ":-D": "laugh", ":D": "laugh", ":-/": "skeptical",
    ":'(": "cry", ":-P": "playful", ":P": "playful", "<3": "heart"
}

def normalize_text(text: str) -> str:
    """Normalize text for TF-IDF / SVM: demojize => tokens, map emoticons, remove urls/html, lowercase."""
    if text is None:
        return ""
    t = str(text)
    # demojize if available
    if HAS_EMOJI:
        try:
            t = _emoji.demojize(t, language='en')
        except Exception:
            pass
    # replace common emoticons with tokens
    for emo, token in EMOTICON_MAP.items():
        t = t.replace(emo, " " + token + " ")
    # convert :short_name: -> short_name (from demojize)
    t = re.sub(r":([a-zA-Z0-9_+-]+):", r" \1 ", t)
    # remove urls and html tags
    t = re.sub(r"http\S+", " ", t)
    t = re.sub(r"<[^>]+>", " ", t)
    # lowercase
    t = t.lower()
    # keep underscores (emoji names), letters, digits and spaces
    t = re.sub(r"[^a-z0-9_\s]", " ", t)
    # collapse spaces
    t = re.sub(r"\s+", " ", t).strip()
    return t
