"""Typed findings computation and the generalized traceability guard."""

from app.schemas.findings import FindingsObject, TankGeometry, ThicknessReading
from app.services.findings import (
    assess,
    latest_two,
    minimal_thickness_mm,
    traceability_violations,
)


def findings_with(readings):
    return FindingsObject(tank="TANK-204", readings=readings)


def test_course_with_two_dated_readings_gets_a_rate():
    findings = findings_with(
        [
            ThicknessReading(course="C2", value_mm=11.9, survey_date="2021-06-02", source="r2021"),
            ThicknessReading(course="C2", value_mm=10.9, survey_date="2026-08-15", source="r2026"),
        ]
    )
    result = assess(findings, min_thickness_mm=11.36, alert_thickness_mm=12.36)
    course = result.courses[0]
    assert course.status == "REPAIR_REQUIRED"
    assert course.corrosion_rate_mm_per_year is not None
    assert traceability_violations(findings, result) == []


def test_course_without_a_baseline_is_referred_with_no_rate():
    findings = findings_with(
        [ThicknessReading(course="C5", value_mm=11.6, survey_date="2026-08-15", source="r2026")]
    )
    result = assess(findings, min_thickness_mm=11.36, alert_thickness_mm=12.36)
    course = result.courses[0]
    assert course.status == "REFER"
    assert course.corrosion_rate_mm_per_year is None
    assert "not assumed" in course.reason


def test_undated_reading_does_not_count_as_a_baseline():
    findings = findings_with(
        [
            ThicknessReading(course="C3", value_mm=12.2, survey_date=None),
            ThicknessReading(course="C3", value_mm=11.2, survey_date="2026-08-15"),
        ]
    )
    assert latest_two(findings, "C3") is None
    result = assess(findings, min_thickness_mm=11.36, alert_thickness_mm=12.36)
    assert result.courses[0].status == "REFER"
    assert result.courses[0].corrosion_rate_mm_per_year is None


def test_traceability_guard_catches_a_fabricated_rate():
    findings = findings_with(
        [ThicknessReading(course="C5", value_mm=11.6, survey_date="2026-08-15")]
    )
    result = assess(findings, min_thickness_mm=11.36, alert_thickness_mm=12.36)
    result.courses[0].corrosion_rate_mm_per_year = 0.19  # a model wrote a rate anyway
    assert traceability_violations(findings, result) == ["C5"]


def test_minimal_thickness_requires_complete_geometry():
    findings = FindingsObject(tank="T", geometry=TankGeometry(diameter_m=25.0))
    assert minimal_thickness_mm(findings) is None
    findings.geometry = TankGeometry(
        diameter_m=25.0,
        fill_height_m=13.0,
        specific_gravity=0.85,
        allowable_stress_mpa=137.0,
        joint_efficiency=0.85,
    )
    assert minimal_thickness_mm(findings) == 11.36
