"""Verification that findings formula computes the expected minimal thickness.

The product computes the minimum thickness in `app.services.findings`.
This pins the calculation for the fixture geometry.
"""

from app.schemas.findings import FindingsObject, TankGeometry
from app.services.findings import minimal_thickness_mm

TANK_GEOMETRY = {
    "diameter_m": 15.24,
    "fill_height_m": 12.0,
    "specific_gravity": 0.85,
    "allowable_stress_mpa": 160.0,
    "joint_efficiency": 0.85,
}
T_MIN_MM = 5.46


def test_scenario_formula_matches_product_formula():
    findings = FindingsObject(
        geometry=TankGeometry(
            diameter_m=TANK_GEOMETRY["diameter_m"],
            fill_height_m=TANK_GEOMETRY["fill_height_m"],
            specific_gravity=TANK_GEOMETRY["specific_gravity"],
            allowable_stress_mpa=TANK_GEOMETRY["allowable_stress_mpa"],
            joint_efficiency=TANK_GEOMETRY["joint_efficiency"],
        )
    )
    assert minimal_thickness_mm(findings) == T_MIN_MM
