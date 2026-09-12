"""Typed extraction and computation objects for inspection / findings tasks.

The ``extract`` node emits a :class:`FindingsObject` (typed fields, not raw OCR
text); the ``compute`` node consumes it and never re-reads the scanned source.
This is what makes the consistency and traceability rules enforceable in code
instead of trusting the model.
"""

from typing import Optional

from pydantic import BaseModel, Field


class ThicknessReading(BaseModel):
    """One measured shell thickness, with the survey date it came from."""

    course: str
    value_mm: float
    survey_date: Optional[str] = None  # ISO 8601 date, e.g. "2026-08-15"
    source: str = ""  # document id / filename
    note: str = ""


class TankGeometry(BaseModel):
    """Nameplate geometry needed for the minimum-thickness calculation."""

    diameter_m: Optional[float] = None
    fill_height_m: Optional[float] = None
    specific_gravity: Optional[float] = None
    allowable_stress_mpa: Optional[float] = None
    joint_efficiency: Optional[float] = None
    source: str = ""


class FindingsObject(BaseModel):
    """The single structured object every downstream deliverable is built from."""

    tank: str = ""
    procedure: str = ""
    geometry: TankGeometry = Field(default_factory=TankGeometry)
    readings: list[ThicknessReading] = Field(default_factory=list)
    thresholds: dict[str, float] = Field(default_factory=dict)
    notes: list[str] = Field(default_factory=list)


class CourseAssessment(BaseModel):
    """Computed result for one course (produced only from the findings object)."""

    course: str
    current_mm: Optional[float] = None
    previous_mm: Optional[float] = None
    corrosion_rate_mm_per_year: Optional[float] = None
    remaining_life_years: Optional[float] = None
    next_inspection_years: Optional[float] = None
    status: str = ""  # OK | ALERT | REPAIR_REQUIRED | REFER
    reason: str = ""


class AssessmentResult(BaseModel):
    min_thickness_mm: Optional[float] = None
    alert_thickness_mm: Optional[float] = None
    courses: list[CourseAssessment] = Field(default_factory=list)
