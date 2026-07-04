"""EIA petroleum data models: inventory levels and spot prices."""

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class EIAInventory(BaseModel):
    """EIA weekly petroleum inventory (Cushing crude, PADD districts, etc.)."""

    model_config = ConfigDict(frozen=True, populate_by_name=True)

    id: str
    series_id: str = Field(description="EIA series ID, e.g. PET.WCESTUS1.W")
    region: str = Field(description="Cushing, PADD 1, PADD 2, etc.")
    commodity: str = Field(description="crude_oil, gasoline, distillate")
    inventory_level_thousand_barrels: float = Field(alias="value")
    unit: str = "thousand_barrels"
    date: datetime
    weekly_change_thousand_barrels: Optional[float] = Field(
        default=None, alias="weekly_change"
    )
    provider: str = "eia"
    page_content: Optional[str] = None
    labels: Optional[dict] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("inventory_level_thousand_barrels")
    @classmethod
    def _validate_value(cls, v: float) -> float:
        if v < 0:
            raise ValueError("inventory level must be non-negative")
        return v


class EIASpotPrice(BaseModel):
    """EIA spot price for crude oil and refined products."""

    model_config = ConfigDict(frozen=True, populate_by_name=True)

    id: str
    series_id: str
    commodity: str = Field(description="wti, brent, rbob, heating_oil")
    price_usd: float = Field(alias="price")
    unit: str = "usd_per_barrel"
    date: datetime
    daily_change_usd: Optional[float] = Field(default=None, alias="daily_change")
    provider: str = "eia"
    page_content: Optional[str] = None
    labels: Optional[dict] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("price_usd")
    @classmethod
    def _validate_price(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("price must be positive")
        return v
