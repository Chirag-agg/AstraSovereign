"""Deterministic findings computation and traceability guard.

`compute` never trusts a corrosion rate the model wrote in prose. Every rate is
derived from two dated readings of the same course in the typed findings object;
a course without two dated readings is referred for engineering review with no
rate at all. This is the generalized version of the Course 5 trap.
"""

from datetime import date
from typing import Optional

from app.schemas.findings import (
    AssessmentResult,
    CourseAssessment,
    FindingsObject,
    ThicknessReading,
)


def _as_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        return None


def dated_readings(findings: FindingsObject, course: str) -> list[ThicknessReading]:
    dated = [
        reading
        for reading in findings.readings
        if reading.course == course and _as_date(reading.survey_date) is not None
    ]
    return sorted(dated, key=lambda reading: _as_date(reading.survey_date))


def latest_two(findings: FindingsObject, course: str) -> Optional[tuple]:
    """The two most recent dated readings for a course, or ``None``."""
    dated = dated_readings(findings, course)
    if len(dated) < 2:
        return None
    return dated[-2], dated[-1]


def minimal_thickness_mm(findings: FindingsObject) -> Optional[float]:
    geometry = findings.geometry
    required = (
        geometry.diameter_m,
        geometry.fill_height_m,
        geometry.specific_gravity,
        geometry.allowable_stress_mpa,
        geometry.joint_efficiency,
    )
    if any(value is None for value in required):
        return None
    return round(
        4.9
        * geometry.diameter_m
        * (geometry.fill_height_m - 0.3)
        * geometry.specific_gravity
        / (geometry.allowable_stress_mpa * geometry.joint_efficiency),
        2,
    )


def assess(
    findings: FindingsObject,
    min_thickness_mm: Optional[float],
    alert_thickness_mm: Optional[float],
    interval_cap_years: float = 15.0,
) -> AssessmentResult:
    result = AssessmentResult(
        min_thickness_mm=min_thickness_mm, alert_thickness_mm=alert_thickness_mm
    )
    for course in sorted({reading.course for reading in findings.readings}):
        pair = latest_two(findings, course)
        if pair is None:
            result.courses.append(
                CourseAssessment(
                    course=course,
                    status="REFER",
                    reason=(
                        "fewer than two dated readings; corrosion rate not assumed "
                        "(referred for engineering review)"
                    ),
                )
            )
            continue
        previous, current = pair
        span = (_as_date(current.survey_date) - _as_date(previous.survey_date)).days / 365.25
        if span <= 0:
            result.courses.append(
                CourseAssessment(
                    course=course,
                    current_mm=current.value_mm,
                    status="REFER",
                    reason="survey dates are not increasing",
                )
            )
            continue
        rate = round((previous.value_mm - current.value_mm) / span, 2)
        assessment = CourseAssessment(
            course=course,
            current_mm=current.value_mm,
            previous_mm=previous.value_mm,
            corrosion_rate_mm_per_year=rate,
        )
        if min_thickness_mm is not None and current.value_mm < min_thickness_mm:
            assessment.status = "REPAIR_REQUIRED"
            assessment.reason = "below retirement thickness"
        else:
            if rate > 0 and min_thickness_mm is not None:
                assessment.remaining_life_years = round(
                    (current.value_mm - min_thickness_mm) / rate, 2
                )
                assessment.next_inspection_years = round(
                    min(assessment.remaining_life_years / 2, interval_cap_years), 2
                )
            else:
                assessment.reason = "no positive corrosion rate"
            if (
                min_thickness_mm is not None
                and alert_thickness_mm is not None
                and current.value_mm < alert_thickness_mm
            ):
                assessment.status = "ALERT"
            elif assessment.status != "REPAIR_REQUIRED":
                assessment.status = "OK"
        result.courses.append(assessment)
    return result


def traceability_violations(
    findings: FindingsObject, result: AssessmentResult
) -> list[str]:
    """Courses carrying a numeric rate without two dated readings backing it."""
    return [
        assessment.course
        for assessment in result.courses
        if assessment.corrosion_rate_mm_per_year is not None
        and latest_two(findings, assessment.course) is None
    ]
