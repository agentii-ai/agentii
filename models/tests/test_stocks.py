"""Tests for stock models: StockTick, StockQuote, StockBar, StockSnapshot."""

from datetime import date, datetime, timezone

import pytest
from pydantic import ValidationError

from agentii_models.enums import Adjustment, BarTimeframe, DataFeed, Exchange, MarketSession
from agentii_models.stocks import StockBar, StockQuote, StockSnapshot, StockTick


class TestStockBar:
    def test_construction(self):
        bar = StockBar(
            symbol="AAPL",
            provider="alpaca",
            date=date(2026, 2, 28),
            open=178.5,
            high=182.3,
            low=177.8,
            close=181.2,
            timeframe=BarTimeframe.DAY_1,
            volume=45_000_000,
            vwap=180.1,
            trade_count=320_000,
        )
        assert bar.symbol == "AAPL"
        assert bar.provider == "alpaca"
        assert bar.close == 181.2

    def test_is_intraday_true(self):
        bar = StockBar(
            symbol="AAPL",
            provider="alpaca",
            date=datetime(2026, 2, 28, 14, 30),
            open=178.5,
            high=182.3,
            low=177.8,
            close=181.2,
            timeframe=BarTimeframe.MIN_1,
        )
        assert bar.is_intraday is True

    def test_is_intraday_false(self):
        bar = StockBar(
            symbol="AAPL",
            provider="alpaca",
            date=date(2026, 2, 28),
            open=178.5,
            high=182.3,
            low=177.8,
            close=181.2,
            timeframe=BarTimeframe.DAY_1,
        )
        assert bar.is_intraday is False

    def test_ohlc_validation_high(self):
        with pytest.raises(ValidationError, match="high must be >= max"):
            StockBar(
                symbol="AAPL",
                provider="alpaca",
                date=date(2026, 2, 28),
                open=180.0,
                high=179.0,  # invalid: less than open
                low=175.0,
                close=178.0,
                timeframe=BarTimeframe.DAY_1,
            )

    def test_ohlc_validation_low(self):
        with pytest.raises(ValidationError, match="low must be <= min"):
            StockBar(
                symbol="AAPL",
                provider="alpaca",
                date=date(2026, 2, 28),
                open=180.0,
                high=185.0,
                low=181.0,  # invalid: greater than close
                close=178.0,
                timeframe=BarTimeframe.DAY_1,
            )

    def test_negative_volume_rejected(self):
        with pytest.raises(ValidationError, match="volume must be non-negative"):
            StockBar(
                symbol="AAPL",
                provider="alpaca",
                date=date(2026, 2, 28),
                open=178.5,
                high=182.3,
                low=177.8,
                close=181.2,
                timeframe=BarTimeframe.DAY_1,
                volume=-1,
            )

    def test_json_round_trip(self):
        bar = StockBar(
            symbol="AAPL",
            provider="alpaca",
            date=date(2026, 2, 28),
            open=178.5,
            high=182.3,
            low=177.8,
            close=181.2,
            timeframe=BarTimeframe.DAY_1,
            volume=45_000_000,
            timestamp_ns=1740700200000000000,
        )
        json_str = bar.model_dump_json()
        restored = StockBar.model_validate_json(json_str)
        assert restored == bar
        assert restored.timestamp_ns == 1740700200000000000

    def test_alpaca_field_mapping(self, alpaca_bar_json):
        """Verify Alpaca raw JSON can map to StockBar fields."""
        raw = alpaca_bar_json
        bar = StockBar(
            symbol="AAPL",
            provider="alpaca",
            date=date(2026, 2, 28),
            open=raw["o"],
            high=raw["h"],
            low=raw["l"],
            close=raw["c"],
            volume=raw["v"],
            vwap=raw["vw"],
            trade_count=raw["n"],
            timeframe=BarTimeframe.MIN_1,
        )
        assert bar.open == 178.5
        assert bar.volume == 45_000_000
        assert bar.trade_count == 320_000

    def test_no_open_interest_field(self):
        """StockBar must NOT have open_interest (spec Q7)."""
        assert not hasattr(StockBar.model_fields, "open_interest")

    def test_session_field(self):
        bar = StockBar(
            symbol="AAPL",
            provider="alpaca",
            date=date(2026, 2, 28),
            open=178.5,
            high=182.3,
            low=177.8,
            close=181.2,
            timeframe=BarTimeframe.MIN_1,
            session=MarketSession.PRE_MARKET,
        )
        assert bar.session == MarketSession.PRE_MARKET

    def test_adjustment_and_feed_fields(self):
        bar = StockBar(
            symbol="AAPL",
            provider="alpaca",
            date=date(2026, 2, 28),
            open=178.5,
            high=182.3,
            low=177.8,
            close=181.2,
            timeframe=BarTimeframe.DAY_1,
            adjustment=Adjustment.SPLIT,
            feed=DataFeed.SIP,
        )
        assert bar.adjustment == Adjustment.SPLIT
        assert bar.feed == DataFeed.SIP

    def test_adjustment_defaults_none(self):
        bar = StockBar(
            symbol="AAPL",
            provider="alpaca",
            date=date(2026, 2, 28),
            open=178.5,
            high=182.3,
            low=177.8,
            close=181.2,
            timeframe=BarTimeframe.DAY_1,
        )
        assert bar.adjustment is None
        assert bar.feed is None


class TestStockTick:
    def test_construction(self):
        tick = StockTick(
            symbol="AAPL",
            provider="alpaca",
            price=181.25,
            size=100,
            exchange=Exchange.NASDAQ,
        )
        assert tick.price == 181.25
        assert tick.size == 100

    def test_negative_price_rejected(self):
        with pytest.raises(ValidationError, match="price must be non-negative"):
            StockTick(symbol="AAPL", provider="alpaca", price=-1.0, size=100)


class TestStockQuote:
    def test_mid_price(self):
        q = StockQuote(
            symbol="AAPL",
            provider="alpaca",
            bid=181.10,
            ask=181.20,
        )
        assert q.mid_price == pytest.approx(181.15)

    def test_spread(self):
        q = StockQuote(
            symbol="AAPL",
            provider="alpaca",
            bid=181.10,
            ask=181.20,
        )
        assert q.spread == pytest.approx(0.10)

    def test_mid_price_none_when_missing(self):
        q = StockQuote(symbol="AAPL", provider="alpaca", bid=181.10)
        assert q.mid_price is None

    def test_spread_none_when_missing(self):
        q = StockQuote(symbol="AAPL", provider="alpaca", ask=181.20)
        assert q.spread is None


class TestStockSnapshot:
    def test_construction_with_nested(self):
        quote = StockQuote(symbol="AAPL", provider="alpaca", bid=181.10, ask=181.20)
        tick = StockTick(symbol="AAPL", provider="alpaca", price=181.15, size=50)
        daily = StockBar(
            symbol="AAPL",
            provider="alpaca",
            date=date(2026, 2, 28),
            open=178.5,
            high=182.3,
            low=177.8,
            close=181.2,
            timeframe=BarTimeframe.DAY_1,
        )
        snap = StockSnapshot(
            symbol="AAPL",
            provider="alpaca",
            quote=quote,
            latest_trade=tick,
            daily_bar=daily,
        )
        assert snap.quote is not None
        assert snap.quote.mid_price == pytest.approx(181.15)
        assert snap.daily_bar is not None
        assert snap.prev_daily_bar is None
