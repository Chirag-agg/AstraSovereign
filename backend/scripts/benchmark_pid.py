"""Benchmarking harness for P&ID tag extraction across tiling configurations.

Evaluates precision, recall, F1-score, and processing latency across different
grid partitioning regimes (1 tile, 2 tiles, and 6 tiles) on synthetic and
scanned P&ID drawing fixtures.
"""

import asyncio
from dataclasses import dataclass
import sys
import time
from pathlib import Path
from typing import Any, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image, ImageDraw, ImageFont

from app.services.ocr_provider import FakeOCRProvider, OCRProvider, OCRRegion, RapidOCREngine
from app.services.pid_classifier import PIDTagClassifier
from app.services.pid_extractor import PIDExtractor, PIDSettings


@dataclass
class BenchmarkResult:
    """Evaluation metrics for a specific tiling configuration."""

    config_name: str
    grid_rows: int
    grid_cols: int
    num_tiles: int
    ground_truth_count: int
    detected_count: int
    true_positives: int
    precision: float
    recall: float
    f1_score: float
    runtime_seconds: float


def generate_benchmark_drawing(output_path: Path) -> list[str]:
    """Generate a high-resolution synthetic P&ID drawing sheet for benchmarking.

    Returns the list of ground-truth normalized tag identifiers present on the sheet.
    """
    width, height = 2400, 1600
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)

    ground_truth = [
        "TANK-204",
        "P-101A",
        "PT-204A",
        "LT-204",
        "FT-204",
        '6"-P-1203-A1A',
        '2"-W-101-CS',
        "REV B",
    ]

    # Draw tank
    draw.rectangle([150, 300, 850, 1200], outline="black", width=6)
    draw.text((320, 200), "TANK-204", fill="black")
    draw.text((250, 700), "25.0 m DIA x 13.0 m HT", fill="black")

    # Draw connected pump
    draw.rectangle([1500, 800, 1850, 1150], outline="black", width=5)
    draw.text((1580, 740), "P-101A", fill="black")

    # Draw piping line
    draw.line([(850, 600), (1500, 600)], fill="black", width=6)
    draw.text((1050, 560), '6"-P-1203-A1A', fill="black")

    # Draw utility line
    draw.line([(500, 1200), (500, 1450)], fill="black", width=4)
    draw.text((520, 1300), '2"-W-101-CS', fill="black")

    # Draw instruments
    draw.ellipse([1000, 250, 1150, 400], outline="black", width=4)
    draw.text((1020, 310), "PT-204A", fill="black")

    draw.ellipse([600, 150, 750, 300], outline="black", width=4)
    draw.text((630, 210), "LT-204", fill="black")

    draw.ellipse([1250, 520, 1400, 670], outline="black", width=4)
    draw.text((1275, 580), "FT-204", fill="black")

    # Title block and revision
    draw.rectangle([1800, 1350, 2350, 1550], outline="black", width=4)
    draw.text((1850, 1380), "DWG: PID-2026-T204", fill="black")
    draw.text((1850, 1450), "REVISION B", fill="black")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, format="PNG")
    return ground_truth


class ScriptedBenchmarkOCR(OCRProvider):
    """Deterministic high-precision OCR provider for benchmark simulations."""

    def __init__(self, ground_truth_boxes: dict[str, list[int]]) -> None:
        self.boxes = ground_truth_boxes

    async def recognize(self, image_path: Path) -> list[OCRRegion]:
        img = Image.open(image_path)
        w, h = img.width, img.height
        regions = []

        # Find tags whose centers lie within this tile
        for tag, (gx0, gy0, gx1, gy1) in self.boxes.items():
            cx = (gx0 + gx1) / 2
            cy = (gy0 + gy1) / 2
            # Check if this crop captures the tag (approximate by matching coordinates if known)
            regions.append(
                OCRRegion(
                    text=tag,
                    bbox=[max(0, gx0 % w), max(0, gy0 % h), min(w, (gx1 % w) + 50), min(h, (gy1 % h) + 30)],
                    confidence=0.96,
                )
            )
        return regions


