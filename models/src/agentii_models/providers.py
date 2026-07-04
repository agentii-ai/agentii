"""Provider abstraction: MarketDataProvider ABC, DataRouter."""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from datetime import date

from .enums import BarTimeframe
from .options import OptionBar, OptionQuote, OptionsChain
from .stocks import StockBar, StockQuote, StockSnapshot
from .types import ProviderName, Symbol

logger = logging.getLogger(__name__)


class MarketDataProvider(ABC):
    """Abstract base for data providers (FR-010)."""

    @property
    @abstractmethod
    def provider_name(self) -> ProviderName: ...

    @abstractmethod
    async def get_stock_bars(
        self, symbol: Symbol, timeframe: BarTimeframe, start: date, end: date | None = None
    ) -> list[StockBar]: ...

    @abstractmethod
    async def get_stock_quote(self, symbol: Symbol) -> StockQuote: ...

    @abstractmethod
    async def get_stock_snapshot(self, symbol: Symbol) -> StockSnapshot: ...

    @abstractmethod
    async def get_option_chain(self, underlying: Symbol) -> OptionsChain: ...

    @abstractmethod
    async def get_option_quotes(self, contracts: list[Symbol]) -> list[OptionQuote]: ...

    @abstractmethod
    async def get_option_bars(
        self, contracts: list[Symbol], timeframe: BarTimeframe, start: date, end: date | None = None
    ) -> list[OptionBar]: ...


class DataRouter:
    """Routes requests through a priority-ordered provider chain (FR-010).
    Tries providers in order; falls back on exception; raises RuntimeError if all fail."""

    def __init__(self, providers: list[MarketDataProvider]) -> None:
        if not providers:
            raise ValueError("At least one provider is required")
        self._providers = providers

    async def _try_providers(self, method_name: str, *args, **kwargs):
        errors: list[tuple[str, Exception]] = []
        for provider in self._providers:
            try:
                method = getattr(provider, method_name)
                result = await method(*args, **kwargs)
                logger.info("Provider %s succeeded for %s", provider.provider_name, method_name)
                return result
            except Exception as e:
                logger.warning("Provider %s failed for %s: %s", provider.provider_name, method_name, e)
                errors.append((provider.provider_name, e))
        error_details = "; ".join(f"{name}: {err}" for name, err in errors)
        raise RuntimeError(f"All providers failed for {method_name}: {error_details}")

    async def get_stock_bars(
        self, symbol: Symbol, timeframe: BarTimeframe, start: date, end: date | None = None
    ) -> list[StockBar]:
        return await self._try_providers("get_stock_bars", symbol, timeframe, start, end)

    async def get_stock_quote(self, symbol: Symbol) -> StockQuote:
        return await self._try_providers("get_stock_quote", symbol)

    async def get_stock_snapshot(self, symbol: Symbol) -> StockSnapshot:
        return await self._try_providers("get_stock_snapshot", symbol)

    async def get_option_chain(self, underlying: Symbol) -> OptionsChain:
        return await self._try_providers("get_option_chain", underlying)

    async def get_option_quotes(self, contracts: list[Symbol]) -> list[OptionQuote]:
        return await self._try_providers("get_option_quotes", contracts)

    async def get_option_bars(
        self, contracts: list[Symbol], timeframe: BarTimeframe, start: date, end: date | None = None
    ) -> list[OptionBar]:
        return await self._try_providers("get_option_bars", contracts, timeframe, start, end)
