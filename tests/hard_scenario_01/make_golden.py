"""Build a known-good deliverable set from the answer key, to self-test verify.py.

    python make_golden.py <out_dir>

Produces golden.docx/golden.xlsx/golden.pptx plus golden_trace.json so the
verifier can be validated independently of any model run.
"""

import asyncio
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(ROOT / "backend"))

import constants as C  # noqa: E402
from app.schemas.document_content import (  # noqa: E402
    ApprovalNote,
    ApprovalSignature,
    DocumentContent,
    DocumentImage,
    DocumentSection,
)
from app.schemas.presentation import PresentationContent  # noqa: E402
from app.services.document_generator import (  # noqa: E402
    WordDocumentGenerator,
    XlsxDocumentGenerator,
)
from app.services.presentation_renderer import NodePresentationRenderer  # noqa: E402

HEADER = [
    "Course",
    "Current (mm)",
    "Previous (mm)",
    "Corrosion Rate (mm/yr)",
    "Remaining Life (yr)",
    "Next Inspection (yr)",
    "Status",
]


def rows():
    out = []
    for course in C.COURSES:
        entry = C.EXPECTED[course]
        out.append(
            [
                f"C{course}",
                f"{entry['current_mm']:.2f}",
                "-" if entry["previous_mm"] is None else f"{entry['previous_mm']:.2f}",
                "-"
                if entry["corrosion_rate_mm_per_year"] is None
                else f"{entry['corrosion_rate_mm_per_year']:.2f}",
                "-"
                if entry["remaining_life_years"] is None
                else f"{entry['remaining_life_years']:.2f}",
                "-"
                if entry["next_inspection_years"] is None
                else f"{entry['next_inspection_years']:.2f}",
                entry["status"],
            ]
        )
    return out


def build_docx(out_dir: Path, image: Path) -> None:
    approval = ApprovalNote(
        reference_number="MRPL/OPS/2026/101",
        date="2026-08-20",
        originator="Inspection Department",
        department="Mechanical Maintenance",
        subject="Tank 204 fitness-for-service assessment per SOP-09 Rev 3",
        background=(
            "Assessed per SOP-09 Rev 3. Retirement thickness "
            f"{C.T_MIN_MM} mm; alert threshold {C.T_ALERT_MM} mm. "
            "Course 5 was re-shot after a probe fault (corrected 11.6 mm) but has no "
            "2021 baseline, so no corrosion rate may be assumed."
        ),
        recommendation=(
            "Repair courses 2 and 3 (below retirement); monitor course 6 at the alert "
            "threshold; refer course 5 for engineering review because no previous "
            "reading exists."
        ),
        signatures=[ApprovalSignature(name="S. Rao", designation="Inspection Engineer", date="2026-08-20")],
    )
    content = DocumentContent(
        document_type="approval_note",
        title="Tank 204 Fitness-for-Service Approval Note",
        classification="INTERNAL",
        approval=approval,
        sections=[
            DocumentSection(
                heading="Findings",
                paragraphs=[
                    "Method: SOP-09 Rev 3, one-foot method. Alert and retirement "
                    "thresholds both applied. Nameplate basis: D = 25.0 m, H = 13.0 m, "
                    "G = 0.85, S = 137 MPa, E = 0.85. Course 6 reported in inches "
                    "(0.455 in = 11.56 mm)."
                ],
                table=[HEADER, *rows()],
                images=[DocumentImage(path=str(image), caption="Figure 1: Tank 204 P&ID crop.", width_inches=5.5)],
            )
        ],
        sources=["SOP-09 Rev 3", "inspection_report_2026.pdf", "inspection_report_2021.pdf"],
    )
    asyncio.run(WordDocumentGenerator().generate(content, out_dir, "golden.docx"))


def build_xlsx(out_dir: Path) -> None:
    content = DocumentContent(
        document_type="spreadsheet",
        title="Tank 204 Fitness-for-Service Calculations",
        classification="INTERNAL",
        sections=[DocumentSection(heading="Assessment", table=[HEADER, *rows()])],
        sources=["SOP-09 Rev 3"],
    )
    asyncio.run(XlsxDocumentGenerator().generate(content, out_dir, "golden.xlsx"))


def build_pptx(out_dir: Path) -> None:
    table = [HEADER, *rows()]
    slides = [
        {"type": "title", "title": "Tank 204 Fitness-for-Service", "content": "Per SOP-09 Rev 3"},
        {
            "type": "bullets",
            "title": "Findings",
            "bullets": [
                f"Retirement {C.T_MIN_MM} mm; alert {C.T_ALERT_MM} mm",
                "Courses 2 and 3 below retirement - repair",
                "Course 6 at alert threshold - monitor",
                "Course 5 referred: no 2021 baseline, no rate assumed",
            ],
        },
        {"type": "table", "title": "Assessment", "table": table},
        {"type": "sources", "title": "Sources", "sources": ["SOP-09 Rev 3"]},
    ]
    content = PresentationContent.model_validate({"title": "Tank 204", "slides": slides})
    NodePresentationRenderer().generate(content, out_dir, "golden.pptx")


def main() -> None:
    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "_golden"
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)
    image = ROOT / "tests" / "fixtures" / "hard_scenario_01" / "tank204_pid_extract.png"
    build_docx(out_dir, image)
    build_xlsx(out_dir)
    build_pptx(out_dir)
    (out_dir / "golden_trace.json").write_text(
        json.dumps({"execution_trace": [{"type": "tool_call", "tool": "code_execution"}]}),
        encoding="utf-8",
    )
    print(out_dir)


if __name__ == "__main__":
    main()
