"""Tests for analytics models: IVPoint, VolatilitySurface, OptionPricingResult, PayoffDiagram."""

from datetime import date, datetime, timezone

import pytest

from agentii_models.analytics import (
    IVPoint,
    OptionPricingResult,
    PayoffDiagram,
    VolatilitySurface,
)
from agentii_models.enums import OptionType, PricingModel


class TestIVPoint:
    def test_construction(self):
        pt = IVPoint(
            underlying_symbol="MRNA",
            strike=150.0,
            expiration=date(2026, 3, 21),
            option_type=OptionType.CALL,
            implied_volatility=0.68,
            timestamp=datetime(2026, 2, 28, 14, 30, tzinfo=timezone.utc),
            provider="alpaca",
        )
        assert pt.implied_volatility == 0.68

    def test_serialization_round_trip(self):
        pt = IVPoint(
            underlying_symbol="MRNA",
            strike=150.0,
            expiration=date(2026, 3, 21),
            option_type=OptionType.CALL,
            implied_volatility=0.68,
            timestamp=datetime(2026, 2, 28, 14, 30, tzinfo=timezone.utc),
            provider="alpaca",
        )
        json_str = pt.model_dump_json()
        restored = IVPoint.model_validate_json(json_str)
        assert restored == pt


class TestVolatilitySurface:
    def _make_surface(self) -> VolatilitySurface:
        points = []
        for strike in [140.0, 150.0, 160.0]:
            for exp in [date(2026, 3, 21), date(2026, 4, 18)]:
                points.append(
                    IVPoint(
                        underlying_symbol="MRNA",
                        strike=strike,
                        expiration=exp,
                        option_type=OptionType.CALL,
                        implied_volatility=0.5 + (strike - 140) * 0.01 + (exp.month - 3) * 0.05,
                        timestamp=datetime(2026, 2, 28, 14, 30, tzinfo=timezone.utc),
                        provider="alpaca",
                    )
                )
        return VolatilitySurface(
            underlying_symbol="MRNA",
            snapshot_time=datetime(2026, 2, 28, 14, 30, tzinfo=timezone.utc),
            provider="alpaca",
            points=points,
        )

    def test_iv_at(self):
        surface = self._make_surface()
        iv = surface.iv_at(150.0, date(2026, 3, 21))
        assert iv is not None
        assert iv > 0

    def test_iv_at_not_found(self):
        surface = self._make_surface()
        iv = surface.iv_at(999.0, date(2026, 3, 21))
        assert iv is None

    def test_smile(self):
        surface = self._make_surface()
        smile = surface.smile(date(2026, 3, 21))
        assert len(smile) == 3
        assert smile[0].strike < smile[1].strike < smile[2].strike

    def test_term_structure(self):
        surface = self._make_surface()
        ts = surface.term_structure(150.0)
        assert len(ts) == 2
        assert ts[0].expiration < ts[1].expiration


class TestOptionPricingResult:
    def test_construction(self):
        result = OptionPricingResult(
            model=PricingModel.BLACK_SCHOLES,
            theoretical_price=5.25,
            delta=0.55,
            gamma=0.03,
            theta=-0.05,
            vega=0.15,
            rho=0.02,
            implied_volatility=0.68,
            underlying_price=148.0,
            strike=150.0,
            risk_free_rate=0.05,
            time_to_expiry=0.055,
            option_type=OptionType.CALL,
        )
        assert result.model == PricingModel.BLACK_SCHOLES
        assert result.theoretical_price == 5.25
        assert result.delta == 0.55

    def test_serialization_round_trip(self):
        result = OptionPricingResult(
            model=PricingModel.BLACK_SCHOLES,
            theoretical_price=5.25,
            delta=0.55,
            gamma=0.03,
            theta=-0.05,
            vega=0.15,
            rho=0.02,
            implied_volatility=0.68,
            underlying_price=148.0,
            strike=150.0,
            risk_free_rate=0.05,
            time_to_expiry=0.055,
            option_type=OptionType.CALL,
        )
        json_str = result.model_dump_json()
        restored = OptionPricingResult.model_validate_json(json_str)
        assert restored == result


class TestPayoffDiagram:
    def test_construction(self):
        diagram = PayoffDiagram(
            strategy_name="Long Call",
            underlying_symbol="MRNA",
            price_points=[130.0, 140.0, 150.0, 160.0, 170.0],
            payoff_values=[-5.0, -5.0, -5.0, 5.0, 15.0],
            breakeven_points=[155.0],
            max_profit=None,
            max_loss=-5.0,
        )
        assert diagram.strategy_name == "Long Call"
        assert len(diagram.price_points) == 5
        assert diagram.breakeven_points == [155.0]
