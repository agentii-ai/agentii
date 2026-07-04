"""Stock market data models: StockTick, StockQuote, StockBar, StockSnapshot.

Provider field mapping (Alpaca → agentii-models):
    t → date/timestamp_ns, o → open, h → high, l → low, c → close,
    v → volume, vw → vwap, n → trade_count

Provider field mapping (Polygon/Massive → agentii-models):
    o → open, h → high, l → low, c → close, v → volume, vw → vwap,
    n → trade_count, t → timestamp_ns (Unix ms → convert to ns)
"""

from datetime import date, datetime

from pydantic import computed_field, field_validator, model_validator

from ._base import BaseMarketData
from .enums import Adjustment, BarTimeframe, DataFeed, Exchange, MarketSession
from .types import Price, Volume

_INTERDAY_TIMEFRAMES = frozenset({BarTimeframe.DAY_1, BarTimeframe.WEEK_1, BarTimeframe.MONTH_1})


class StockTick(BaseMarketData):
    price: Price
    size: Volume
    exchange: Exchange | None = None
    conditions: list[str] | None = None

    @field_validator("price")
    @classmethod
    def _validate_price(cls, v: float) -> float:
        if v < 0:
            raise ValueError("price must be non-negative")
        return v


class StockQuote(BaseMarketData):
    bid: Price | None = None
    bid_size: Volume | None = None
    bid_exchange: Exchange | None = None
    ask: Price | None = None
    ask_size: Volume | None = None
    ask_exchange: Exchange | None = None
    last_price: Price | None = None
    last_size: Volume | None = None
    volume: Volume | None = None

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


class StockBar(BaseMarketData):
    """OHLCV bar for equities. No open_interest field (spec Q7)."""

    date: date | datetime
    open: Price
    high: Price
    low: Price
    close: Price
    timeframe: BarTimeframe
    volume: Volume | None = None
    vwap: Price | None = None
    trade_count: int | None = None
    session: MarketSession | None = None
    adjustment: Adjustment | None = None
    feed: DataFeed | None = None

    @field_validator("open", "high", "low", "close")
    @classmethod
    def _validate_prices_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("price must be non-negative")
        return v

    @field_validator("volume")
    @classmethod
    def _validate_volume(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("volume must be non-negative")
        return v

    @model_validator(mode="after")
    def _validate_ohlc_consistency(self) -> "StockBar":
        if self.high < max(self.open, self.close):
            raise ValueError("high must be >= max(open, close)")
        if self.low > min(self.open, self.close):
            raise ValueError("low must be <= min(open, close)")
        return self

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_intraday(self) -> bool:
        return self.timeframe not in _INTERDAY_TIMEFRAMES


class StockSnapshot(BaseMarketData):
    quote: StockQuote | None = None
    latest_trade: StockTick | None = None
    daily_bar: StockBar | None = None
    prev_daily_bar: StockBar | None = None
    minute_bar: StockBar | None = None
