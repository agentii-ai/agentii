"""Analytics models: IVPoint, VolatilitySurface, OptionPricingResult, PayoffDiagram.

Structural reference: VeighNa vnpy_optionmaster/pricing/black_scholes.py
- calculate_greeks(s, k, r, t, v, cp) → (price, delta, gamma, theta, vega)
"""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from .enums import OptionType, PricingModel
from .types import Price, ProviderName, Symbol


class IVPoint(BaseModel):
    model_config = ConfigDict(frozen=True)

    underlying_symbol: Symbol
    strike: Price
    expiration: date
    option_type: OptionType
    implied_volatility: float
    timestamp: datetime
    provider: ProviderName


class VolatilitySurface(BaseModel):
    """3D IV surface: strike × expiry × IV."""

    model_config = ConfigDict(frozen=True)

    underlying_symbol: Symbol
    snapshot_time: datetime
    provider: ProviderName
    points: list[IVPoint]

    def iv_at(self, strike: float, expiration: date) -> float | None:
        for p in self.points:
            if p.strike == strike and p.expiration == expiration:
                return p.implied_volatility
        return None

    def smile(self, expiration: date) -> list[IVPoint]:
        return sorted(
            [p for p in self.points if p.expiration == expiration],
            key=lambda p: p.strike,
        )

    def term_structure(self, strike: float) -> list[IVPoint]:
        return sorted(
            [p for p in self.points if p.strike == strike],
            key=lambda p: p.expiration,
        )


class OptionPricingResult(BaseModel):
    """Output of a pricing model calculation."""

    model_config = ConfigDict(frozen=True)

    model: PricingModel
    theoretical_price: Price
    delta: float
    gamma: float
    theta: float
    vega: float
    rho: float
    implied_volatility: float
    underlying_price: Price
    strike: Price
    risk_free_rate: float
    time_to_expiry: float
    option_type: OptionType


class PayoffDiagram(BaseModel):
    """Strategy payoff visualization data."""

    model_config = ConfigDict(frozen=True)

    strategy_name: str
    underlying_symbol: Symbol
    price_points: list[float]
    payoff_values: list[float]
    breakeven_points: list[float]
    max_profit: float | None = None
    max_loss: float | None = None
