"""Additional edge case tests to improve coverage to 100%."""

import asyncio
from datetime import date, datetime, timezone

import pytest
from pydantic import ValidationError

from agentii_models._base import BaseMarketData
from agentii_models.enums import AssetClass, BarTimeframe, Exchange, OptionType
from agentii_models.instruments import OptionInstrument
from agentii_models.options import Greeks, OptionQuote, OptionsChain
from agentii_models.portfolio import OptionPosition, StockPosition
from agentii_models.stocks import StockBar


class TestBaseMarketDataEdgeCases:
    """Test edge cases in BaseMarketData validators."""

    def test_empty_symbol_rejected(self):
        """Test that empty symbol is rejected."""
        with pytest.raises(ValidationError, match="symbol must be non-empty"):
            BaseMarketData(symbol="", provider="alpaca")

    def test_whitespace_only_symbol_rejected(self):
        """Test that whitespace-only symbol is rejected."""
        with pytest.raises(ValidationError, match="symbol must be non-empty"):
            BaseMarketData(symbol="   ", provider="alpaca")

    def test_empty_provider_rejected(self):
        """Test that empty provider is rejected."""
        with pytest.raises(ValidationError, match="provider must be non-empty"):
            BaseMarketData(symbol="AAPL", provider="")

    def test_negative_timestamp_rejected(self):
        """Test that negative timestamp is rejected."""
        with pytest.raises(ValidationError, match="timestamp_ns must be non-negative"):
            BaseMarketData(symbol="AAPL", provider="alpaca", timestamp_ns=-1)


class TestOptionInstrumentEdgeCases:
    """Test edge cases in OptionInstrument validators."""

    def test_zero_strike_price_rejected(self):
        """Test that zero strike price is rejected."""
        with pytest.raises(ValidationError, match="strike_price must be positive"):
            OptionInstrument(
                symbol="AAPL  260321C00000000",
                exchange=Exchange.CBOE,
                name="AAPL Call",
                underlying_symbol="AAPL",
                strike_price=0.0,
                expiration_date=date(2026, 3, 21),
                option_type=OptionType.CALL,
            )

    def test_zero_contract_size_rejected(self):
        """Test that zero contract size is rejected."""
        with pytest.raises(ValidationError, match="contract_size must be positive"):
            OptionInstrument(
                symbol="AAPL  260321C00150000",
                exchange=Exchange.CBOE,
                name="AAPL Call",
                underlying_symbol="AAPL",
                strike_price=150.0,
                expiration_date=date(2026, 3, 21),
                option_type=OptionType.CALL,
                contract_size=0,
            )


class TestOptionQuoteEdgeCases:
    """Test edge cases in OptionQuote computed properties."""

    def test_mid_price_none_when_bid_missing(self):
        """Test mid_price returns None when bid is missing."""
        q = OptionQuote(
            symbol="MRNA",
            provider="alpaca",
            underlying_symbol="MRNA",
            contract_symbol="MRNA  260321C00150000",
            expiration=date(2026, 3, 21),
            strike=150.0,
            option_type=OptionType.CALL,
            ask=2.80,
        )
        assert q.mid_price is None

    def test_spread_none_when_ask_missing(self):
        """Test spread returns None when ask is missing."""
        q = OptionQuote(
            symbol="MRNA",
            provider="alpaca",
            underlying_symbol="MRNA",
            contract_symbol="MRNA  260321C00150000",
            expiration=date(2026, 3, 21),
            strike=150.0,
            option_type=OptionType.CALL,
            bid=2.50,
        )
        assert q.spread is None


class TestPortfolioEdgeCases:
    """Test edge cases in portfolio position calculations."""

    def test_stock_position_zero_cost_basis(self):
        """Test unrealized_pnl_pct when cost_basis is zero."""
        pos = StockPosition(
            symbol="AAPL",
            quantity=0,
            avg_entry_price=50.0,
            current_price=55.0,
        )
        # quantity=0 means cost_basis=0, should return 0.0 not divide by zero
        assert pos.unrealized_pnl_pct == 0.0

    def test_option_position_zero_cost_basis(self):
        """Test unrealized_pnl_pct when cost_basis is zero."""
        greeks = Greeks()
        pos = OptionPosition(
            contract_symbol="MRNA  260321C00150000",
            underlying_symbol="MRNA",
            option_type=OptionType.CALL,
            strike=150.0,
            expiration=date(2026, 3, 21),
            quantity=0,
            avg_entry_price=3.00,
            current_price=4.50,
            position_greeks=greeks,
        )
        # quantity=0 means cost_basis=0, should return 0.0 not divide by zero
        assert pos.unrealized_pnl_pct == 0.0


