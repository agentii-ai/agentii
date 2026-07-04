"""Tests for options models: Greeks, OptionQuote, OptionBar, OptionsChain."""

from datetime import date, datetime, timezone

import pytest
from pydantic import ValidationError

from agentii_models.enums import BarTimeframe, OptionType
from agentii_models.options import Greeks, OptionBar, OptionQuote, OptionsChain


class TestGreeks:
    def test_construction_defaults(self):
        g = Greeks()
        assert g.delta == 0.0
        assert g.gamma == 0.0
        assert g.theta == 0.0
        assert g.vega == 0.0
        assert g.rho == 0.0
        assert g.implied_volatility == 0.0

    def test_is_complete_true(self):
        g = Greeks(delta=0.5, gamma=0.03, theta=-0.05, vega=0.12, rho=0.01, implied_volatility=0.68)
        assert g.is_complete is True

    def test_is_complete_false_when_zero(self):
        g = Greeks(delta=0.5, gamma=0.0, theta=-0.05, vega=0.12, rho=0.01, implied_volatility=0.68)
        assert g.is_complete is False

    def test_frozen(self):
        g = Greeks(delta=0.5)
        with pytest.raises(ValidationError):
            g.delta = 0.6

    def test_serialization_round_trip(self):
        g = Greeks(delta=0.5, gamma=0.03, theta=-0.05, vega=0.12, rho=0.01, implied_volatility=0.68)
        json_str = g.model_dump_json()
        restored = Greeks.model_validate_json(json_str)
        assert restored == g


class TestOptionQuote:
    def _make_quote(self, **overrides) -> OptionQuote:
        defaults = dict(
            symbol="MRNA",
            provider="alpaca",
            underlying_symbol="MRNA",
            contract_symbol="MRNA  260321C00150000",
            expiration=date(2026, 3, 21),
            strike=150.0,
            option_type=OptionType.CALL,
        )
        defaults.update(overrides)
        return OptionQuote(**defaults)

    def test_construction_minimal(self):
        q = self._make_quote()
        assert q.underlying_symbol == "MRNA"
        assert q.strike == 150.0
        assert q.option_type == OptionType.CALL

    def test_full_field_set(self):
        q = self._make_quote(
            bid=2.50,
            bid_size=10,
            ask=2.80,
            ask_size=15,
            mark=2.65,
            open=2.40,
            high=2.90,
            low=2.30,
            close=2.70,
            last_trade_price=2.75,
            last_trade_size=5,
            prev_close=2.60,
            change=0.10,
            change_percent=3.85,
            volume=1200,
            open_interest=5000,
            delta=0.45,
            gamma=0.03,
            theta=-0.05,
            vega=0.12,
            rho=0.01,
            implied_volatility=0.68,
            theoretical_price=2.72,
        )
        assert q.bid == 2.50
        assert q.open_interest == 5000
        assert q.delta == 0.45

    def test_mid_price(self):
        q = self._make_quote(bid=2.50, ask=2.80)
        assert q.mid_price == pytest.approx(2.65)

    def test_spread(self):
        q = self._make_quote(bid=2.50, ask=2.80)
        assert q.spread == pytest.approx(0.30)

    def test_has_greeks_true(self):
        q = self._make_quote(
            delta=0.45, gamma=0.03, theta=-0.05, vega=0.12, rho=0.01, implied_volatility=0.68
        )
        assert q.has_greeks is True

    def test_has_greeks_false_when_any_none(self):
        q = self._make_quote(delta=0.45, gamma=0.03, theta=-0.05, vega=0.12, rho=None, implied_volatility=0.68)
        assert q.has_greeks is False

    def test_alpaca_snapshot_mapping(self):
        """Verify Alpaca snapshot JSON can map to OptionQuote fields."""
        q = self._make_quote(
            bid=2.50,
            bid_size=10,
            ask=2.80,
            ask_size=15,
            last_trade_price=2.75,
            last_trade_size=5,
            delta=0.45,
            gamma=0.03,
            theta=-0.05,
            vega=0.12,
            rho=0.01,
            implied_volatility=0.68,
            volume=1200,
            open_interest=5000,
        )
        assert q.provider == "alpaca"
        assert q.delta == 0.45
        assert q.open_interest == 5000


class TestOptionBar:
    def test_construction(self):
        bar = OptionBar(
            symbol="MRNA",
            provider="alpaca",
            contract_symbol="MRNA  260321C00150000",
            underlying_symbol="MRNA",
            date=date(2026, 2, 28),
            timeframe=BarTimeframe.DAY_1,
            open=2.40,
            high=2.90,
            low=2.30,
            close=2.70,
            volume=1200,
            open_interest=5000,
        )
        assert bar.open_interest == 5000
        assert bar.is_intraday is False

    def test_is_intraday(self):
        bar = OptionBar(
            symbol="MRNA",
            provider="alpaca",
            contract_symbol="MRNA  260321C00150000",
            underlying_symbol="MRNA",
            date=datetime(2026, 2, 28, 14, 30),
            timeframe=BarTimeframe.MIN_5,
            open=2.40,
            high=2.90,
            low=2.30,
            close=2.70,
        )
        assert bar.is_intraday is True


