"""Plot the saved model check. Requires numpy and matplotlib, not the browser."""
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

root = Path(__file__).resolve().parents[1]
report = json.loads((root / "docs/physics-validation.json").read_text())
data = report["spectrum"]
energy = np.array([row["energyGeV"] for row in data])
intensity = np.array([row["intensity"] for row in data])

plt.rcParams.update({"font.size": 11, "axes.spines.top": False,
                     "axes.spines.right": False, "savefig.facecolor": "white"})
fig, axes = plt.subplots(1, 2, figsize=(12, 4.6), layout="constrained")
for i, (angle, color) in enumerate(zip([0, 45, 75], ["#1879b5", "#d36b27", "#21855a"])):
    axes[0].loglog(energy, intensity[:, i], label=f"{angle} deg zenith", color=color)
axes[0].set(xlabel="Muon kinetic energy (GeV)",
            ylabel="Differential intensity (cm$^{-2}$ s$^{-1}$ sr$^{-1}$ GeV$^{-1}$)",
            title="Guan et al. sea-level spectrum")
axes[0].grid(alpha=0.2)
axes[0].legend(frameon=False)

keys = ["c01", "c12", "c02"]
means = [report["counts"][key]["perMinute"] for key in keys]
errors = [report["counts"][key]["statisticalSem"] for key in keys]
axes[1].bar([0, 1, 2], means, color=["#1879b5", "#d36b27", "#21855a"],
            width=0.6, alpha=0.85, yerr=errors, capsize=6)
for x, value, error in zip([0, 1, 2], means, errors):
    axes[1].text(x, value + 5, f"{value:.2f} +/- {error:.2f}", ha="center", fontsize=10)
axes[1].set(xticks=[0, 1, 2], xticklabels=["Top-middle", "Middle-bottom", "Top-bottom"],
            ylabel="Ideal muon coincidences / min", ylim=(0, max(means) * 1.25),
            title="Finite-volume model; 600 simulated minutes")
axes[1].text(0.03, 0.96, "Errors: Monte Carlo statistics only", va="top", fontsize=10,
             transform=axes[1].transAxes)
axes[1].grid(axis="y", alpha=0.2)
axes[1].set_axisbelow(True)
fig.savefig(root / "docs/figures/physics-validation.png", dpi=180)
