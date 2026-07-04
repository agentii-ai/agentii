"""Shared test fixtures for agentii-models."""

from datetime import date, datetime, timezone

import pytest

from agentii_models.enums import (
    AssetClass,
    BarTimeframe,
    CatalystType,
    Exchange,
    FDADecisionOutcome,
    MarketSession,
    OptionStyle,
    OptionType,
)
from agentii_models.instruments import EquityInstrument, OptionInstrument


@pytest.fixture
def aapl_equity() -> EquityInstrument:
    return EquityInstrument(
        symbol="AAPL",
        exchange=Exchange.NASDAQ,
        name="Apple Inc.",
        sector="Information Technology",
        industry="Consumer Electronics",
        market_cap=3_000_000_000_000.0,
    )


@pytest.fixture
def mrna_equity() -> EquityInstrument:
    return EquityInstrument(
        symbol="MRNA",
        exchange=Exchange.NASDAQ,
        name="Moderna, Inc.",
        sector="Health Care",
        industry="Biotechnology",
        market_cap=50_000_000_000.0,
        has_fda_pipeline=True,
        clinical_stage="Commercial",
        is_biotech=True,
    )


@pytest.fixture
def mrna_call_option() -> OptionInstrument:
    return OptionInstrument(
        symbol="MRNA  260321C00150000",
        exchange=Exchange.CBOE,
        name="MRNA 2026-03-21 Call $150",
        underlying_symbol="MRNA",
        strike_price=150.0,
        expiration_date=date(2026, 3, 21),
        option_type=OptionType.CALL,
    )


@pytest.fixture
def mrna_put_option() -> OptionInstrument:
    return OptionInstrument(
        symbol="MRNA  260321P00120000",
        exchange=Exchange.CBOE,
        name="MRNA 2026-03-21 Put $120",
        underlying_symbol="MRNA",
        strike_price=120.0,
        expiration_date=date(2026, 3, 21),
        option_type=OptionType.PUT,
    )


@pytest.fixture
def alpaca_bar_json() -> dict:
    """Sample Alpaca API bar response."""
    return {
        "t": "2026-02-28T14:30:00Z",
        "o": 178.5,
        "h": 182.3,
        "l": 177.8,
        "c": 181.2,
        "v": 45000000,
        "vw": 180.1,
        "n": 320000,
    }


@pytest.fixture
def alpaca_quote_json() -> dict:
    """Sample Alpaca API quote response."""
    return {
        "bp": 181.10,
        "bs": 200,
        "ap": 181.15,
        "as": 150,
        "t": "2026-02-28T14:30:00Z",
    }


@pytest.fixture
def sample_providers() -> list[str]:
    return ["alpaca", "polygon", "openbb"]
