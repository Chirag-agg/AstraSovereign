"""Benchmarking harness for dense ANSI-D engineering P&ID drawings.

Features:
- Deterministic random seed for exact reproducibility.
- Reusable pre-warmed RapidOCREngine across all configurations.
- Exact normalized string matching (no fuzzy/substring matching).
- Full audit reporting: true positives, false positives, missing tags.
- Resilient per-configuration try/except isolation.
"""

import asyncio
import random
import sys
import time
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.ocr_provider import RapidOCREngine
from app.services.pid_classifier import PIDTagClassifier
from app.services.pid_extractor import PIDExtractor, PIDSettings

def generate_dense_pid_sheet(output_path: Path, seed: int = 42) -> list[str]:
    """Generate a realistic ANSI-D scaled P&ID drawing (7200 x 4800 px) with fixed seed."""
    random.seed(seed)
    width, height = 7200, 4800
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)

    try:
        font = ImageFont.truetype("arial.ttf", 28)
    except Exception:
        font = ImageFont.load_default()

    ground_truth: list[str] = []

    # Unit 100: Feed & Storage Section (x: 400..2200)
    # Storage Tank
    draw.rectangle([600, 800, 2000, 3600], outline="black", width=8)
    draw.text((1100, 720), "TANK-101", fill="black", font=font)
    ground_truth.append("TANK-101")
    
    # Instruments on Tank 101
    instruments_u100 = [
        ("LT-101", 1150, 1200),
        ("LI-101", 1150, 1600),
        ("TI-101", 1150, 2400),
        ("PSV-101", 1700, 650),
    ]
    for tag, ix, iy in instruments_u100:
        draw.ellipse([ix - 75, iy - 75, ix + 75, iy + 75], outline="black", width=4)
        draw.text((ix - 45, iy - 15), tag, fill="black", font=font)
        ground_truth.append(tag)

    # Pumps
    draw.rectangle([2500, 2600, 2900, 3200], outline="black", width=6)
    draw.text((2580, 2530), "P-101A", fill="black", font=font)
    ground_truth.append("P-101A")

    draw.rectangle([2500, 3500, 2900, 4100], outline="black", width=6)
    draw.text((2580, 3430), "P-101B", fill="black", font=font)
    ground_truth.append("P-101B")

    # Lines from Tank to Pumps
    lines_u100 = [
        ('8"-P-1101-CS', 2100, 2800),
        ('8"-P-1102-CS', 2100, 3700),
        ('6"-P-1103-CS', 2960, 2800),
    ]
    for tag, lx, ly in lines_u100:
        draw.line([(lx - 200, ly + 40), (lx + 400, ly + 40)], fill="black", width=6)
        draw.text((lx, ly), tag, fill="black", font=font)
        ground_truth.append(tag)

    # Unit 200: Reaction & Separation (x: 3000..5000)
    # Reactor R-201
    draw.rectangle([3600, 1000, 4800, 3200], outline="black", width=10)
    draw.text((4000, 920), "R-201", fill="black", font=font)
    ground_truth.append("R-201")

    instruments_u200 = [
        ("PT-201", 3400, 1400),
        ("TT-201", 3400, 1800),
        ("TIC-201", 3400, 2200),
        ("FT-201", 3300, 2750),
        ("FCV-201", 3500, 2750),
        ("PDIC-202", 4950, 1600),
    ]
    for tag, ix, iy in instruments_u200:
        draw.ellipse([ix - 75, iy - 75, ix + 75, iy + 75], outline="black", width=4)
        draw.text((ix - 50, iy - 15), tag, fill="black", font=font)
        ground_truth.append(tag)

    # Unit 300: Heat Exchange & Export (x: 5200..7000)
    # Heat Exchanger E-301
    draw.rectangle([5400, 1800, 6400, 2600], outline="black", width=8)
    draw.text((5750, 1720), "E-301", fill="black", font=font)
    ground_truth.append("E-301")

    instruments_u300 = [
        ("TI-301", 5600, 1400),
        ("TI-302", 6200, 1400),
        ("PT-301", 5800, 2800),
    ]
    for tag, ix, iy in instruments_u300:
        draw.ellipse([ix - 75, iy - 75, ix + 75, iy + 75], outline="black", width=4)
        draw.text((ix - 45, iy - 15), tag, fill="black", font=font)
        ground_truth.append(tag)

    # Process and utility lines
    lines_u300 = [
        ('4"-W-3101-CS', 5400, 1200),
        ('6"-P-3201-A1A', 5600, 3100),
        ('2"-IA-301-SS', 4200, 4200),
    ]
    for tag, lx, ly in lines_u300:
        draw.line([(lx - 150, ly + 40), (lx + 350, ly + 40)], fill="black", width=6)
        draw.text((lx, ly), tag, fill="black", font=font)
        ground_truth.append(tag)

    # Title block
    draw.rectangle([5600, 4100, 7000, 4650], outline="black", width=6)
    draw.text((5700, 4180), "DWG: PID-2026-AREA100", fill="black", font=font)
    draw.text((5700, 4350), "REVISION C", fill="black", font=font)
    ground_truth.append("REV C")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, format="PNG")
    print(f"Generated deterministic ANSI-D drawing: {output_path} ({width}x{height} px, {len(ground_truth)} tags, seed={seed})")
    return ground_truth


