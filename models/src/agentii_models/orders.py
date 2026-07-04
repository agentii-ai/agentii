"""Order and execution models: Order, Trade."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from .enums import AssetClass, OrderSide, OrderStatus, OrderType, TimeInForce
from .types import Price, ProviderName, Symbol


class Order(BaseModel):
    """Order model. NOT frozen — status is mutable for state transitions.

    State transitions:
        PENDING → ACCEPTED → PARTIALLY_FILLED → FILLED (happy path)
        PENDING → REJECTED
        ACCEPTED → CANCELLED
        ACCEPTED → EXPIRED
    """

    order_id: str
    symbol: Symbol
    asset_class: AssetClass
    side: OrderSide
    order_type: OrderType
    quantity: int
    limit_price: Price | None = None
    stop_price: Price | None = None
    time_in_force: TimeInForce = TimeInForce.DAY
    status: OrderStatus = OrderStatus.PENDING
    filled_quantity: int = 0
    avg_fill_price: Price | None = None
    commission: float | None = None
    created_at: datetime
    submitted_at: datetime | None = None
    filled_at: datetime | None = None
    cancelled_at: datetime | None = None
    agent_id: str | None = None
    strategy_id: str | None = None
    provider: ProviderName = "alpaca"


class Trade(BaseModel):
    model_config = ConfigDict(frozen=True)

    trade_id: str
    order_id: str
    symbol: Symbol
    asset_class: AssetClass
    side: OrderSide
    quantity: int
    price: Price
    commission: float = 0.0
    executed_at: datetime
    agent_id: str | None = None
    strategy_id: str | None = None
    provider: ProviderName = "alpaca"
