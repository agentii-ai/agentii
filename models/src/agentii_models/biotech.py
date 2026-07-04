"""Biotech-specific models: CatalystEvent, FDADecision."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, computed_field, field_validator

from .enums import CatalystType, FDADecisionOutcome
from .types import Price, Symbol


class CatalystEvent(BaseModel):
    event_id: str
    symbol: Symbol
    drug_name: str
    indication: str
    catalyst_type: CatalystType
    event_date: date | None = None
    date_is_estimated: bool = False
    approval_probability: float | None = None
    expected_move_pct: float | None = None
    historical_precedent: str | None = None
    source: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    @field_validator("approval_probability")
    @classmethod
    def _validate_probability(cls, v: float | None) -> float | None:
        if v is not None and not (0.0 <= v <= 1.0):
            raise ValueError("approval_probability must be between 0.0 and 1.0")
        return v


class FDADecision(BaseModel):
    model_config = ConfigDict(frozen=True)

    decision_id: str
    symbol: Symbol
    drug_name: str
    indication: str
    outcome: FDADecisionOutcome
    decision_date: date
    catalyst_event_id: str | None = None
    price_before: Price | None = None
    price_after: Price | None = None
    review_type: str | None = None
    label_expansion: bool = False
    advisory_committee_vote: str | None = None
    crl_reasons: list[str] | None = None
    source_url: str | None = None
    decision_letter_url: str | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def actual_move_pct(self) -> float | None:
        if self.price_before is not None and self.price_after is not None and self.price_before != 0:
            return (self.price_after - self.price_before) / self.price_before * 100
        return None
