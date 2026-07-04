"""Cross-model serialization tests: orjson round-trip, nanosecond precision, nested models."""

from datetime import date, datetime, timezone

import pytest

from agentii_models.biotech import CatalystEvent, FDADecision
from agentii_models.enums import (
    AssetClass,
    BarTimeframe,
    CatalystType,
    FDADecisionOutcome,
    OptionType,
    OrderSide,
    OrderType,
    PricingModel,
)
from agentii_models.analytics import IVPoint, OptionPricingResult, PayoffDiagram, VolatilitySurface
from agentii_models.options import Greeks, OptionBar, OptionQuote, OptionsChain
from agentii_models.orders import Order, Trade
from agentii_models.portfolio import OptionPosition, Portfolio, StockPosition
from agentii_models.stocks import StockBar, StockQuote, StockSnapshot, StockTick


class TestStockBarSerialization:
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
            vwap=180.1,
            trade_count=320_000,
            timestamp_ns=1740700200000000000,
        )
        json_str = bar.model_dump_json()
        restored = StockBar.model_validate_json(json_str)
        assert restored == bar

    def test_nanosecond_precision_preserved(self):
        ts = 1740700200123456789
        bar = StockBar(
            symbol="AAPL",
            provider="alpaca",
            date=date(2026, 2, 28),
            open=178.5,
            high=182.3,
            low=177.8,
            close=181.2,
            timeframe=BarTimeframe.MIN_1,
            timestamp_ns=ts,
        )
        json_str = bar.model_dump_json()
        restored = StockBar.model_validate_json(json_str)
        assert restored.timestamp_ns == ts


class TestStockQuoteSerialization:
    def test_json_round_trip(self):
        q = StockQuote(symbol="AAPL", provider="alpaca", bid=181.10, ask=181.20, volume=1000)
        json_str = q.model_dump_json()
        restored = StockQuote.model_validate_json(json_str)
        assert restored == q


class TestStockTickSerialization:
    def test_json_round_trip(self):
        tick = StockTick(symbol="AAPL", provider="alpaca", price=181.15, size=50)
        json_str = tick.model_dump_json()
        restored = StockTick.model_validate_json(json_str)
        assert restored == tick


class TestStockSnapshotSerialization:
    def test_nested_round_trip(self):
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
        json_str = snap.model_dump_json()
        restored = StockSnapshot.model_validate_json(json_str)
        assert restored == snap
        assert restored.quote.bid == 181.10


class TestOptionQuoteSerialization:
    def test_json_round_trip(self):
        q = OptionQuote(
            symbol="MRNA",
            provider="alpaca",
            underlying_symbol="MRNA",
            contract_symbol="MRNA  260321C00150000",
            expiration=date(2026, 3, 21),
            strike=150.0,
            option_type=OptionType.CALL,
            bid=2.50,
            ask=2.80,
            delta=0.45,
            gamma=0.03,
            volume=1200,
            open_interest=5000,
        )
        json_str = q.model_dump_json()
        restored = OptionQuote.model_validate_json(json_str)
        assert restored == q


class TestGreeksSerialization:
    def test_json_round_trip(self):
        g = Greeks(delta=0.5, gamma=0.03, theta=-0.05, vega=0.12, rho=0.01, implied_volatility=0.68)
        json_str = g.model_dump_json()
        restored = Greeks.model_validate_json(json_str)
        assert restored == g


class TestOptionsChainSerialization:
    def test_nested_round_trip(self):
        contracts = [
            OptionQuote(
                symbol="MRNA",
                provider="alpaca",
                underlying_symbol="MRNA",
                contract_symbol=f"MRNA  260321{'C' if i % 2 == 0 else 'P'}00{150 + i:03d}000",
                expiration=date(2026, 3, 21),
                strike=150.0 + i,
                option_type=OptionType.CALL if i % 2 == 0 else OptionType.PUT,
                bid=2.50,
                ask=2.80,
            )
            for i in range(10)
        ]
        chain = OptionsChain(
            underlying_symbol="MRNA",
            snapshot_time=datetime(2026, 2, 28, 14, 30, tzinfo=timezone.utc),
            provider="alpaca",
            contracts=contracts,
        )
        json_str = chain.model_dump_json()
        restored = OptionsChain.model_validate_json(json_str)
        assert restored == chain
        assert restored.total_contracts == 10


class TestOptionBarSerialization:
    def test_json_round_trip(self):
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
        json_str = bar.model_dump_json()
        restored = OptionBar.model_validate_json(json_str)
        assert restored == bar


