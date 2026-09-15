"""Render the Hard Scenario 01 fixtures from constants.py.

Run from the repo root with the backend venv:

    backend\\.venv\\Scripts\\python.exe tests\\hard_scenario_01\\build_fixtures.py

Outputs (tests/fixtures/hard_scenario_01/):
  inspection_report_2026.pdf   scanned, 4 pages (OCR required)
  inspection_report_2021.pdf   scanned, 2 pages (OCR required)
  SOP-09_Rev3.pdf              current procedure (text)
  SOP-09_Rev2.pdf              superseded distractor (text)
  tank204_nameplate.jpg        nameplate photo (vision/OCR)
  tank204_pid_extract.png      P&ID crop

The reports are rasterised on purpose so RapidOCR/vision have real work, and the
Course 5 cell is struck through with a handwritten correction in the margin.
"""

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

import constants as C

ROOT = Path(__file__).resolve().parents[2]  # repo root
OUT = ROOT / "tests" / "fixtures" / "hard_scenario_01"
OUT.mkdir(parents=True, exist_ok=True)

ARIAL = "C:/Windows/Fonts/arial.ttf"
ARIAL_BOLD = "C:/Windows/Fonts/arialbd.ttf"
HAND = "C:/Windows/Fonts/segoeprb.ttf"

