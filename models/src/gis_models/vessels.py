"""AIS vessel and port models for maritime tracking."""

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class VesselPosition(BaseModel):
    """AIS vessel position snapshot from aisstream.io."""

    model_config = ConfigDict(frozen=True, populate_by_name=True)

    id: str
    timestamp: datetime
    mmsi: int = Field(description="Maritime Mobile Service Identity (9 digits)")
    vessel_name: Optional[str] = None
    vessel_type_category: str = Field(
        alias="vessel_type",
        description="crude_tanker, product_tanker, lng_carrier, cargo, etc."
    )
    vessel_subtype: Optional[str] = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    speed_knots: float = Field(ge=0)
    heading_degrees: float = Field(ge=0, le=360)
    current_destination: Optional[str] = Field(default=None, alias="destination")
    flag_state: Optional[str] = None
    provider: str = "aisstream"
    page_content: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("mmsi")
    @classmethod
    def _validate_mmsi(cls, v: int) -> int:
        if not (100_000_000 <= v <= 999_999_999):
            raise ValueError("MMSI must be a 9-digit number")
        return v


class Port(BaseModel):
    """Port reference data with geographic boundary."""

    model_config = ConfigDict(frozen=True, populate_by_name=True)

    id: str
    port_id: str = Field(description="Short ID, e.g. USHOU for Houston")
    name: str
    country: str
    unlocode: str = Field(description="UN/LOCODE, e.g. USHOU")
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    polygon_geojson: Optional[dict] = Field(
        default=None, description="GeoJSON polygon for port boundary"
    )
    primary_commodities: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PortVisit(BaseModel):
    """Detected port visit from AIS position correlation."""

    model_config = ConfigDict(frozen=True, populate_by_name=True)

    visit_id: str
    mmsi: int
    vessel_name: Optional[str] = None
    port_id: str
    port_name: str
    arrival_time: datetime
    departure_time: Optional[datetime] = None
    dwell_hours: Optional[float] = None
    inferred_activity: Optional[str] = Field(
        default=None,
        description="loading, discharging, bunkering, waiting",
    )
    inferred_cargo: Optional[str] = None
    provider: str = "aisstream"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
