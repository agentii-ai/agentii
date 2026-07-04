"""Options models: Greeks, OptionQuote, OptionBar, OptionsChain.

Provider field mapping (Alpaca Snapshot → agentii-models):
    latestQuote.bp → bid, latestQuote.bs → bid_size,
    latestQuote.ap → ask, latestQuote.as → ask_size,
    latestTrade.p → last_trade_price, latestTrade.s → last_trade_size,
    greeks.delta → delta, greeks.gamma → gamma, greeks.theta → theta,
    greeks.vega → vega, greeks.rho → rho,
    impliedVolatility → implied_volatility, openInterest → open_interest

Provider field mapping (Polygon Snapshot → agentii-models):
    last_quote.bid → bid, last_quote.ask → ask,
    last_trade.price → last_trade_price, last_trade.size → last_trade_size,
    greeks.delta → delta, greeks.gamma → gamma, greeks.theta → theta,
    greeks.vega → vega, implied_volatility → implied_volatility,
    open_interest → open_interest
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, computed_field, field_validator

from ._base import BaseMarketData
from .enums import BarTimeframe, OptionType
from .types import Price, ProviderName, Symbol, Volume

_INTERDAY_TIMEFRAMES = frozenset({BarTimeframe.DAY_1, BarTimeframe.WEEK_1, BarTimeframe.MONTH_1})


class Greeks(BaseModel):
    """Position-level Greeks container for aggregation.
    Used by OptionPosition.position_greeks and Portfolio.net_greeks.
    NOT embedded on OptionQuote (those are flat fields)."""

    model_config = ConfigDict(frozen=True)

    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0
    vega: float = 0.0
    rho: float = 0.0
    implied_volatility: float = 0.0

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_complete(self) -> bool:
        return all(
            v != 0.0
            for v in (self.delta, self.gamma, self.theta, self.vega, self.rho, self.implied_volatility)
        )


class OptionQuote(BaseMarketData):
    """Real-time option contract quote with flat Greeks. Full OpenBB 35+ field set — all Optional."""

    # Identity
    underlying_symbol: Symbol
    contract_symbol: Symbol
    expiration: date
    dte: int | None = None
    strike: Price
    option_type: OptionType
    contract_size: int = 100

    # Pricing — bid/ask
    bid: Price | None = None
    bid_size: Volume | None = None
    bid_exchange: str | None = None
    bid_time: datetime | None = None
    ask: Price | None = None
    ask_size: Volume | None = None
    ask_exchange: str | None = None
    ask_time: datetime | None = None
    mark: Price | None = None

    # OHLC
    open: Price | None = None
    high: Price | None = None
    low: Price | None = None
    close: Price | None = None
    open_bid: Price | None = None
    open_ask: Price | None = None
    bid_high: Price | None = None
    ask_high: Price | None = None
    bid_low: Price | None = None
    ask_low: Price | None = None
    close_size: Volume | None = None
    close_time: datetime | None = None
    close_bid: Price | None = None
    close_bid_size: Volume | None = None
    close_bid_time: datetime | None = None
    close_ask: Price | None = None
    close_ask_size: Volume | None = None
    close_ask_time: datetime | None = None

    # Trade
    last_trade_price: Price | None = None
    last_trade_size: Volume | None = None
    last_trade_time: datetime | None = None
    tick: str | None = None

    # Change
    prev_close: Price | None = None
    change: float | None = None
    change_percent: float | None = None

    # Volume / OI
    volume: Volume | None = None
    open_interest: int | None = None

    # Greeks — FLAT on quote (not nested)
    implied_volatility: float | None = None
    delta: float | None = None
    gamma: float | None = None
    theta: float | None = None
    vega: float | None = None
    rho: float | None = None
    theoretical_price: Price | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def mid_price(self) -> float | None:
        if self.bid is not None and self.ask is not None:
            return (self.bid + self.ask) / 2
        return None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def spread(self) -> float | None:
        if self.bid is not None and self.ask is not None:
            return self.ask - self.bid
        return None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def has_greeks(self) -> bool:
        return all(
            v is not None
            for v in (self.delta, self.gamma, self.theta, self.vega, self.rho, self.implied_volatility)
        )


class OptionBar(BaseMarketData):
    """OHLCV bar for a single option contract."""

    contract_symbol: Symbol
    underlying_symbol: Symbol
    date: date | datetime
    timeframe: BarTimeframe
    open: Price
    high: Price
    low: Price
    close: Price
    volume: Volume | None = None
    open_interest: int | None = None
    vwap: Price | None = None
    trade_count: int | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_intraday(self) -> bool:
        return self.timeframe not in _INTERDAY_TIMEFRAMES


class OptionsChain(BaseModel):
    """Full chain snapshot for a single underlying.
    Stores contracts as list[OptionQuote] (per-contract objects)."""

    model_config = ConfigDict(frozen=True)

    underlying_symbol: Symbol
    snapshot_time: datetime
    provider: ProviderName
    contracts: list[OptionQuote]

    def filter(
        self,
        option_type: OptionType | None = None,
        expiration: date | None = None,
        min_strike: float | None = None,
        max_strike: float | None = None,
        min_volume: int | None = None,
        min_open_interest: int | None = None,
    ) -> list[OptionQuote]:
        result = self.contracts
        if option_type is not None:
            result = [c for c in result if c.option_type == option_type]
        if expiration is not None:
            result = [c for c in result if c.expiration == expiration]
        if min_strike is not None:
            result = [c for c in result if c.strike >= min_strike]
        if max_strike is not None:
            result = [c for c in result if c.strike <= max_strike]
        if min_volume is not None:
            result = [c for c in result if c.volume is not None and c.volume >= min_volume]
        if min_open_interest is not None:
            result = [c for c in result if c.open_interest is not None and c.open_interest >= min_open_interest]
        return result

    def by_expiry(self, expiration: date) -> list[OptionQuote]:
        return [c for c in self.contracts if c.expiration == expiration]

    def expirations(self) -> list[date]:
        return sorted({c.expiration for c in self.contracts})

    def strikes(self, expiration: date | None = None) -> list[float]:
        contracts = self.contracts if expiration is None else self.by_expiry(expiration)
        return sorted({c.strike for c in contracts})

    def atm_strike(self, underlying_price: float) -> float | None:
        all_strikes = self.strikes()
        if not all_strikes:
            return None
        return min(all_strikes, key=lambda s: abs(s - underlying_price))

    def near_term_expiry(self) -> date | None:
        today = date.today()
        future = [e for e in self.expirations() if e >= today]
        return future[0] if future else None

    def to_dataframe(self) -> Any:
        """Convert contracts to a pandas DataFrame. Requires pandas."""
        try:
            import pandas as pd
        except ImportError:
            raise ImportError("pandas is required for to_dataframe(). Install with: pip install pandas")
        return pd.DataFrame([c.model_dump() for c in self.contracts])

    @computed_field  # type: ignore[prop-decorator]
    @property
    def call_count(self) -> int:
        return sum(1 for c in self.contracts if c.option_type == OptionType.CALL)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def put_count(self) -> int:
        return sum(1 for c in self.contracts if c.option_type == OptionType.PUT)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def total_contracts(self) -> int:
        return len(self.contracts)
