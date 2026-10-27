"""Export electrical probe locations and a small-signal SPICE response, read-only.

Run with KiCad's Python (pcbnew), not the system Python. The browser needs only
the resulting JSON; neither KiCad nor ngspice is needed by visitors.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import tempfile
import xml.etree.ElementTree as ET

import pcbnew


def mm(value):
    return round(value / 1e6, 5)


def export_board(path):
    board = pcbnew.LoadBoard(str(path))
    footprints, pads = [], []
    for part in board.GetFootprints():
        ref = part.GetReference()
        footprints.append({"ref": ref, "value": part.GetValue(),
                           "x": mm(part.GetPosition().x), "z": mm(part.GetPosition().y)})
        for pad in part.Pads():
            if not pad.GetNetname():
                continue
            position = pad.GetPosition()
            pads.append({"id": f"{ref}.{pad.GetNumber()}", "ref": ref,
                         "pin": pad.GetNumber(), "net": pad.GetNetname(),
                         "x": mm(position.x), "z": mm(position.y),
                         "front": pad.IsOnLayer(pcbnew.F_Cu),
                         "back": pad.IsOnLayer(pcbnew.B_Cu),
                         "size": [mm(pad.GetSize().x), mm(pad.GetSize().y)]})
    tracks = []
    for track in board.GetTracks():
        if track.GetLayer() not in (pcbnew.F_Cu, pcbnew.B_Cu):
            continue
        tracks.append({"net": track.GetNetname(), "front": track.GetLayer() == pcbnew.F_Cu,
                       "a": [mm(track.GetStart().x), mm(track.GetStart().y)],
                       "b": [mm(track.GetEnd().x), mm(track.GetEnd().y)]})
    return {"source": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "units": "mm", "coordinates": "KiCad GLB: x = PCB x, z = PCB y, y = board normal",
            "thickness": mm(board.GetDesignSettings().GetBoardThickness()),
            "components": sorted(footprints, key=lambda item: item["ref"]),
            "pads": pads, "tracks": tracks}


def spice_template(parts):
    values = {part["ref"]: part["value"] for part in parts}
    # Fail visibly if this export no longer describes the circuit being solved.
    expected = {"R8": "49R9", "R7": "49R9", "R9": "4.9K", "C28": "1u",
                "R40": "1K", "R27": "200", "R37": "22"}
    for ref, value in expected.items():
        if values.get(ref) != value:
            raise ValueError(f"Review circuit: {ref} is {values.get(ref)}, expected {value}")
    gain = 1 + 4900 / 49.9
    charge = 1.7e6 * 1.602176634e-19
    rise, fall = 0.8e-9, 30e-9
    points = [(0.0, 0.0), (200e-9, 0.0)]
    for index in range(1, 1601):
        t = index * 0.5e-9
        current = charge * (math.exp(-t / fall) - math.exp(-t / rise)) / (fall - rise)
        points.append((200e-9 + t, current))
    points.append((2e-6, 0.0))
    stimulus = " ".join(f"{t:.12g} {current:.12g}" for t, current in points)
    deck = f"""Readout CH0 linear impulse response, one fully recovered avalanche
.option method=gear reltol=1e-5 abstol=1e-14
Vhi hv 0 55.13438071296
Vlo low 0 1.3
Rbias low raw 1k
Cterminal hv raw 140p
Rleak hv raw 10G
Iphoto hv raw PWL({stimulus})
C28 raw inp 1u
R8 inp 0 49.9
Bgain ideal 0 V={gain:.12g}*V(inp)
Rbw ideal pole 1k
Cbw pole 0 {1/(2*math.pi*(1.75e9/gain)*1000):.12g}
Rout pole amp 6
R9 amp fb 4.9k
R7 fb 0 49.9
R27 amp cin 200
Cinput cin 0 1p
Rload cin 0 1G
.control
set wr_singlescale
set wr_vecnames
tran 0.5n 2u
wrdata response.txt v(raw) v(inp) v(fb) v(amp) v(cin)
quit
.endc
.end
"""
    with tempfile.TemporaryDirectory(prefix="glowcost-probe-") as folder:
        path = Path(folder)
        (path / "response.cir").write_text(deck, encoding="ascii")
        result = subprocess.run(["/opt/homebrew/bin/ngspice", "-b", "response.cir"],
                                cwd=path, capture_output=True, text=True, check=True)
        lines = (path / "response.txt").read_text().splitlines()
        rows = [list(map(float, line.split())) for line in lines[1:] if line.strip()]
    # Store uniform samples so the browser can interpolate at any timebase.
    series = {name: [] for name in ("raw", "input", "feedback", "amplifier", "comparatorInput")}
    cursor = 0
    for index in range(4001):
        t = index * 0.5e-9
        while cursor + 1 < len(rows) and rows[cursor + 1][0] < t:
            cursor += 1
        a, b = rows[cursor], rows[min(cursor + 1, len(rows) - 1)]
        weight = (t - a[0]) / (b[0] - a[0]) if b[0] > a[0] else 0
        for column, name in enumerate(series, 1):
            value = a[column] + weight * (b[column] - a[column])
            if name == "raw":
                value -= rows[0][column]
            series[name].append(round(value, 10))
    return {"engine": "ngspice", "stepNs": 0.5, "startNs": -200,
            "referenceOvervoltage": 3, "gainElectrons": 1700000,
            "chargePerAvalancheC": charge, "closedLoopGain": gain,
            "bandwidthHz": 1.75e9 / gain, "capacitanceF": 140e-12,
            "riseNs": 0.8, "fallNs": 30, "series": series,
            "deck": deck, "solverLog": result.stdout[-500:]}


def check_schematic(path, data):
    with tempfile.TemporaryDirectory(prefix="glowcost-netlist-") as folder:
        netlist = Path(folder) / "readout.xml"
        subprocess.run(["/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli", "sch", "export",
                        "netlist", "--format", "kicadxml", "--output", str(netlist), str(path)],
                       capture_output=True, check=True)
        root = ET.parse(netlist).getroot()
    pins = {(node.attrib["ref"], node.attrib["pin"]): net.attrib["name"]
            for net in root.find("nets") for node in net.findall("node")}
    names = {}
    reverse = {}
    for pad in data["pads"]:
        name = pins[(pad["ref"], pad["pin"])]
        names.setdefault(name, set()).add(pad["net"])
        reverse.setdefault(pad["net"], set()).add(name)
    if any(len(targets) != 1 for targets in [*names.values(), *reverse.values()]):
        raise ValueError("PCB and schematic net connectivity differ; do not publish this map")
    return {"source": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "matchedPads": len(data["pads"]),
            "netAliases": {name: next(iter(targets)) for name, targets in names.items()}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("board", type=Path)
    parser.add_argument("--output", type=Path, default=Path("public/assets/probe-board.json"))
    parser.add_argument("--schematic", type=Path)
    args = parser.parse_args()
    data = export_board(args.board)
    if args.schematic:
        data["schematic"] = check_schematic(args.schematic, data)
    data["response"] = spice_template(data["components"])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, separators=(",", ":")), encoding="utf8")
    print(f"Exported {len(data['pads'])} pads, {len(data['tracks'])} surface tracks")


if __name__ == "__main__":
    main()
