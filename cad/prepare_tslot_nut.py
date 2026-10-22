"""Select the nut solid from the supplied nut-and-screw STEP assembly."""
import hashlib
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = root / "cad/5537T161_T-Slotted_Framing.step"
text = source.read_text()
entities = dict(re.findall(r"#(\d+)\s*=\s*(.*?);", text, flags=re.S))
solids = {key: value for key, value in entities.items() if value.startswith("MANIFOLD_SOLID_BREP")}
selected = [key for key, value in solids.items() if "'Cut-Extrude4'" in value]
if len(selected) != 1:
    raise ValueError("Expected one Cut-Extrude4 nut solid in the supplied STEP.")
selected = selected[0]

def select_items(match):
    head, items, tail = match.groups()
    references = re.findall(r"#(\d+)", items)
    kept = [key for key in references if key not in solids or key == selected]
    return head + ", ".join("#" + key for key in kept) + tail

derived, count = re.subn(
    r"(ADVANCED_BREP_SHAPE_REPRESENTATION\s*\(\s*'[^']*'\s*,\s*\()(.*?)(\)\s*,\s*#\d+\s*\))",
    select_items, text, flags=re.S)
if count != 1:
    raise ValueError("Expected one shape representation to select the nut from.")
(root / "cad/tslot-nut-only.step").write_text(derived)
manifest = {"source": source.name, "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "selected_solid": "#" + selected, "solid_name": "Cut-Extrude4",
            "excluded_solid": "Boss-Extrude3 (screw)", "source_units": "mm",
            "note": "Only the representation's solid references change. Nut geometry is not rescaled."}
(root / "cad/tslot-nut-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps(manifest, indent=2))
