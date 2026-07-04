"""Portfolio models: StockPosition, OptionPosition, Portfolio.

Structural reference: VeighNa vnpy_optionmaster/base.py PortfolioData
- OptionData.pos_delta/gamma/theta/vega → OptionPosition.position_greeks: Greeks
- PortfolioData.pos_delta/gamma/theta/vega → Portfolio.net_greeks: Greeks (computed sum)
"""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, computed_field

from .enums import OptionType
from .options import Greeks
from .types import Price, Symbol


class StockPosition(BaseModel):
    model_config = ConfigDict(frozen=True)

    symbol: Symbol
    quantity: int
    avg_entry_price: Price
    current_price: Price

    @computed_field  # type: ignore[prop-decorator]
    @property
    def market_value(self) -> float:
        return self.quantity * self.current_price

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cost_basis(self) -> float:
        return self.quantity * self.avg_entry_price

    @computed_field  # type: ignore[prop-decorator]
    @property
    def unrealized_pnl(self) -> float:
        return self.market_value - self.cost_basis

    @computed_field  # type: ignore[prop-decorator]
    @property
    def unrealized_pnl_pct(self) -> float:
        cb = self.cost_basis
        if cb == 0:
            return 0.0
        return self.unrealized_pnl / cb


class OptionPosition(BaseModel):
    model_config = ConfigDict(frozen=True)

    contract_symbol: Symbol
    underlying_symbol: Symbol
    option_type: OptionType
    strike: Price
    expiration: date
    quantity: int
    avg_entry_price: Price
    current_price: Price
    contract_size: int = 100
    position_greeks: Greeks

    @computed_field  # type: ignore[prop-decorator]
    @property
    def market_value(self) -> float:
        return self.quantity * self.current_price * self.contract_size

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cost_basis(self) -> float:
        return self.quantity * self.avg_entry_price * self.contract_size

    @computed_field  # type: ignore[prop-decorator]
    @property
    def unrealized_pnl(self) -> float:
        return self.market_value - self.cost_basis

    @computed_field  # type: ignore[prop-decorator]
    @property
    def unrealized_pnl_pct(self) -> float:
        cb = self.cost_basis
        if cb == 0:
            return 0.0
        return self.unrealized_pnl / cb

    @computed_field  # type: ignore[prop-decorator]
    @property
    def days_to_expiry(self) -> int:
        return (self.expiration - date.today()).days

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_expired(self) -> bool:
        return self.expiration < date.today()


class Portfolio(BaseModel):
    model_config = ConfigDict(frozen=True)

    portfolio_id: str
    name: str
    stock_positions: list[StockPosition] = []
    option_positions: list[OptionPosition] = []
    cash_balance: float = 0.0
    as_of: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def net_greeks(self) -> Greeks:
        delta = sum(p.position_greeks.delta for p in self.option_positions)
        gamma = sum(p.position_greeks.gamma for p in self.option_positions)
        theta = sum(p.position_greeks.theta for p in self.option_positions)
        vega = sum(p.position_greeks.vega for p in self.option_positions)
        rho = sum(p.position_greeks.rho for p in self.option_positions)
        iv = sum(p.position_greeks.implied_volatility for p in self.option_positions)
        return Greeks(delta=delta, gamma=gamma, theta=theta, vega=vega, rho=rho, implied_volatility=iv)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def total_market_value(self) -> float:
        stock_mv = sum(p.market_value for p in self.stock_positions)
        option_mv = sum(p.market_value for p in self.option_positions)
        return stock_mv + option_mv + self.cash_balance

    @computed_field  # type: ignore[prop-decorator]
    @property
    def total_unrealized_pnl(self) -> float:
        stock_pnl = sum(p.unrealized_pnl for p in self.stock_positions)
        option_pnl = sum(p.unrealized_pnl for p in self.option_positions)
        return stock_pnl + option_pnl

    @computed_field  # type: ignore[prop-decorator]
    @property
    def stock_count(self) -> int:
        return len(self.stock_positions)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def option_count(self) -> int:
        return len(self.option_positions)
