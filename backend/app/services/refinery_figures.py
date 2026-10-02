"""Deterministic figure generation for refinery inspection decks.

Every function here takes structured data (a :class:`FindingsObject`, an
:class:`AssessmentResult`, or plain Python primitives extracted from those
objects) and returns PNG bytes that can be embedded directly into a slide via
``render_data_uri_normalized``.

No model is involved.  No network calls are made.  Figures are drawn with
pure Pillow — no cairosvg or external SVG renderer required.

Available figures
-----------------
thickness_bar_chart(findings, result)
    Bar chart: measured thickness per course, retirement-limit line, colour
    coding (green = OK, amber = ALERT, red = REPAIR_REQUIRED, grey = REFER).

remaining_life_timeline(result)
    Horizontal timeline: one labelled bar per course that has a computed
    remaining-life value, drawn to a common time axis.

equipment_schematic(findings, result=None)
    Simple tank schematic: a cylindrical silhouette with per-course band
    colouring, callout lines, and thickness + status annotations.
"""

from __future__ import annotations

import io
import math
from typing import Optional

from PIL import Image, ImageDraw, ImageFont

from app.schemas.findings import AssessmentResult, CourseAssessment, FindingsObject

# ---------------------------------------------------------------------------
# Colour palette (RGB tuples)
# ---------------------------------------------------------------------------
_C = {
    "OK":               (34, 139, 34),
    "ALERT":            (217, 119, 6),
    "REPAIR_REQUIRED":  (185, 28, 28),
    "REFER":            (100, 116, 139),
    "LIMIT":            (185, 28, 28),
    "BG":               (248, 250, 252),
    "GRID":             (203, 213, 225),
    "TEXT":             (15, 23, 42),
    "MUTED":            (71, 85, 105),
    "ACCENT":           (31, 59, 87),
    "CANVAS":           (255, 255, 255),
}

_STATUS_COLOR: dict[str, tuple[int, int, int]] = {
    "OK":               _C["OK"],
    "ALERT":            _C["ALERT"],
    "REPAIR_REQUIRED":  _C["REPAIR_REQUIRED"],
    "REFER":            _C["REFER"],
}


def _status_color(status: str) -> tuple[int, int, int]:
    return _STATUS_COLOR.get(status, _C["REFER"])