class TestOptionsChainEdgeCases:
    """Test edge cases in OptionsChain methods."""

    def test_to_dataframe_without_pandas(self, monkeypatch):
        """Test to_dataframe raises ImportError when pandas not available."""
        from agentii_models.options import OptionsChain
        from datetime import datetime, timezone

        chain = OptionsChain(
            underlying_symbol="MRNA",
            snapshot_time=datetime(2026, 2, 28, 14, 30, tzinfo=timezone.utc),
            provider="alpaca",
            contracts=[],
        )

        # Mock pandas import to fail
        import sys
        import builtins
        real_import = builtins.__import__

        def mock_import(name, *args, **kwargs):
            if name == "pandas":
                raise ImportError("No module named 'pandas'")
            return real_import(name, *args, **kwargs)

        monkeypatch.setattr(builtins, "__import__", mock_import)

        with pytest.raises(ImportError, match="pandas is required"):
            chain.to_dataframe()


class TestOptionInstrumentNegativeContractSize:
    """Cover instruments.py line 69 — negative contract_size."""

    def test_negative_contract_size_rejected(self):
        with pytest.raises(ValidationError, match="contract_size must be positive"):
            OptionInstrument(
                symbol="AAPL  260321C00150000",
                exchange=Exchange.CBOE,
                name="AAPL Call",
                underlying_symbol="AAPL",
                strike_price=150.0,
                expiration_date=date(2026, 3, 21),
                option_type=OptionType.CALL,
                contract_size=-1,
            )

    def test_positive_contract_size_accepted(self):
        """Cover instruments.py line 69 — positive contract_size success path."""
        opt = OptionInstrument(
            symbol="AAPL  260321C00150000",
            exchange=Exchange.CBOE,
            name="AAPL Call",
            underlying_symbol="AAPL",
            strike_price=150.0,
            expiration_date=date(2026, 3, 21),
            option_type=OptionType.CALL,
            contract_size=100,
        )
        assert opt.contract_size == 100


class TestStockBarNegativePrice:
    """Cover stocks.py line 81 — negative OHLC price."""

    def test_negative_open_rejected(self):
        with pytest.raises(ValidationError, match="price must be non-negative"):
            StockBar(
                symbol="AAPL",
                provider="alpaca",
                date=date(2026, 2, 28),
                open=-1.0,
                high=182.3,
                low=177.8,
                close=181.2,
                timeframe=BarTimeframe.DAY_1,
            )


class TestDataRouterSnapshotAndOptionQuotes:
    """Cover providers.py lines 74, 80 — snapshot and option_quotes router methods."""

    def test_snapshot_router(self):
        from agentii_models.providers import DataRouter, MarketDataProvider
        from agentii_models.stocks import StockQuote, StockSnapshot

        class StubProvider(MarketDataProvider):
            @property
            def provider_name(self):
                return "stub"

            async def get_stock_bars(self, symbol, timeframe, start, end=None):
                return []

            async def get_stock_quote(self, symbol):
                return StockQuote(symbol=symbol, provider="stub")

            async def get_stock_snapshot(self, symbol):
                return StockSnapshot(symbol=symbol, provider="stub")

            async def get_option_chain(self, underlying):
                return OptionsChain(
                    underlying_symbol=underlying,
                    snapshot_time=datetime(2026, 3, 1, tzinfo=timezone.utc),
                    provider="stub",
                    contracts=[],
                )

            async def get_option_quotes(self, contracts):
                return []

            async def get_option_bars(self, contracts, timeframe, start, end=None):
                return []

        router = DataRouter([StubProvider()])
        snap = asyncio.run(router.get_stock_snapshot("AAPL"))
        assert snap.provider == "stub"

        quotes = asyncio.run(router.get_option_quotes(["AAPL  260321C00150000"]))
        assert quotes == []

        bars = asyncio.run(router.get_option_bars(
            ["AAPL  260321C00150000"], BarTimeframe.DAY_1, date(2026, 1, 1)
        ))
        assert bars == []


class TestOptionsChainToDataframeSuccess:
    """Cover options.py line 230 — to_dataframe success path with pandas."""

    def test_to_dataframe_with_pandas(self):
        try:
            import pandas  # noqa: F401
        except ImportError:
            pytest.skip("pandas not installed")

        chain = OptionsChain(
            underlying_symbol="MRNA",
            snapshot_time=datetime(2026, 2, 28, 14, 30, tzinfo=timezone.utc),
            provider="alpaca",
            contracts=[
                OptionQuote(
                    symbol="MRNA",
                    provider="alpaca",
                    underlying_symbol="MRNA",
                    contract_symbol="MRNA  260321C00150000",
                    expiration=date(2026, 3, 21),
                    strike=150.0,
                    option_type=OptionType.CALL,
                    bid=2.50,
                    ask=2.80,
                ),
            ],
        )
        df = chain.to_dataframe()
        assert len(df) == 1
        assert "strike" in df.columns
