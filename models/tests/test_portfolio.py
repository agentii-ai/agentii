"""Tests for portfolio models: StockPosition, OptionPosition, Portfolio."""

from datetime import date, datetime, timezone

import pytest

from agentii_models.enums import OptionType
from agentii_models.options import Greeks
from agentii_models.portfolio import OptionPosition, Portfolio, StockPosition


class TestStockPosition:
    def test_construction(self):
        pos = StockPosition(
            symbol="AAPL",
            quantity=100,
            avg_entry_price=50.0,
            current_price=55.0,
        )
        assert pos.symbol == "AAPL"
        assert pos.quantity == 100

    def test_market_value(self):
        pos = StockPosition(symbol="AAPL", quantity=100, avg_entry_price=50.0, current_price=55.0)
        assert pos.market_value == pytest.approx(5500.0)

    def test_cost_basis(self):
        pos = StockPosition(symbol="AAPL", quantity=100, avg_entry_price=50.0, current_price=55.0)
        assert pos.cost_basis == pytest.approx(5000.0)

    def test_unrealized_pnl(self):
        pos = StockPosition(symbol="AAPL", quantity=100, avg_entry_price=50.0, current_price=55.0)
        assert pos.unrealized_pnl == pytest.approx(500.0)

    def test_unrealized_pnl_pct(self):
        pos = StockPosition(symbol="AAPL", quantity=100, avg_entry_price=50.0, current_price=55.0)
        assert pos.unrealized_pnl_pct == pytest.approx(0.10)


class TestOptionPosition:
    def test_construction_with_nested_greeks(self):
        greeks = Greeks(delta=0.3, gamma=0.02, theta=-0.04, vega=0.10, rho=0.005)
        pos = OptionPosition(
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
        assert pos.position_greeks.delta == 0.3
        assert pos.quantity == 10

    def test_negative_quantity_valid(self):
        greeks = Greeks(delta=-0.2)
        pos = OptionPosition(
            contract_symbol="MRNA  260321P00120000",
            underlying_symbol="MRNA",
            option_type=OptionType.PUT,
            strike=120.0,
            expiration=date(2026, 3, 21),
            quantity=-5,
            avg_entry_price=2.00,
            current_price=1.50,
            position_greeks=greeks,
        )
        assert pos.quantity == -5

    def test_market_value_includes_contract_size(self):
        greeks = Greeks(delta=0.3)
        pos = OptionPosition(
            contract_symbol="MRNA  260321C00150000",
            underlying_symbol="MRNA",
            option_type=OptionType.CALL,
            strike=150.0,
            expiration=date(2026, 3, 21),
            quantity=10,
            avg_entry_price=3.00,
            current_price=4.50,
            contract_size=100,
            position_greeks=greeks,
        )
        # 10 * 4.50 * 100 = 4500
        assert pos.market_value == pytest.approx(4500.0)

    def test_days_to_expiry_and_is_expired(self):
        greeks = Greeks()
        pos = OptionPosition(
            contract_symbol="AAPL  200101C00200000",
            underlying_symbol="AAPL",
            option_type=OptionType.CALL,
            strike=200.0,
            expiration=date(2020, 1, 1),
            quantity=1,
            avg_entry_price=1.0,
            current_price=0.0,
            position_greeks=greeks,
        )
        assert pos.days_to_expiry < 0
        assert pos.is_expired is True


class TestPortfolio:
    def _make_portfolio(self) -> Portfolio:
        greeks1 = Greeks(delta=0.3, gamma=0.02, theta=-0.04, vega=0.10, rho=0.005)
        greeks2 = Greeks(delta=-0.2, gamma=0.01, theta=-0.02, vega=0.05, rho=0.003)
        greeks3 = Greeks(delta=0.5, gamma=0.03, theta=-0.06, vega=0.15, rho=0.007)

        stock = StockPosition(symbol="AAPL", quantity=100, avg_entry_price=50.0, current_price=55.0)
        opt1 = OptionPosition(
            contract_symbol="MRNA  260321C00150000",
            underlying_symbol="MRNA",
            option_type=OptionType.CALL,
            strike=150.0,
            expiration=date(2026, 3, 21),
            quantity=10,
            avg_entry_price=3.00,
            current_price=4.50,
            position_greeks=greeks1,
        )
        opt2 = OptionPosition(
            contract_symbol="MRNA  260321P00120000",
            underlying_symbol="MRNA",
            option_type=OptionType.PUT,
            strike=120.0,
            expiration=date(2026, 3, 21),
            quantity=-5,
            avg_entry_price=2.00,
            current_price=1.50,
            position_greeks=greeks2,
        )
        opt3 = OptionPosition(
            contract_symbol="AAPL  260619C00200000",
            underlying_symbol="AAPL",
            option_type=OptionType.CALL,
            strike=200.0,
            expiration=date(2026, 6, 19),
            quantity=3,
            avg_entry_price=5.00,
            current_price=7.00,
            position_greeks=greeks3,
        )

        return Portfolio(
            portfolio_id="port-001",
            name="Test Portfolio",
            stock_positions=[stock],
            option_positions=[opt1, opt2, opt3],
            cash_balance=10000.0,
            as_of=datetime(2026, 3, 1, tzinfo=timezone.utc),
        )

    def test_net_greeks_sum(self):
        portfolio = self._make_portfolio()
        ng = portfolio.net_greeks
        # 0.3 + (-0.2) + 0.5 = 0.6
        assert ng.delta == pytest.approx(0.6)
        # 0.02 + 0.01 + 0.03 = 0.06
        assert ng.gamma == pytest.approx(0.06)
        # -0.04 + (-0.02) + (-0.06) = -0.12
        assert ng.theta == pytest.approx(-0.12)
        # 0.10 + 0.05 + 0.15 = 0.30
        assert ng.vega == pytest.approx(0.30)
        # 0.005 + 0.003 + 0.007 = 0.015
        assert ng.rho == pytest.approx(0.015)

    def test_empty_portfolio_valid(self):
        portfolio = Portfolio(
            portfolio_id="port-empty",
            name="Empty",
            as_of=datetime(2026, 3, 1, tzinfo=timezone.utc),
        )
        assert portfolio.net_greeks.delta == 0.0
        assert portfolio.net_greeks.gamma == 0.0
        assert portfolio.stock_count == 0
        assert portfolio.option_count == 0
        assert portfolio.total_market_value == 0.0

    def test_total_market_value(self):
        portfolio = self._make_portfolio()
        # stock: 100 * 55 = 5500
        # opt1: 10 * 4.50 * 100 = 4500
        # opt2: -5 * 1.50 * 100 = -750
        # opt3: 3 * 7.00 * 100 = 2100
        # cash: 10000
        expected = 5500 + 4500 + (-750) + 2100 + 10000
        assert portfolio.total_market_value == pytest.approx(expected)

    def test_total_unrealized_pnl(self):
        portfolio = self._make_portfolio()
        # stock: (55-50)*100 = 500
        # opt1: (4.50-3.00)*10*100 = 1500
        # opt2: (1.50-2.00)*(-5)*100 = 250
        # opt3: (7.00-5.00)*3*100 = 600
        expected = 500 + 1500 + 250 + 600
        assert portfolio.total_unrealized_pnl == pytest.approx(expected)

    def test_stock_count_option_count(self):
        portfolio = self._make_portfolio()
        assert portfolio.stock_count == 1
        assert portfolio.option_count == 3
