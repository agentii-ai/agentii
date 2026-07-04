"""Instrument hierarchy: Instrument, EquityInstrument, OptionInstrument."""

import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, computed_field, field_validator

from .enums import AssetClass, Exchange, OptionType, OptionStyle
from .types import Symbol

# OCC symbol: 1-6 uppercase letters (right-padded with spaces to 6), 6-digit date YYMMDD, C or P, 8-digit strike
_OCC_PATTERN = re.compile(r"^[A-Z]{1,6}\s*\d{6}[CP]\d{8}$")


class Instrument(BaseModel):
    model_config = ConfigDict(frozen=True)

    symbol: Symbol
    asset_class: AssetClass
    exchange: Exchange
    name: str
    currency: str = "USD"


class EquityInstrument(Instrument):
    asset_class: Literal[AssetClass.EQUITY] = AssetClass.EQUITY

    sector: str | None = None
    industry: str | None = None
    market_cap: float | None = None
    has_fda_pipeline: bool = False
    clinical_stage: str | None = None
    is_biotech: bool = False


class OptionInstrument(Instrument):
    asset_class: Literal[AssetClass.OPTION] = AssetClass.OPTION

    underlying_symbol: Symbol
    strike_price: float
    expiration_date: date
    option_type: OptionType
    option_style: OptionStyle = OptionStyle.AMERICAN
    contract_size: int = 100

    @field_validator("symbol")
    @classmethod
    def _validate_occ_symbol(cls, v: str) -> str:
        if not _OCC_PATTERN.match(v):
            raise ValueError(
                f"Invalid OCC symbol format: '{v}'. "
                "Expected: 1-6 uppercase letters + 6-digit date YYMMDD + C/P + 8-digit strike"
            )
        return v

    @field_validator("strike_price")
    @classmethod
    def _validate_strike(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("strike_price must be positive")
        return v

    @field_validator("contract_size")
    @classmethod
    def _validate_contract_size(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("contract_size must be positive")
        return v

    @computed_field  # type: ignore[prop-decorator]
    @property
    def days_to_expiry(self) -> int:
        return (self.expiration_date - date.today()).days

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_expired(self) -> bool:
        return self.expiration_date < date.today()

    def moneyness(self, underlying_price: float) -> float:
        """Return strike / underlying price ratio."""
        if underlying_price <= 0:
            raise ValueError("underlying_price must be positive")
        return self.strike_price / underlying_price
