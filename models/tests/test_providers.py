"""Tests for provider abstraction: MarketDataProvider ABC, DataRouter."""

import asyncio
from datetime import date, datetime, timezone

import pytest

from agentii_models.enums import BarTimeframe
from agentii_models.options import OptionQuote, OptionsChain
from agentii_models.providers import DataRouter, MarketDataProvider
from agentii_models.stocks import StockBar, StockQuote, StockSnapshot


class MockProvider(MarketDataProvider):
    def __init__(self, name: str, should_fail: bool = False):
        self._name = name
        self._should_fail = should_fail

    @property
    def provider_name(self) -> str:
        return self._name

    async def get_stock_bars(self, symbol, timeframe, start, end=None):
        if self._should_fail:
            raise ConnectionError(f"{self._name} unavailable")
        return [
            StockBar(
                symbol=symbol,
                provider=self._name,
                date=start,
                open=100.0,
                high=105.0,
                low=99.0,
                close=103.0,
                timeframe=timeframe,
            )
        ]

    async def get_stock_quote(self, symbol):
        if self._should_fail:
            raise ConnectionError(f"{self._name} unavailable")
        return StockQuote(symbol=symbol, provider=self._name, bid=100.0, ask=101.0)

    async def get_stock_snapshot(self, symbol):
        if self._should_fail:
            raise ConnectionError(f"{self._name} unavailable")
        return StockSnapshot(symbol=symbol, provider=self._name)

    async def get_option_chain(self, underlying):
        if self._should_fail:
            raise ConnectionError(f"{self._name} unavailable")
        return OptionsChain(
            underlying_symbol=underlying,
            snapshot_time=datetime(2026, 3, 1, tzinfo=timezone.utc),
            provider=self._name,
            contracts=[],
        )

    async def get_option_quotes(self, contracts):
        if self._should_fail:
            raise ConnectionError(f"{self._name} unavailable")
        return []

    async def get_option_bars(self, contracts, timeframe, start, end=None):
        if self._should_fail:
            raise ConnectionError(f"{self._name} unavailable")
        return []


class TestMarketDataProvider:
    def test_mock_provider_name(self):
        p = MockProvider("alpaca")
        assert p.provider_name == "alpaca"


class TestDataRouter:
    def test_primary_succeeds(self):
        router = DataRouter([MockProvider("alpaca"), MockProvider("polygon")])
        bars = asyncio.run(
            router.get_stock_bars("AAPL", BarTimeframe.DAY_1, date(2026, 1, 1))
        )
        assert len(bars) == 1
        assert bars[0].provider == "alpaca"

    def test_fallback_on_primary_failure(self):
        router = DataRouter([
            MockProvider("alpaca", should_fail=True),
            MockProvider("polygon"),
        ])
        bars = asyncio.run(
            router.get_stock_bars("AAPL", BarTimeframe.DAY_1, date(2026, 1, 1))
        )
        assert len(bars) == 1
        assert bars[0].provider == "polygon"

    def test_all_providers_fail(self):
        router = DataRouter([
            MockProvider("alpaca", should_fail=True),
            MockProvider("polygon", should_fail=True),
        ])
        with pytest.raises(RuntimeError, match="All providers failed"):
            asyncio.run(
                router.get_stock_bars("AAPL", BarTimeframe.DAY_1, date(2026, 1, 1))
            )

    def test_empty_providers_rejected(self):
        with pytest.raises(ValueError, match="At least one provider"):
            DataRouter([])

    def test_quote_fallback(self):
        router = DataRouter([
            MockProvider("alpaca", should_fail=True),
            MockProvider("polygon"),
        ])
        quote = asyncio.run(router.get_stock_quote("AAPL"))
        assert quote.provider == "polygon"

    def test_option_chain_fallback(self):
        router = DataRouter([
            MockProvider("alpaca", should_fail=True),
            MockProvider("polygon"),
        ])
        chain = asyncio.run(router.get_option_chain("MRNA"))
        assert chain.provider == "polygon"