async def evaluate_config(
    ocr: RapidOCREngine,
    classifier: PIDTagClassifier,
    sheet_path: Path,
    rows: int,
    cols: int,
    ground_truth: list[str],
) -> dict:
    num_tiles = rows * cols
    label = f"{num_tiles} Tile(s) [{rows}x{cols}]"
    print(f"\nEvaluating: {label}...")

    try:
        settings = PIDSettings(tile_grid_rows=rows, tile_grid_cols=cols, crop_margin_pixels=80)
        extractor = PIDExtractor(settings=settings, classifier=classifier, ocr_provider=ocr)

        t0 = time.perf_counter()
        elements = await extractor.extract_page(
            sheet_path,
            page_number=1,
            output_dir=Path(f"backend/scratch/bench_{rows}x{cols}"),
        )
        elapsed = time.perf_counter() - t0

        # Exact matching logic:
        # Use exact normalized string equality (e.text == gt)
        detected_tags = [e.text for e in elements]
        unique_detected = sorted(set(detected_tags))
        gt_set = set(ground_truth)

        # Calculate exact true positives, false positives, and missing
        true_positives = [t for t in unique_detected if t in gt_set]
        false_positives = [t for t in unique_detected if t not in gt_set]
        missing = [t for t in ground_truth if t not in unique_detected]

        tp_count = len(true_positives)
        det_count = len(unique_detected)
        gt_count = len(ground_truth)

        precision = tp_count / det_count if det_count > 0 else 0.0
        recall = tp_count / gt_count if gt_count > 0 else 0.0
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

        print(f"  -> Detected Unique: {det_count} | Ground Truth: {gt_count}")
        print(f"  -> True Positives: {tp_count} / {gt_count} ({recall:.1%})")
        print(f"  -> False Positives ({len(false_positives)}): {false_positives}")
        print(f"  -> Missing Tags ({len(missing)}): {missing}")
        print(f"  -> Precision: {precision:.1%}, Recall: {recall:.1%}, F1: {f1:.2f}, Latency: {elapsed:.2f}s")

        return {
            "label": label,
            "tiles": num_tiles,
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "latency": elapsed,
            "detected": det_count,
            "true_positives": true_positives,
            "false_positives": false_positives,
            "missing": missing,
            "status": "SUCCESS",
        }
    except Exception as exc:
        print(f"  -> FAILED: {exc}")
        return {
            "label": label,
            "tiles": num_tiles,
            "precision": 0.0,
            "recall": 0.0,
            "f1": 0.0,
            "latency": 0.0,
            "detected": 0,
            "true_positives": [],
            "false_positives": [],
            "missing": ground_truth,
            "status": f"ERROR: {exc}",
        }


async def main():
    sheet_path = Path("backend/scratch/dense_ansi_d_sheet.png")
    ground_truth = generate_dense_pid_sheet(sheet_path, seed=42)

    # 1. Warm up RapidOCR engine ONCE before benchmark timer starts
    print("\nInitializing and warming up RapidOCREngine...")
    ocr = RapidOCREngine()
    classifier = PIDTagClassifier()
    
    # Warmup pass on small dummy canvas so ONNX models are loaded into RAM
    warmup_path = Path("backend/scratch/warmup.png")
    Image.new("RGB", (100, 100), "white").save(warmup_path)
    await ocr.recognize(warmup_path)
    if warmup_path.exists():
        warmup_path.unlink()
    print("RapidOCR engine warm and resident in memory.")

    results = []
    # 1. Whole Sheet (1 Tile) [1x1]
    results.append(await evaluate_config(ocr, classifier, sheet_path, 1, 1, ground_truth))
    # 2. Horizontal Split (2 Tiles) [1x2]
    results.append(await evaluate_config(ocr, classifier, sheet_path, 1, 2, ground_truth))
    # 3. High-Density Grid (6 Tiles) [2x3]
    results.append(await evaluate_config(ocr, classifier, sheet_path, 2, 3, ground_truth))

    print("\n" + "=" * 95)
    print("DENSE ANSI-D (7200x4800) P&ID EXTRACTION BENCHMARK — STANDARDIZED & REPRODUCIBLE")
    print("=" * 95)
    print(f"{'Configuration':<25} | {'Tiles':<5} | {'Detected':<8} | {'Recall':<8} | {'Prec.':<8} | {'F1':<6} | {'Latency':<8} | {'False Positives'}")
    print("-" * 95)
    for r in results:
        fp_str = ", ".join(r["false_positives"]) if r["false_positives"] else "None"
        print(f"{r['label']:<25} | {r['tiles']:<5} | {r['detected']:<8} | {r['recall']:<8.1%} | {r['precision']:<8.1%} | {r['f1']:<6.2f} | {r['latency']:<7.2f}s | {fp_str}")
    print("=" * 95)

    # Detailed audit of false positives and missing across configurations
    print("\nDetailed Diagnostic Breakdown:")
    for r in results:
        print(f"\nConfiguration: {r['label']}")
        print(f"  Status: {r['status']}")
        print(f"  Exact True Positives ({len(r['true_positives'])}): {sorted(r['true_positives'])}")
        print(f"  False Positives ({len(r['false_positives'])}): {r['false_positives']}")
        print(f"  Missing Tags ({len(r['missing'])}): {r['missing']}")

if __name__ == "__main__":
    asyncio.run(main())