W, H = 1240, 1754  # A4 at 150 dpi
MARGIN = 90


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def scanned_page(draw_fn, noise=6):
    image = Image.new("RGB", (W, H), "white")
    draw = ImageDraw.Draw(image)
    draw_fn(draw)
    # a touch of scanner noise and a slight skew so it is not a clean render
    pixels = image.load()
    for _ in range(W * H // 2000):
        x, y = random.randint(0, W - 1), random.randint(0, H - 1)
        level = random.randint(200, 250)
        pixels[x, y] = (level, level, level)
    image = image.rotate(-0.4, expand=True, fillcolor="white")
    return image


def write_report_header(draw, title, date_text, inspection_id):
    draw.text((MARGIN, 70), "MRPL - MECHANICAL MAINTENANCE", font=font(ARIAL_BOLD, 24), fill="black")
    draw.text((MARGIN, 110), title, font=font(ARIAL_BOLD, 30), fill="black")
    draw.text((MARGIN, 160), f"Survey date: {date_text}", font=font(ARIAL, 22), fill="black")
    draw.text((MARGIN, 190), f"Inspection ref: {inspection_id}", font=font(ARIAL, 22), fill="black")
    draw.line([(MARGIN, 230), (W - MARGIN, 230)], fill="black", width=2)


def report_2026_page1(draw):
    write_report_header(draw, "Ultrasonic Thickness Survey - TANK-204", "2026-08-15", "UT/204/2026-08")
    draw.text((MARGIN, 260), "Shell course thickness (ultrasonic, single reading)", font=font(ARIAL, 20), fill="black")
    x0, y0 = MARGIN, 310
    col = [x0, x0 + 320, x0 + 640]
    row_h = 70
    for i in range(8):
        draw.line([(MARGIN, y0 + i * row_h), (W - MARGIN, y0 + i * row_h)], fill="black", width=1)
    draw.line([(col[0], y0), (col[0], y0 + 7 * row_h)], fill="black", width=1)
    draw.line([(col[1], y0), (col[1], y0 + 7 * row_h)], fill="black", width=1)
    draw.line([(col[2], y0), (col[2], y0 + 7 * row_h)], fill="black", width=1)
    draw.text((col[0] + 15, y0 + 20), "Course", font=font(ARIAL_BOLD, 20), fill="black")
    draw.text((col[1] + 15, y0 + 20), "Thickness (mm)", font=font(ARIAL_BOLD, 20), fill="black")
    draw.text((col[2] + 15, y0 + 20), "Remarks", font=font(ARIAL_BOLD, 20), fill="black")
    rows = [
        ("C1", "13.4", ""),
        ("C2", "10.9", ""),
        ("C3", "11.2", ""),
        ("C4", "12.8", ""),
        ("C5", "10.4", "re-shot"),
        ("C6", "0.455 in", "as reported"),
    ]
    for index, (course, value, remark) in enumerate(rows, start=1):
        y = y0 + index * row_h + 20
        draw.text((col[0] + 15, y), course, font=font(ARIAL_BOLD, 28), fill="black")
        draw.text((col[1] + 15, y), value, font=font(ARIAL, 20), fill="black")
        draw.text((col[2] + 15, y), remark, font=font(ARIAL, 18), fill="black")
    # Strike through the printed Course 5 value and hand-write the correction.
    y5 = y0 + 5 * row_h + 34
    value_x = col[1] + 15
    draw.line([(value_x, y5 + 6), (value_x + 110, y5 + 6)], fill="black", width=3)
    draw.text((value_x + 160, y5 - 14), "11.6", font=font(HAND, 50), fill=(0, 0, 140))


def report_2026_page2(draw):
    write_report_header(draw, "Ultrasonic Thickness Survey - TANK-204", "2026-08-15", "UT/204/2026-08")
    notes = [
        "Notes:",
        "- Readings taken with a 5 MHz dual-element probe.",
        "- Values below the SOP-09 retirement limit require engineering review.",
        "- Course 6 recorded in inches by the field instrument; convert as needed.",
        "- Course 5 required a repeat shot after a probe fault.",
    ]
    y = 280
    for note in notes:
        draw.text((MARGIN, y), note, font=font(ARIAL, 22), fill="black")
        y += 42


def report_2026_page3(draw):
    write_report_header(draw, "Ultrasonic Thickness Survey - TANK-204", "2026-08-15", "UT/204/2026-08")
    draw.text((MARGIN, 280), "Inspector's note (handwritten):", font=font(ARIAL, 22), fill="black")
    draw.text(
        (MARGIN, 340),
        "Course 5 re-shot after probe fault - use 11.6.",
        font=font(HAND, 52),
        fill=(0, 0, 140),
    )
    draw.text(
        (MARGIN, 440),
        "(initial: K. Menon, 15 Aug 2026)",
        font=font(HAND, 34),
        fill=(0, 0, 140),
    )


def report_2026_page4(draw):
    write_report_header(draw, "Ultrasonic Thickness Survey - TANK-204", "2026-08-15", "UT/204/2026-08")
    draw.text((MARGIN, 280), "Scope: full shell, courses 1 to 6, spot grid 200 mm.", font=font(ARIAL, 22), fill="black")
    draw.text((MARGIN, 330), "Prepared by: K. Menon (NDT Level II)", font=font(ARIAL, 22), fill="black")
    draw.text((MARGIN, 380), "Reviewed by: S. Rao (Inspection Engineer)", font=font(ARIAL, 22), fill="black")


def report_2021_page1(draw):
    write_report_header(draw, "Ultrasonic Thickness Survey - TANK-204", "2021-06-02", "UT/204/2021-06")
    draw.text((MARGIN, 260), "Shell course thickness (ultrasonic, single reading)", font=font(ARIAL, 20), fill="black")
    x0, y0 = MARGIN, 310
    col = [x0, x0 + 320, x0 + 640]
    row_h = 70
    for i in range(8):
        draw.line([(MARGIN, y0 + i * row_h), (W - MARGIN, y0 + i * row_h)], fill="black", width=1)
    for c in col:
        draw.line([(c, y0), (c, y0 + 7 * row_h)], fill="black", width=1)
    draw.text((col[0] + 15, y0 + 20), "Course", font=font(ARIAL_BOLD, 20), fill="black")
    draw.text((col[1] + 15, y0 + 20), "Thickness (mm)", font=font(ARIAL_BOLD, 20), fill="black")
    draw.text((col[2] + 15, y0 + 20), "Remarks", font=font(ARIAL_BOLD, 20), fill="black")
    rows = [
        ("C1", "14.1", ""),
        ("C2", "11.9", ""),
        ("C3", "12.2", ""),
        ("C4", "13.6", ""),
        ("C5", "-", "not accessible - scaffold unavailable"),
        ("C6", "12.4", ""),
    ]
    for index, (course, value, remark) in enumerate(rows, start=1):
        y = y0 + index * row_h + 20
        draw.text((col[0] + 15, y), course, font=font(ARIAL_BOLD, 28), fill="black")
        draw.text((col[1] + 15, y), value, font=font(ARIAL, 20), fill="black")
        draw.text((col[2] + 15, y), remark, font=font(ARIAL, 18), fill="black")


def report_2021_page2(draw):
    write_report_header(draw, "Ultrasonic Thickness Survey - TANK-204", "2021-06-02", "UT/204/2021-06")
    draw.text((MARGIN, 280), "Course 5 could not be surveyed this interval.", font=font(ARIAL, 22), fill="black")
    draw.text((MARGIN, 330), "Scaffold unavailable; defer to next survey.", font=font(ARIAL, 22), fill="black")
    draw.text((MARGIN, 400), "Prepared by: K. Menon (NDT Level II)", font=font(ARIAL, 22), fill="black")


def save_scanned_pdf(path, pages):
    images = [scanned_page(fn) for fn in pages]
    images[0].save(path, "PDF", resolution=150, save_all=True, append_images=images[1:])


def sop_rev3(path):
    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4

    def para(text, size=12, leading=17):
        nonlocal y
        c.setFont("Helvetica", size)
        c.drawString(25 * mm, y, text)
        y -= leading

    c.setFont("Helvetica-Bold", 16)
    c.drawString(25 * mm, height - 30 * mm, "SOP-09 Rev 3 — Tank Shell Evaluation Procedure")
    y = height - 45 * mm
    para("MRPL Mechanical Maintenance. Effective 2025-01-10.", 10)
    y -= 6
    para("1. Symbols", 13)
    para("D = nominal tank diameter (m)   H = maximum fill height (m)")
    para("G = product specific gravity     S = allowable shell stress (MPa)")
    para("E = welded joint efficiency")
    y -= 6
    para("2. Minimum required shell thickness (one-foot method)", 13)
    para("t_min = 4.9 x D x (H - 0.3) x G / (S x E)   [mm]")
    y -= 6
    para("3. Thresholds (two distinct limits)", 13)
    para("Retirement thickness t_ret = t_min. A course below t_ret requires repair or re-rating.")
    para("Alert thickness t_alert = t_min + 1.0 mm. A course below t_alert but at or above t_ret")
    para("requires increased monitoring.")
    y -= 6
    para("4. Corrosion rate", 13)
    para("CR = (previous thickness - current thickness) / years between surveys   [mm/year]")
    para("Where no previous reading exists, the corrosion rate shall not be assumed; the")
    para("course is referred for engineering review.")
    y -= 6
    para("5. Remaining life", 13)
    para("RL = (current thickness - t_min) / CR   [years]")
    y -= 6
    para("6. Next inspection interval", 13)
    para("Interval = lesser of (RL / 2) and 15 years. The 15-year cap applies.")
    y -= 6
    para("7. Worked example", 13)
    para("For D=25.0 m, H=13.0 m, G=0.85, S=137 MPa, E=0.85:")
    para("t_min = 4.9 x 25.0 x 12.7 x 0.85 / (137 x 0.85) = 11.36 mm")
    para("t_alert = 11.36 + 1.0 = 12.36 mm")
    c.showPage()
    c.save()


def sop_rev2(path):
    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    c.setFont("Helvetica-Bold", 16)
    c.drawString(25 * mm, height - 30 * mm, "SOP-09 Rev 2 — Tank Shell Evaluation Procedure")
    c.setFont("Helvetica-Bold", 13)
    c.setFillColorRGB(0.7, 0, 0)
    c.drawString(25 * mm, height - 40 * mm, "SUPERSEDED BY REV 3")
    c.setFillColorRGB(0, 0, 0)

    def para(text, size=12, leading=17):
        nonlocal y
        c.setFont("Helvetica", size)
        c.drawString(25 * mm, y, text)
        y -= leading

    y = height - 55 * mm
    para("Superseded procedure. Retained for reference only.", 10)
    y -= 6
    para("Minimum thickness: t_min = 4.9 x D x (H - 0.3) x G / (S x E)")
    y -= 6
    para("Thresholds: retirement = t_min; alert = t_min + 2.0 mm.")
    y -= 6
    para("Corrosion rate = (previous - current) / years between surveys.")
    para("Remaining life = (current - t_min) / corrosion rate.")
    para("Next inspection interval = lesser of (RL / 2) and 10 years.")
    c.showPage()
    c.save()


def nameplate(path):
    image = Image.new("RGB", (1200, 800), (168, 172, 176))
    draw = ImageDraw.Draw(image)
    draw.rectangle([20, 20, 1180, 780], outline=(90, 95, 100), width=6)
    draw.rectangle([120, 110, 1080, 700], outline=(70, 75, 80), width=3)
    lines = [
        "PRESSURE VESSEL / STORAGE TANK",
        f"TAG: {C.TANK['tag']}",
        f"SERVICE: {C.TANK['service']}",
        f"MATERIAL: {C.TANK['material']}",
        f"DIAMETER D: {C.TANK['diameter_m']:.1f} m",
        f"HEIGHT H: {C.TANK['fill_height_m']:.1f} m",
        f"DESIGN SG: {C.TANK['specific_gravity']:.2f}",
        f"ALLOWABLE STRESS S: {C.TANK['allowable_stress_mpa']:.0f} MPa",
        f"JOINT EFFICIENCY E: {C.TANK['joint_efficiency']:.2f}",
        "MFG YEAR: 2011",
    ]
    y = 150
    for index, line in enumerate(lines):
        draw.text((160, y), line, font=font(ARIAL_BOLD if index < 4 else ARIAL, 34), fill=(20, 30, 40))
        y += 58
    pixels = image.load()
    for _ in range(4000):
        x, y = random.randint(0, 1199), random.randint(0, 799)
        r, g, b = pixels[x, y]
        delta = random.randint(-25, 25)
        pixels[x, y] = (max(0, min(255, r + delta)), max(0, min(255, g + delta)), max(0, min(255, b + delta)))
    image.save(path, quality=88)


def pid_extract(path):
    image = Image.new("RGB", (1000, 620), "white")
    draw = ImageDraw.Draw(image)
    draw.rectangle([60, 120, 360, 500], outline="black", width=4)
    draw.text((120, 80), "TANK-204", font=font(ARIAL_BOLD, 28), fill="black")
    draw.text((90, 300), "25.0 m DIA", font=font(ARIAL, 22), fill="black")
    draw.text((90, 340), "13.0 m HT", font=font(ARIAL, 22), fill="black")
    draw.line([(360, 260), (720, 260)], fill="black", width=5)
    draw.line([(720, 260), (720, 120)], fill="black", width=5)
    draw.ellipse([700, 90, 760, 150], outline="black", width=4)
    draw.text((770, 100), "LT-204", font=font(ARIAL, 20), fill="black")
    draw.ellipse([520, 230, 580, 290], outline="black", width=4)
    draw.text((500, 300), "FT-204", font=font(ARIAL, 20), fill="black")
    draw.text((400, 520), "P&ID extract — TANK-204 and connected lines", font=font(ARIAL, 20), fill="black")
    image.save(path)


if __name__ == "__main__":
    save_scanned_pdf(
        OUT / "inspection_report_2026.pdf",
        [report_2026_page1, report_2026_page2, report_2026_page3, report_2026_page4],
    )
    save_scanned_pdf(
        OUT / "inspection_report_2021.pdf",
        [report_2021_page1, report_2021_page2],
    )
    sop_rev3(OUT / "SOP-09_Rev3.pdf")
    sop_rev2(OUT / "SOP-09_Rev2.pdf")
    nameplate(OUT / "tank204_nameplate.jpg")
    pid_extract(OUT / "tank204_pid_extract.png")
    for item in sorted(OUT.iterdir()):
        print(f"{item.name}: {item.stat().st_size} bytes")
