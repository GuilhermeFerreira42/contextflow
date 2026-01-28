
# debug_transcript.py
import re
import json

raw_snippet = """{ "wireMagic": "pb3", "pens": [ { } ], "wsWinStyles": [ { }, { "mhModeHint": 2, "juJustifCode": 0, "sdScrollDir": 3 } ], "wpWinPositions": [ { }, { "apPoint": 6, "ahHorPos": 20, "avVerPos": 100, "rcRows": 2, "ccCols": 40 } ], "events": [ { "tStartMs": 0, "dDurationMs": 942360, "id": 1, "wpWinPosId": 1, "wsWinStyleId": 1 }, { "tStartMs": 80, "dDurationMs": 4440, "wWinId": 1, "segs": [ { "utf8": "Quando", "acAsrConf": 0 }, { "utf8": " afirmo", "tOffsetMs": 160, "acAsrConf": 0 }, { "utf8": " neste", "tOffsetMs": 480, "acAsrConf": 0 }, { "utf8": " canal", "tOffsetMs": 800, "acAsrConf": 0 }, { "utf8": " que", "tOffsetMs": 1160, "acAsrConf": 0 }, { "utf8": " o", "tOffsetMs": 1480, "acAsrConf": 0 } ] } ] }"""

def _clean_text(text: str) -> str:
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def _clean_downloaded_subs(raw_content: str) -> str:
    print(f"DEBUG: Input length: {len(raw_content)}")
    print(f"DEBUG: Input start: {raw_content[:50]}...")
    
    # 1. Tentar JSON3 (Google Format)
    try:
        possible_json = json.loads(raw_content)
        print("DEBUG: JSON load success")
        
        if 'events' in possible_json:
            print("DEBUG: Found 'events' key")
            segs = []
            for event in possible_json['events']:
                if 'segs' in event:
                    for s in event['segs']:
                        if 'utf8' in s and s['utf8'].strip():
                            segs.append(s['utf8'].strip())
            return _clean_text(" ".join(segs))
        else:
            print("DEBUG: JSON loaded but no 'events'")
    except Exception as e:
        print(f"DEBUG: JSON load failed: {e}")

    # 2. Fallback
    print("DEBUG: Fallback regex cleanup")
    return "FALLBACK_USED"

cleaned = _clean_downloaded_subs(raw_snippet)
print("\n--- RESULTADO FINAL ---\n")
print(cleaned)
