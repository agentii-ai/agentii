"""Tests for order models: Order, Trade."""

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from agentii_models.enums import AssetClass, OrderSide, OrderStatus, OrderType, TimeInForce
from agentii_models.orders import Order, Trade


class TestOrder:
    def _make_order(self, **overrides) -> Order:
        defaults = dict(
            order_id="ord-001",
            symbol="AAPL",
            asset_class=AssetClass.EQUITY,
            side=OrderSide.BUY,
            order_type=OrderType.LIMIT,
            quantity=100,
            limit_price=180.0,
            created_at=datetime(2026, 3, 1, 10, 0, tzinfo=timezone.utc),
            agent_id="execution_advisor",
            strategy_id="pdufa_straddle",
        )
        defaults.update(overrides)
        return Order(**defaults)

    def test_construction(self):
        order = self._make_order()
        assert order.status == OrderStatus.PENDING
        assert order.agent_id == "execution_advisor"
        assert order.strategy_id == "pdufa_straddle"

    def test_status_update_to_filled(self):
        order = self._make_order()
        order.status = OrderStatus.FILLED
        order.filled_quantity = 100
        order.avg_fill_price = 179.50
        order.filled_at = datetime(2026, 3, 1, 10, 5, tzinfo=timezone.utc)
        assert order.status == OrderStatus.FILLED
        assert order.filled_quantity == 100
        assert order.avg_fill_price == 179.50

    def test_occ_symbol_preserved_for_options(self):
        order = self._make_order(
            symbol="MRNA  260321C00150000",
            asset_class=AssetClass.OPTION,
        )
        json_str = order.model_dump_json()
        assert "MRNA  260321C00150000" in json_str

    def test_all_order_status_values(self):
        for status in OrderStatus:
            order = self._make_order()
            order.status = status
            assert order.status == status

    def test_agent_attribution_present(self):
        order = self._make_order()
        assert order.agent_id is not None
        assert order.strategy_id is not None

    def test_default_provider(self):
        order = self._make_order()
        assert order.provider == "alpaca"


class TestTrade:
    def test_construction(self):
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
            agent_id="execution_advisor",
            strategy_id="pdufa_straddle",
        )
        assert trade.price == 179.50
        assert trade.commission == 0.65

    def test_frozen(self):
        trade = Trade(
            trade_id="trd-001",
            order_id="ord-001",
            symbol="AAPL",
            asset_class=AssetClass.EQUITY,
            side=OrderSide.BUY,
            quantity=100,
            price=179.50,
            executed_at=datetime(2026, 3, 1, 10, 5, tzinfo=timezone.utc),
        )
        with pytest.raises(ValidationError):
            trade.price = 180.0

    def test_commission_full_precision(self):
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
        assert "0.65" in json_str

    def test_agent_attribution_carried(self):
        trade = Trade(
            trade_id="trd-001",
            order_id="ord-001",
            symbol="AAPL",
            asset_class=AssetClass.EQUITY,
            side=OrderSide.BUY,
            quantity=100,
            price=179.50,
            executed_at=datetime(2026, 3, 1, 10, 5, tzinfo=timezone.utc),
            agent_id="execution_advisor",
            strategy_id="pdufa_straddle",
        )
        assert trade.agent_id == "execution_advisor"
        assert trade.strategy_id == "pdufa_straddle"
