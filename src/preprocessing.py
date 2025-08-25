# preprocessing.py
import re
from typing import Optional

def normalize_text(s: Optional[str]) -> str:
    if s is None: return ""
    t = str(s)
    t = t.replace("\r", " ").replace("\n", " ")
    t = t.lower()
    t = re.sub(r"http\S+", " ", t)
    # hapus karakter non-alphanumeric (termasuk emoticon), sisakan kata/angka/spasi
    t = re.sub(r"[^\w\s]", " ", t, flags=re.UNICODE)
    t = re.sub(r"\s+", " ", t).strip()
    return t