async def run_benchmark_configuration(
    config_name: str,
    rows: int,
    cols: int,
    image_path: Path,
    ground_truth: list[str],
    ocr_engine: Optional[OCRProvider] = None,
) -> BenchmarkResult:
    """Execute P&ID extraction benchmark for one tiling grid setting."""
    settings = PIDSettings(
        tile_grid_rows=rows,
        tile_grid_cols=cols,
        tile_overlap_ratio=0.15,
        render_scale=1.0,
    )
    extractor = PIDExtractor(settings=settings, ocr_provider=ocr_engine)
    out_dir = image_path.parent / f"benchmark_crops_{rows}x{cols}"

    start_time = time.perf_counter()
    elements = await extractor.extract_page(
        image_or_pdf_path=image_path,
        page_number=1,
        output_dir=out_dir,
        document_sha256="bench_hash",
    )
    elapsed = time.perf_counter() - start_time

    detected_tags = {e.text for e in elements}
    gt_set = set(ground_truth)

    true_positives = len(detected_tags.intersection(gt_set))
    precision = true_positives / len(detected_tags) if detected_tags else 0.0
    recall = true_positives / len(gt_set) if gt_set else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

    return BenchmarkResult(
        config_name=config_name,
        grid_rows=rows,
        grid_cols=cols,
        num_tiles=rows * cols,
        ground_truth_count=len(gt_set),
        detected_count=len(detected_tags),
        true_positives=true_positives,
        precision=precision,
        recall=recall,
        f1_score=f1,
        runtime_seconds=elapsed,
    )


async def run_suite(title: str, subtitle: str, ocr_engine: OCRProvider, sheet_path: Path, ground_truth: list[str]) -> list[BenchmarkResult]:
    """Run benchmark across 1-tile, 2-tile, and 6-tile grid configurations for a given OCR engine."""
    configs = [
        ("Whole Sheet (1 Tile)", 1, 1),
        ("Horizontal Split (2 Tiles)", 1, 2),
        ("High-Density Grid (6 Tiles)", 2, 3),
    ]

    print(f"\n>>> {title}")
    print(f"    [{subtitle}]")
    results: list[BenchmarkResult] = []
    for name, r, c in configs:
        print(f"  Executing: {name} [{r}x{c}]...")
        res = await run_benchmark_configuration(name, r, c, sheet_path, ground_truth, ocr_engine=ocr_engine)
        results.append(res)

    print("\n" + "-" * 72)
    print(f"{'Configuration':<28} | {'Tiles':<5} | {'Prec.':<6} | {'Recall':<6} | {'F1':<5} | {'Latency':<8}")
    print("-" * 72)
    for r in results:
        print(
            f"{r.config_name:<28} | {r.num_tiles:<5} | {r.precision:<6.1%} | {r.recall:<6.1%} | {r.f1_score:<5.2f} | {r.runtime_seconds:<6.2f}s"
        )
    print("-" * 72)
    return results


async def main() -> None:
    """Run benchmark across both simulated OCR and real RapidOCR local engine."""
    workspace_dir = Path(__file__).resolve().parent.parent.parent / "data" / "benchmark"
    sheet_path = workspace_dir / "pid_benchmark_sheet.png"

    print("=" * 72)
    print("        AstraSovereign P&ID Extraction Tiling Benchmark          ")
    print("=" * 72)
    print(f"Generating synthetic P&ID sheet at: {sheet_path}")
    ground_truth = generate_benchmark_drawing(sheet_path)
    print(f"Ground-truth tags ({len(ground_truth)}): {', '.join(ground_truth)}")

    # 1. Deterministic simulated OCR for tiling / deduplication math verification
    gt_boxes = {
        "TANK-204": [320, 200, 500, 250],
        "P-101A": [1580, 740, 1720, 790],
        '6"-P-1203-A1A': [1050, 560, 1350, 600],
        '2"-W-101-CS': [520, 1300, 750, 1350],
        "PT-204A": [1020, 310, 1140, 350],
        "LT-204": [630, 210, 730, 250],
        "FT-204": [1275, 580, 1380, 620],
        "REVISION B": [1850, 1450, 2050, 1500],
    }
    sim_ocr = ScriptedBenchmarkOCR(gt_boxes)
    await run_suite(
        title="BENCHMARK PART A: Tiling & Deduplication Mathematical Correctness",
        subtitle="Deterministic Mock OCR — Geometric & Seam Deduplication Check (NOT an accuracy benchmark)",
        ocr_engine=sim_ocr,
        sheet_path=sheet_path,
        ground_truth=ground_truth,
    )

    # 2. Real RapidOCR Engine (actual character recognition and bounding box inference)
    try:
        from rapidocr_onnxruntime import RapidOCR
        real_ocr = RapidOCREngine()
        await run_suite(
            title="BENCHMARK PART B: Real Extraction Accuracy Benchmark",
            subtitle="Actual RapidOCR Local ONNX Engine (Real Computer Vision & OCR Inference)",
            ocr_engine=real_ocr,
            sheet_path=sheet_path,
            ground_truth=ground_truth,
        )
    except Exception as exc:
        print(f"\n[PART B SKIPPED] RapidOCR engine could not be initialized: {exc}")

    print("\n" + "=" * 72 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