def _load_font(size: int) -> ImageFont.ImageFont:
    """Best-effort font loader; falls back to Pillow's built-in default."""
    for name in ("arial.ttf", "Arial.ttf", "DejaVuSans.ttf",
                 "LiberationSans-Regular.ttf", "FreeSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except (OSError, IOError):
            pass
    return ImageFont.load_default()


def _text_width(draw: ImageDraw.ImageDraw, text: str, font) -> int:
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        return bbox[2] - bbox[0]
    except AttributeError:
        return draw.textsize(text, font=font)[0]  # type: ignore[attr-defined]


def _to_png_bytes(image: Image.Image) -> bytes:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Tier 1 figure 1 — thickness bar chart
# ---------------------------------------------------------------------------

def thickness_bar_chart(
    findings: FindingsObject,
    result: AssessmentResult,
    *,
    width: int = 960,
    height: int = 540,
) -> bytes:
    """Bar chart of measured thickness per course with retirement-limit line.

    Returns PNG bytes (lossless).  Courses appear left-to-right in sorted
    order, colour-coded by assessment status.  A dashed horizontal line marks
    the retirement-limit threshold; a solid line marks the alert threshold.
    """
    courses = sorted({a.course for a in result.courses})
    if not courses:
        return _empty_png(width, height, "No course data available")

    assessments: dict[str, CourseAssessment] = {a.course: a for a in result.courses}
    values = [a.current_mm for a in result.courses if a.current_mm is not None]
    limit = result.min_thickness_mm
    alert = result.alert_thickness_mm
    all_vals = list(values) + ([limit] if limit else []) + ([alert] if alert else [])
    if not all_vals:
        return _empty_png(width, height, "No thickness readings")

    y_max = max(all_vals) * 1.25
    y_min = 0.0
    pad_l, pad_r, pad_t, pad_b = 90, 30, 50, 70
    chart_w = width - pad_l - pad_r
    chart_h = height - pad_t - pad_b
    n = len(courses)
    bar_group_w = chart_w / n
    bar_w = bar_group_w * 0.6
    bar_gap = (bar_group_w - bar_w) / 2

    image = Image.new("RGB", (width, height), _C["BG"])
    draw = ImageDraw.Draw(image)
    draw.rectangle([pad_l, pad_t, pad_l + chart_w, pad_t + chart_h], fill=_C["CANVAS"])

    font_sm = _load_font(11)
    font_title = _load_font(15)

    title = f"Shell Thickness by Course — {findings.tank or 'Tank'}"
    draw.text((width // 2 - _text_width(draw, title, font_title) // 2, 14),
              title, fill=_C["TEXT"], font=font_title)

    # Y-axis grid + labels
    for i in range(6):
        val = y_min + (y_max - y_min) * i / 5
        y_px = pad_t + chart_h - int(chart_h * (val - y_min) / (y_max - y_min))
        draw.line([(pad_l, y_px), (pad_l + chart_w, y_px)], fill=_C["GRID"], width=1)
        label = f"{val:.1f}"
        draw.text((pad_l - _text_width(draw, label, font_sm) - 6, y_px - 7),
                  label, fill=_C["MUTED"], font=font_sm)
    draw.text((4, pad_t + chart_h // 2 - 12), "mm", fill=_C["MUTED"], font=font_sm)

    def _vy(v: float) -> int:
        return pad_t + chart_h - int(chart_h * (v - y_min) / (y_max - y_min))

    # Bars
    for idx, course in enumerate(courses):
        a = assessments.get(course)
        x0 = pad_l + int(idx * bar_group_w + bar_gap)
        x1 = x0 + int(bar_w)
        color = _status_color(a.status if a else "REFER")
        if a and a.current_mm is not None:
            y_top = _vy(a.current_mm)
            draw.rectangle([x0, y_top, x1, _vy(y_min)], fill=color)
            label = f"{a.current_mm:.1f}"
            lw = _text_width(draw, label, font_sm)
            draw.text((x0 + (x1 - x0) // 2 - lw // 2, y_top - 18),
                      label, fill=_C["TEXT"], font=font_sm)
        else:
            draw.rectangle([x0, _vy(y_max * 0.1), x1, _vy(y_min)], fill=_C["GRID"])
            draw.text((x0 + 2, _vy(y_max * 0.1) - 18), "N/A", fill=_C["MUTED"], font=font_sm)
        cx = x0 + (x1 - x0) // 2
        lw = _text_width(draw, course, font_sm)
        draw.text((cx - lw // 2, pad_t + chart_h + 8), course, fill=_C["TEXT"], font=font_sm)

    # Retirement-limit line (dashed red)
    if limit is not None and y_min <= limit <= y_max:
        y_lim = _vy(limit)
        _dashed_hline(draw, pad_l, pad_l + chart_w, y_lim, _C["LIMIT"])
        label = f"Retirement {limit:.1f} mm"
        lw = _text_width(draw, label, font_sm)
        draw.rectangle([pad_l + chart_w - lw - 14, y_lim - 17,
                        pad_l + chart_w - 2, y_lim - 2], fill=_C["CANVAS"])
        draw.text((pad_l + chart_w - lw - 10, y_lim - 16),
                  label, fill=_C["LIMIT"], font=font_sm)

    # Alert threshold line (dashed amber)
    if alert is not None and y_min <= alert <= y_max:
        y_alert = _vy(alert)
        _dashed_hline(draw, pad_l, pad_l + chart_w, y_alert, _C["ALERT"], dash=6)
        label = f"Alert {alert:.1f} mm"
        draw.text((pad_l + 4, y_alert - 15), label, fill=_C["ALERT"], font=font_sm)

    _draw_legend(draw, font_sm, x=pad_l, y=height - 20)
    draw.line([(pad_l, pad_t), (pad_l, pad_t + chart_h)], fill=_C["TEXT"], width=2)
    draw.line([(pad_l, pad_t + chart_h), (pad_l + chart_w, pad_t + chart_h)],
              fill=_C["TEXT"], width=2)
    return _to_png_bytes(image)


# ---------------------------------------------------------------------------
# Tier 1 figure 2 — remaining-life timeline
# ---------------------------------------------------------------------------

def remaining_life_timeline(
    result: AssessmentResult,
    *,
    width: int = 960,
    height: int = 420,
    max_years: Optional[float] = None,
) -> bytes:
    """Horizontal timeline: one bar per course that has a positive remaining life.

    Courses without a computed remaining life are listed as footnotes so the
    figure is a complete summary, not a cherry-picked subset.
    """
    active = [a for a in result.courses if a.remaining_life_years is not None]
    inactive = [a for a in result.courses if a.remaining_life_years is None]

    if not active and not inactive:
        return _empty_png(width, height, "No assessment data")

    t_max: float
    if active:
        raw_max = max(a.remaining_life_years for a in active)  # type: ignore[arg-type]
        t_max = max_years or math.ceil(raw_max * 1.2)
    else:
        t_max = 1.0

    pad_l, pad_r, pad_t, pad_b = 130, 30, 55, 60
    n_active = max(len(active), 1)
    row_h = max(24, min(50, (height - pad_t - pad_b - len(inactive) * 18) // n_active))
    chart_w = width - pad_l - pad_r
    needed_h = pad_t + n_active * row_h + len(inactive) * 18 + pad_b + 30
    if needed_h > height:
        height = needed_h

    image = Image.new("RGB", (width, height), _C["BG"])
    draw = ImageDraw.Draw(image)

    font_sm = _load_font(11)
    font_md = _load_font(12)
    font_title = _load_font(15)

    title = "Remaining Life by Course (years)"
    draw.text((width // 2 - _text_width(draw, title, font_title) // 2, 14),
              title, fill=_C["TEXT"], font=font_title)

    tick_years = _nice_ticks(t_max, n=6)
    y_axis_bot = pad_t + n_active * row_h

    for yr in tick_years:
        x = pad_l + int(chart_w * yr / t_max)
        draw.line([(x, pad_t), (x, y_axis_bot)], fill=_C["GRID"], width=1)
        label = f"{yr:.0f}y"
        draw.text((x - _text_width(draw, label, font_sm) // 2, y_axis_bot + 4),
                  label, fill=_C["MUTED"], font=font_sm)

    for idx, a in enumerate(sorted(active, key=lambda x: x.course)):
        y_center = pad_t + idx * row_h + row_h // 2
        bar_h = int(row_h * 0.55)
        y_top = y_center - bar_h // 2
        y_bot = y_top + bar_h
        bar_len = min(int(chart_w * a.remaining_life_years / t_max), chart_w)  # type: ignore[arg-type]
        color = _status_color(a.status or "OK")
        draw.rectangle([pad_l, y_top, pad_l + bar_len, y_bot], fill=color)
        if a.next_inspection_years is not None:
            x_ni = pad_l + int(chart_w * a.next_inspection_years / t_max)
            draw.line([(x_ni, y_top - 4), (x_ni, y_bot + 4)], fill=_C["TEXT"], width=2)
        val_label = f"{a.remaining_life_years:.1f} yr"
        draw.text((pad_l + bar_len + 6, y_center - 7), val_label, fill=_C["TEXT"], font=font_sm)
        lw = _text_width(draw, a.course, font_md)
        draw.text((pad_l - lw - 8, y_center - 8), a.course, fill=_C["TEXT"], font=font_md)

    if inactive:
        y_ann = y_axis_bot + 30
        draw.text((pad_l, y_ann - 16), "Without computed life:",
                  fill=_C["MUTED"], font=font_sm)
        for a in sorted(inactive, key=lambda x: x.course):
            reason = (a.reason or a.reason_code or a.status or "—")[:60]
            draw.text((pad_l, y_ann), f"  {a.course}: {reason}",
                      fill=_status_color(a.status), font=font_sm)
            y_ann += 16

    draw.line([(pad_l, pad_t), (pad_l, y_axis_bot)], fill=_C["TEXT"], width=2)
    draw.line([(pad_l, y_axis_bot), (pad_l + chart_w, y_axis_bot)], fill=_C["TEXT"], width=2)
    return _to_png_bytes(image)


# ---------------------------------------------------------------------------
# Tier 1 figure 3 — equipment schematic
# ---------------------------------------------------------------------------

def equipment_schematic(
    findings: FindingsObject,
    result: Optional[AssessmentResult] = None,
    *,
    width: int = 560,
    height: int = 680,
) -> bytes:
    """Simple tank schematic with per-course band colouring and callouts.

    Each horizontal band represents one shell course.  When *result* is
    provided, bands are colour-coded by assessment status; otherwise all bands
    are rendered in the REFER (neutral) colour.
    """
    courses = sorted({r.course for r in findings.readings})
    if not courses:
        return _empty_png(width, height, "No course data")

    status_map: dict[str, str] = {}
    thickness_map: dict[str, Optional[float]] = {}
    if result:
        for a in result.courses:
            status_map[a.course] = a.status
            thickness_map[a.course] = a.current_mm
    else:
        for r in findings.readings:
            thickness_map.setdefault(r.course, r.value_mm)

    n = len(courses)
    tank_x = 60
    tank_w = int(width * 0.45)
    tank_top = 90
    tank_bot = height - 80
    tank_h = tank_bot - tank_top
    band_h = tank_h // n

    image = Image.new("RGB", (width, height), _C["BG"])
    draw = ImageDraw.Draw(image)

    font_sm = _load_font(11)
    font_title = _load_font(15)

    title = f"Equipment Schematic — {findings.tank or 'Tank'}"
    draw.text((width // 2 - _text_width(draw, title, font_title) // 2, 18),
              title, fill=_C["TEXT"], font=font_title)

    g = findings.geometry
    if g.diameter_m:
        geo = f"\u00d8 {g.diameter_m:.2f} m"
        if g.fill_height_m:
            geo += f"  H {g.fill_height_m:.2f} m"
        draw.text((tank_x, tank_top - 26), geo, fill=_C["MUTED"], font=font_sm)

    for idx, course in enumerate(courses):
        y0 = tank_top + idx * band_h
        y1 = y0 + band_h
        status = status_map.get(course, "REFER")
        base_color = _status_color(status)
        tint = tuple(min(255, int(c + (255 - c) * 0.65)) for c in base_color)
        draw.rectangle([tank_x, y0, tank_x + tank_w, y1],
                       fill=tint, outline=base_color, width=2)  # type: ignore[arg-type]
        lw = _text_width(draw, course, font_sm)
        draw.text((tank_x + tank_w // 2 - lw // 2, y0 + (band_h - 14) // 2),
                  course, fill=_C["TEXT"], font=font_sm)
        mid_y = (y0 + y1) // 2
        x_co = tank_x + tank_w + 12
        draw.line([(tank_x + tank_w, mid_y), (x_co, mid_y)], fill=_C["MUTED"], width=1)
        t_mm = thickness_map.get(course)
        val_str = f"{t_mm:.2f} mm" if t_mm is not None else "\u2014"
        ann = f"{val_str}  [{status}]" if status else val_str
        draw.text((x_co + 4, mid_y - 7), ann, fill=base_color, font=font_sm)

    # Tank outline over bands
    draw.rectangle([tank_x, tank_top, tank_x + tank_w, tank_bot],
                   outline=_C["ACCENT"], width=3)
    # Cone roof
    apex = (tank_x + tank_w // 2, tank_top - 24)
    draw.polygon([(tank_x, tank_top), (tank_x + tank_w, tank_top), apex],
                 outline=_C["ACCENT"], fill=_C["CANVAS"])
    draw.line([(tank_x, tank_top), apex], fill=_C["ACCENT"], width=3)
    draw.line([(tank_x + tank_w, tank_top), apex], fill=_C["ACCENT"], width=3)
    # Ground
    draw.line([(tank_x - 12, tank_bot), (tank_x + tank_w + 12, tank_bot)],
              fill=_C["TEXT"], width=3)

    _draw_legend(draw, font_sm, x=tank_x, y=height - 22)
    return _to_png_bytes(image)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _empty_png(width: int, height: int, message: str) -> bytes:
    image = Image.new("RGB", (width, height), _C["BG"])
    draw = ImageDraw.Draw(image)
    font = _load_font(14)
    tw = _text_width(draw, message, font)
    draw.text((width // 2 - tw // 2, height // 2 - 10), message,
              fill=_C["MUTED"], font=font)
    return _to_png_bytes(image)


def _dashed_hline(
    draw: ImageDraw.ImageDraw,
    x0: int,
    x1: int,
    y: int,
    color: tuple[int, int, int],
    dash: int = 8,
) -> None:
    x = x0
    while x < x1:
        draw.line([(x, y), (min(x + dash, x1), y)], fill=color, width=2)
        x += dash * 2


def _draw_legend(draw: ImageDraw.ImageDraw, font, x: int, y: int) -> None:
    items = [
        ("OK", _C["OK"]),
        ("ALERT", _C["ALERT"]),
        ("REPAIR", _C["REPAIR_REQUIRED"]),
        ("REFER", _C["REFER"]),
    ]
    cx = x
    for label, color in items:
        draw.rectangle([cx, y - 10, cx + 12, y + 2], fill=color)
        draw.text((cx + 16, y - 10), label, fill=_C["TEXT"], font=font)
        cx += 16 + _text_width(draw, label, font) + 18


def _nice_ticks(max_val: float, n: int = 6) -> list[float]:
    if max_val <= 0:
        return [0.0]
    raw_step = max_val / n
    magnitude = 10 ** math.floor(math.log10(raw_step))
    step = magnitude
    for factor in (1, 2, 5, 10):
        candidate = factor * magnitude
        if candidate >= raw_step:
            step = candidate
            break
    ticks: list[float] = []
    v = 0.0
    while v <= max_val + step * 0.01:
        ticks.append(round(v, 6))
        v += step
    return ticks
