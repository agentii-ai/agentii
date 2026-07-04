"""Weather data models: historical observations, forecasts, and derived signals."""

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .enums import AnomalyCategory, EnergySignal, WeatherModel, WeatherProvider


class WeatherObservation(BaseModel):
    """Historical weather observation from ERA5 reanalysis (silver layer)."""

    model_config = ConfigDict(frozen=True, populate_by_name=True)

    id: str
    timestamp: datetime
    location_id: str = Field(description="e.g. nyc, chicago, corn_belt_ia")
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    temperature_c: float
    precipitation_mm: float = Field(ge=0)
    windspeed_ms: float = Field(ge=0)
    pressure_hpa: float
    humidity_pct: float = Field(ge=0, le=100)
    provider: str = WeatherProvider.ERA5.value
    page_content: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("temperature_c")
    @classmethod
    def _validate_temp(cls, v: float) -> float:
        if not (-90 <= v <= 60):
            raise ValueError("temperature_c must be between -90 and 60")
        return v


class WeatherForecast(BaseModel):
    """Real-time weather forecast from Open-Meteo (not stored in DB)."""

    model_config = ConfigDict(frozen=True, populate_by_name=True)

    timestamp: datetime
    location_id: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    temperature_c: float
    precipitation_mm: float = Field(ge=0)
    windspeed_ms: float = Field(ge=0)
    forecast_horizon_hours: int = Field(ge=1, le=384)
    model: str = WeatherModel.ECMWF.value
    provider: str = WeatherProvider.OPEN_METEO.value


class TemperatureAnomaly(BaseModel):
    """Temperature anomaly vs. 10-year baseline (gold layer signal)."""

    model_config = ConfigDict(frozen=True, populate_by_name=True)

    location_id: str
    forecast_date: datetime
    forecast_temp_c: float
    baseline_temp_c: float = Field(description="10-year average for this day-of-year")
    baseline_stddev_c: float = Field(description="10-year stddev for this day-of-year")
    anomaly_c: float = Field(description="forecast - baseline")
    z_score: float = Field(description="anomaly / stddev")
    anomaly_category: str = AnomalyCategory.NORMAL.value
    energy_signal: str = EnergySignal.NEUTRAL.value
    interpretation: Optional[str] = Field(
        default=None, description="Agent-readable interpretation text"
    )


class HDDCDDForecast(BaseModel):
    """Heating/Cooling Degree Day forecast for weather derivatives."""

    model_config = ConfigDict(frozen=True, populate_by_name=True)

    latitude: float
    longitude: float
    location_id: Optional[str] = None
    forecast_days: int
    base_temp_f: float = 65.0
    daily: list[dict] = Field(
        default_factory=list,
        description="Per-day breakdown: date, avg_temp_c, avg_temp_f, hdd, cdd",
    )
    cumulative_hdd: float = 0.0
    cumulative_cdd: float = 0.0
    interpretation: Optional[str] = None