class TestPortfolioSerialization:
    def test_nested_round_trip(self):
        stock = StockPosition(symbol="AAPL", quantity=100, avg_entry_price=50.0, current_price=55.0)
        greeks = Greeks(delta=0.3, gamma=0.02, theta=-0.04, vega=0.10, rho=0.005)
        opt = OptionPosition(
            contract_symbol="MRNA  260321C00150000",
            underlying_symbol="MRNA",
            option_type=OptionType.CALL,
            strike=150.0,
            expiration=date(2026, 3, 21),
            quantity=10,
            avg_entry_price=3.00,
            current_price=4.50,
            position_greeks=greeks,
        )
        portfolio = Portfolio(
            portfolio_id="port-001",
            name="Test",
            stock_positions=[stock],
            option_positions=[opt],
            cash_balance=10000.0,
            as_of=datetime(2026, 3, 1, tzinfo=timezone.utc),
        )
        json_str = portfolio.model_dump_json()
        restored = Portfolio.model_validate_json(json_str)
        assert restored == portfolio
        assert restored.net_greeks.delta == pytest.approx(0.3)


class TestOrderSerialization:
    def test_json_round_trip(self):
        order = Order(
            order_id="ord-001",
            symbol="AAPL",
            asset_class=AssetClass.EQUITY,
            side=OrderSide.BUY,
            order_type=OrderType.LIMIT,
            quantity=100,
            limit_price=180.0,
            created_at=datetime(2026, 3, 1, 10, 0, tzinfo=timezone.utc),
            agent_id="execution_advisor",
        )
        json_str = order.model_dump_json()
        restored = Order.model_validate_json(json_str)
        assert restored.order_id == order.order_id
        assert restored.agent_id == "execution_advisor"


class TestTradeSerialization:
    def test_json_round_trip(self):
        trade = Trade(
            trade_id="trd-001",
            order_id="ord-001",
            symbol="AAPL",
            asset_class=AssetClass.EQUITY,
            side=OrderSide.BUY,
            quantity=100,
            price=179.50,
            commission=0.65,
            executed_at=datetime(2026, 3, 1, 10, 5, tzinfo=timezone.utc),
        )
        json_str = trade.model_dump_json()
        restored = Trade.model_validate_json(json_str)
        assert restored == trade


class TestCatalystEventSerialization:
    def test_json_round_trip(self):
        event = CatalystEvent(
            event_id="cat-001",
            symbol="MRNA",
            drug_name="mRNA-1273",
            indication="COVID-19",
            catalyst_type=CatalystType.PDUFA,
            event_date=date(2026, 4, 15),
            created_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
        )
        json_str = event.model_dump_json()
        restored = CatalystEvent.model_validate_json(json_str)
        assert restored.event_id == event.event_id
        assert restored.catalyst_type == CatalystType.PDUFA


class TestFDADecisionSerialization:
    def test_json_round_trip(self):
        decision = FDADecision(
            decision_id="fda-001",
            symbol="MRNA",
            drug_name="mRNA-1273",
            indication="COVID-19",
            outcome=FDADecisionOutcome.APPROVED,
            decision_date=date(2026, 4, 15),
            price_before=50.0,
            price_after=120.0,
        )
        json_str = decision.model_dump_json()
        restored = FDADecision.model_validate_json(json_str)
        assert restored == decision


class TestIVPointSerialization:
    def test_json_round_trip(self):
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


class TestVolatilitySurfaceSerialization:
    def test_json_round_trip(self):
        points = [
            IVPoint(
                underlying_symbol="MRNA",
                strike=s,
                expiration=date(2026, 3, 21),
                option_type=OptionType.CALL,
                implied_volatility=0.5 + s * 0.001,
                timestamp=datetime(2026, 2, 28, 14, 30, tzinfo=timezone.utc),
                provider="alpaca",
            )
            for s in [140.0, 150.0, 160.0]
        ]
        surface = VolatilitySurface(
            underlying_symbol="MRNA",
            snapshot_time=datetime(2026, 2, 28, 14, 30, tzinfo=timezone.utc),
            provider="alpaca",
            points=points,
        )
        json_str = surface.model_dump_json()
        restored = VolatilitySurface.model_validate_json(json_str)
        assert restored == surface


class TestOptionPricingResultSerialization:
    def test_json_round_trip(self):
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


class TestPayoffDiagramSerialization:
    def test_json_round_trip(self):
        diagram = PayoffDiagram(
            strategy_name="Long Call",
            underlying_symbol="MRNA",
            price_points=[130.0, 140.0, 150.0, 160.0, 170.0],
            payoff_values=[-5.0, -5.0, -5.0, 5.0, 15.0],
            breakeven_points=[155.0],
            max_loss=-5.0,
        )
        json_str = diagram.model_dump_json()
        restored = PayoffDiagram.model_validate_json(json_str)
        assert restored == diagram
