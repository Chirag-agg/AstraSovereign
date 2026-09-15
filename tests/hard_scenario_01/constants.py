"""Hard Scenario 01 — SOURCE OF TRUTH for fixtures and scoring.

Tank 204 API 653 fitness-for-service assessment. `build_fixtures.py` renders the
PDFs/JPG/PNG from these values and `verify.py` scores generated deliverables
against them, so there is exactly one place to change the numbers.

PROVISIONAL / NEEDS DOMAIN VALIDATION
-------------------------------------
These synthetic values follow the API 653 one-foot method as written in SOP-09
Rev 3, but they are *not* certified. Before any benchmark score is trusted, an
engineer with the real MRPL standard must confirm:

  * the minimum-thickness formula and its constant (4.9),
  * the nameplate geometry/stress/joint-efficiency values,
  * the alert threshold rule (t_min + 1.0 mm) and the 15-year interval cap,
  * the 2021 baseline readings and the survey interval (5.20 years).

Fix the values here, re-run `build_fixtures.py`, and both the fixtures and the
expected results move together.
"""

from datetime import date, timedelta

NAME = "Hard Scenario 01 — Tank 204 API 653 Fitness-for-Service"

# --- Tank 204 nameplate: appears ONLY in tank204_nameplate.jpg ---------------
TANK = {
    "tag": "TANK-204",
    "service": "Crude wash water",
    "material": "SA-516 Gr 70",
    "diameter_m": 25.0,
    "fill_height_m": 13.0,
    "specific_gravity": 0.85,
    "allowable_stress_mpa": 137.0,
    "joint_efficiency": 0.85,
}

# --- SOP-09 Rev 3 (current) --------------------------------------------------
SOP = {
    "revision": "3",
    "effective": "2025-01-10",
    "diameter_symbol": "D",
    "fill_symbol": "H",
    "gravity_symbol": "G",
    "stress_symbol": "S",
    "eff_symbol": "E",
    "formula_constant": 4.9,
    "alert_margin_mm": 1.0,
    "interval_cap_years": 15.0,
    "monitoring_interval_years": 1.0,
}

# SOP-09 Rev 2 (superseded) — different thresholds and cap, pure distractor.
SOP_REV2 = {
    "revision": "2",
    "effective": "2021-04-01",
    "formula_constant": 4.9,
    "alert_margin_mm": 2.0,
    "interval_cap_years": 10.0,
}

SURVEY_2026 = date(2026, 8, 15)
SURVEY_2021 = date(2021, 6, 2)
YEARS_BETWEEN_SURVEYS = 5.20
INCH_TO_MM = 25.4

# 2026 field readings as they appear in the scan. Course 5 shows a struck-through
# printed value with a handwritten correction; Course 6 is reported in inches.
READINGS_2026 = {
    "1": {"printed_mm": 13.4},
    "2": {"printed_mm": 10.9},
    "3": {"printed_mm": 11.2},
    "4": {"printed_mm": 12.8},
    "5": {"struck_mm": 10.4, "handwritten_mm": 11.6},
    "6": {"printed_in": 0.455},
}

# 2021 baseline. Course 5 is absent (page marked "not accessible").
READINGS_2021 = {
    "1": 14.1,
    "2": 11.9,
    "3": 12.2,
    "4": 13.6,
    "6": 12.4,
}

COURSES = ["1", "2", "3", "4", "5", "6"]


def minimum_thickness_mm() -> float:
    """API 653 one-foot method, metric (t in mm, D/H in m, S in MPa)."""
    return round(
        SOP["formula_constant"]
        * TANK["diameter_m"]
        * (TANK["fill_height_m"] - 0.3)
        * TANK["specific_gravity"]
        / (TANK["allowable_stress_mpa"] * TANK["joint_efficiency"]),
        2,
    )


def alert_thickness_mm() -> float:
    return round(minimum_thickness_mm() + SOP["alert_margin_mm"], 2)


def current_reading_mm(course: str) -> float:
    raw = READINGS_2026[course]
    if "handwritten_mm" in raw:
        return raw["handwritten_mm"]
    if "printed_in" in raw:
        return round(raw["printed_in"] * INCH_TO_MM, 2)
    return raw["printed_mm"]


def expected_results() -> dict:
    """Per-course expected values, computed once from the source of truth."""
    t_min = minimum_thickness_mm()
    t_alert = alert_thickness_mm()
    results = {}
    for course in COURSES:
        current = current_reading_mm(course)
        entry = {
            "course": course,
            "current_mm": current,
            "previous_mm": READINGS_2021.get(course),
            "corrosion_rate_mm_per_year": None,
            "remaining_life_years": None,
            "next_inspection_years": None,
            "next_inspection_date": None,
            "status": None,
        }
        if course == "5":
            entry["status"] = "REFER_TO_ENGINEERING"
            results[course] = entry
            continue

        previous = READINGS_2021[course]
        rate = round((previous - current) / YEARS_BETWEEN_SURVEYS, 2)
        entry["corrosion_rate_mm_per_year"] = rate
        if current < t_min:
            entry["status"] = "REPAIR_REQUIRED"
        else:
            remaining = round((current - t_min) / rate, 2) if rate > 0 else None
            entry["remaining_life_years"] = remaining
            if remaining is not None:
                interval = round(min(remaining / 2.0, SOP["interval_cap_years"]), 2)
                entry["next_inspection_years"] = interval
                entry["next_inspection_date"] = (
                    SURVEY_2026 + timedelta(days=round(interval * 365.25))
                ).isoformat()
            entry["status"] = "ALERT" if current < t_alert else "OK"
        results[course] = entry
    return results


T_MIN_MM = minimum_thickness_mm()
T_ALERT_MM = alert_thickness_mm()
EXPECTED = expected_results()

if __name__ == "__main__":
    print(f"minimum thickness = {T_MIN_MM} mm   alert = {T_ALERT_MM} mm")
    for course in COURSES:
        print(course, EXPECTED[course])