class TestOptionsChain:
    def _make_chain(self, n_contracts=200, n_expirations=5) -> OptionsChain:
        contracts = []
        expirations = [date(2026, 3 + i, 21) for i in range(n_expirations)]
        strikes = [100.0 + i * 5.0 for i in range(n_contracts // (n_expirations * 2))]

        for exp in expirations:
            for strike in strikes:
                for otype in [OptionType.CALL, OptionType.PUT]:
                    contracts.append(
                        OptionQuote(
                            symbol="MRNA",
                            provider="alpaca",
                            underlying_symbol="MRNA",
                            contract_symbol=f"MRNA  {exp.strftime('%y%m%d')}{'C' if otype == OptionType.CALL else 'P'}{int(strike * 1000):08d}",
                            expiration=exp,
                            strike=strike,
                            option_type=otype,
                            volume=int(strike * 10),
                            open_interest=int(strike * 50),
                            bid=2.50,
                            ask=2.80,
                        )
                    )
        return OptionsChain(
            underlying_symbol="MRNA",
            snapshot_time=datetime(2026, 2, 28, 14, 30, tzinfo=timezone.utc),
            provider="alpaca",
            contracts=contracts,
        )

    def test_total_contracts(self):
        chain = self._make_chain()
        assert chain.total_contracts == len(chain.contracts)

    def test_call_put_count(self):
        chain = self._make_chain()
        assert chain.call_count + chain.put_count == chain.total_contracts
        assert chain.call_count == chain.put_count

    def test_expirations(self):
        chain = self._make_chain(n_expirations=5)
        exps = chain.expirations()
        assert len(exps) == 5
        assert exps == sorted(exps)

    def test_strikes(self):
        chain = self._make_chain()
        strikes = chain.strikes()
        assert strikes == sorted(strikes)
        assert len(set(strikes)) == len(strikes)

    def test_by_expiry(self):
        chain = self._make_chain()
        exp = chain.expirations()[0]
        filtered = chain.by_expiry(exp)
        assert all(c.expiration == exp for c in filtered)
        assert len(filtered) > 0

    def test_filter_by_option_type(self):
        chain = self._make_chain()
        calls = chain.filter(option_type=OptionType.CALL)
        assert all(c.option_type == OptionType.CALL for c in calls)

    def test_filter_by_expiration(self):
        chain = self._make_chain()
        exp = chain.expirations()[2]
        filtered = chain.filter(expiration=exp)
        assert all(c.expiration == exp for c in filtered)

    def test_filter_by_strike_range(self):
        chain = self._make_chain()
        filtered = chain.filter(min_strike=110.0, max_strike=120.0)
        assert all(110.0 <= c.strike <= 120.0 for c in filtered)

    def test_filter_by_volume(self):
        chain = self._make_chain()
        filtered = chain.filter(min_volume=1500)
        assert all(c.volume is not None and c.volume >= 1500 for c in filtered)

    def test_filter_by_open_interest(self):
        chain = self._make_chain()
        filtered = chain.filter(min_open_interest=6000)
        assert all(c.open_interest is not None and c.open_interest >= 6000 for c in filtered)

    def test_atm_strike(self):
        chain = self._make_chain()
        atm = chain.atm_strike(underlying_price=112.0)
        assert atm is not None
        # Should be the closest strike to 112.0
        all_strikes = chain.strikes()
        expected = min(all_strikes, key=lambda s: abs(s - 112.0))
        assert atm == expected

    def test_near_term_expiry(self):
        chain = self._make_chain()
        nte = chain.near_term_expiry()
        assert nte is not None
        assert nte == chain.expirations()[0]

    def test_empty_chain(self):
        chain = OptionsChain(
            underlying_symbol="XYZ",
            snapshot_time=datetime(2026, 2, 28, 14, 30, tzinfo=timezone.utc),
            provider="alpaca",
            contracts=[],
        )
        assert chain.total_contracts == 0
        assert chain.call_count == 0
        assert chain.put_count == 0
        assert chain.atm_strike(100.0) is None
        assert chain.near_term_expiry() is None
        assert chain.expirations() == []
        assert chain.strikes() == []

    def test_strikes_filtered_by_expiry(self):
        chain = self._make_chain()
        exp = chain.expirations()[0]
        strikes = chain.strikes(expiration=exp)
        assert len(strikes) > 0
        # All strikes should come from contracts with that expiration
        exp_contracts = chain.by_expiry(exp)
        exp_strikes = sorted({c.strike for c in exp_contracts})
        assert strikes == exp_strikes
