"""Base market data model shared by all market data types."""

from pydantic import BaseModel, ConfigDict, field_validator

from .types import ProviderName, Symbol, Timestamp


class BaseMarketData(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        populate_by_name=True,
    )

    symbol: Symbol
    provider: ProviderName
    timestamp_ns: Timestamp | None = None

    @field_validator("symbol", mode="before")
    @classmethod
    def _validate_symbol(cls, v: str) -> str:
        v = str(v).strip().upper()
        if not v:
            raise ValueError("symbol must be non-empty")
        return v

    @field_validator("provider", mode="before")
    @classmethod
    def _validate_provider(cls, v: str) -> str:
        v = str(v).strip()
        if not v:
            raise ValueError("provider must be non-empty")
        return v

    @field_validator("timestamp_ns")
    @classmethod
    def _validate_timestamp_ns(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("timestamp_ns must be non-negative")
        return v
