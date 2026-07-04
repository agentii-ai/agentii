"""Tests for instrument hierarchy: Instrument, EquityInstrument, OptionInstrument."""

from datetime import date

import pytest
from pydantic import ValidationError

from agentii_models.enums import AssetClass, Exchange, OptionStyle, OptionType
from agentii_models.instruments import (
    EquityInstrument,
    Instrument,
    OptionInstrument,
)


class TestInstrument:
    def test_construction(self):
        inst = Instrument(
            symbol="AAPL",
            asset_class=AssetClass.EQUITY,
            exchange=Exchange.NASDAQ,
            name="Apple Inc.",
        )
        assert inst.symbol == "AAPL"
        assert inst.currency == "USD"

    def test_frozen(self):
        inst = Instrument(
            symbol="AAPL",
            asset_class=AssetClass.EQUITY,
            exchange=Exchange.NASDAQ,
            name="Apple Inc.",
        )
        with pytest.raises(ValidationError):
            inst.symbol = "MSFT"


class TestEquityInstrument:
    def test_construction(self, aapl_equity):
        assert aapl_equity.asset_class == AssetClass.EQUITY
        assert aapl_equity.sector == "Information Technology"

    def test_biotech_fields(self, mrna_equity):
        assert mrna_equity.is_biotech is True
        assert mrna_equity.has_fda_pipeline is True
        assert mrna_equity.clinical_stage == "Commercial"

    def test_defaults(self):
        eq = EquityInstrument(
            symbol="XYZ",
            exchange=Exchange.NYSE,
            name="XYZ Corp",
        )
        assert eq.is_biotech is False
        assert eq.has_fda_pipeline is False
        assert eq.sector is None


class TestOptionInstrument:
    def test_construction(self, mrna_call_option):
        assert mrna_call_option.asset_class == AssetClass.OPTION
        assert mrna_call_option.underlying_symbol == "MRNA"
        assert mrna_call_option.strike_price == 150.0
        assert mrna_call_option.option_type == OptionType.CALL
        assert mrna_call_option.option_style == OptionStyle.AMERICAN
        assert mrna_call_option.contract_size == 100

    def test_occ_symbol_valid(self, mrna_call_option):
        assert mrna_call_option.symbol == "MRNA  260321C00150000"

    def test_occ_symbol_malformed(self):
        with pytest.raises(ValidationError, match="Invalid OCC symbol"):
            OptionInstrument(
                symbol="BAD_SYMBOL",
                exchange=Exchange.CBOE,
                name="Bad",
                underlying_symbol="BAD",
                strike_price=100.0,
                expiration_date=date(2026, 6, 19),
                option_type=OptionType.CALL,
            )

    def test_days_to_expiry_positive(self):
        future = date(2030, 12, 31)
        opt = OptionInstrument(
            symbol="AAPL  301231C00200000",
            exchange=Exchange.CBOE,
            name="AAPL Call",
            underlying_symbol="AAPL",
            strike_price=200.0,
            expiration_date=future,
            option_type=OptionType.CALL,
        )
        assert opt.days_to_expiry > 0

    def test_days_to_expiry_negative_for_expired(self):
        past = date(2020, 1, 1)
        opt = OptionInstrument(
            symbol="AAPL  200101C00200000",
            exchange=Exchange.CBOE,
            name="AAPL Call",
            underlying_symbol="AAPL",
            strike_price=200.0,
            expiration_date=past,
            option_type=OptionType.CALL,
        )
        assert opt.days_to_expiry < 0

    def test_is_expired(self):
        past = date(2020, 1, 1)
        opt = OptionInstrument(
            symbol="AAPL  200101P00150000",
            exchange=Exchange.CBOE,
            name="AAPL Put",
            underlying_symbol="AAPL",
            strike_price=150.0,
            expiration_date=past,
            option_type=OptionType.PUT,
        )
        assert opt.is_expired is True

    def test_moneyness(self, mrna_call_option):
        m = mrna_call_option.moneyness(underlying_price=140.0)
        assert abs(m - 150.0 / 140.0) < 1e-9

    def test_moneyness_invalid_price(self, mrna_call_option):
        with pytest.raises(ValueError, match="underlying_price must be positive"):
            mrna_call_option.moneyness(0.0)

    def test_strike_price_must_be_positive(self):
        with pytest.raises(ValidationError, match="strike_price must be positive"):
            OptionInstrument(
                symbol="AAPL  260321C00000000",
                exchange=Exchange.CBOE,
                name="AAPL Call",
                underlying_symbol="AAPL",
                strike_price=-10.0,
                expiration_date=date(2026, 3, 21),
                option_type=OptionType.CALL,
            )
