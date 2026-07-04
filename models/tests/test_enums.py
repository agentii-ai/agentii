"""Tests for all 13 enums."""

from agentii_models.enums import (
    Adjustment,
    AssetClass,
    BarTimeframe,
    CatalystType,
    DataFeed,
    Exchange,
    FDADecisionOutcome,
    MarketSession,
    OptionStyle,
    OptionType,
    OrderSide,
    OrderStatus,
    OrderType,
    PricingModel,
    TimeInForce,
)


class TestAssetClass:
    def test_values(self):
        assert AssetClass.EQUITY == "equity"
        assert AssetClass.OPTION == "option"
        assert AssetClass.ETF == "etf"

    def test_membership(self):
        assert "equity" in [e.value for e in AssetClass]

    def test_string_serialization(self):
        assert str(AssetClass.EQUITY) == "AssetClass.EQUITY"
        assert AssetClass.EQUITY.value == "equity"


class TestExchange:
    def test_values(self):
        assert Exchange.NYSE == "NYSE"
        assert Exchange.NASDAQ == "NASDAQ"
        assert Exchange.CBOE == "CBOE"
        assert Exchange.AMEX == "AMEX"
        assert Exchange.ARCA == "ARCA"
        assert Exchange.BATS == "BATS"
        assert Exchange.IEX == "IEX"
        assert Exchange.OTC == "OTC"
        assert Exchange.OPRA == "OPRA"

    def test_count(self):
        assert len(Exchange) == 9


class TestOptionType:
    def test_values(self):
        assert OptionType.CALL == "call"
        assert OptionType.PUT == "put"


class TestOptionStyle:
    def test_values(self):
        assert OptionStyle.AMERICAN == "american"
        assert OptionStyle.EUROPEAN == "european"


class TestBarTimeframe:
    def test_values(self):
        assert BarTimeframe.TICK == "tick"
        assert BarTimeframe.MIN_1 == "1min"
        assert BarTimeframe.DAY_1 == "1d"
        assert BarTimeframe.MONTH_1 == "1mo"

    def test_count(self):
        assert len(BarTimeframe) == 11


class TestMarketSession:
    def test_values(self):
        assert MarketSession.PRE_MARKET == "pre"
        assert MarketSession.REGULAR == "regular"
        assert MarketSession.POST_MARKET == "post"


class TestOrderSide:
    def test_values(self):
        assert OrderSide.BUY == "buy"
        assert OrderSide.SELL == "sell"


class TestOrderType:
    def test_values(self):
        assert OrderType.MARKET == "market"
        assert OrderType.LIMIT == "limit"
        assert OrderType.STOP == "stop"
        assert OrderType.STOP_LIMIT == "stop_limit"
        assert OrderType.TRAILING_STOP == "trailing_stop"


class TestOrderStatus:
    def test_values(self):
        assert OrderStatus.PENDING == "pending"
        assert OrderStatus.FILLED == "filled"
        assert OrderStatus.CANCELLED == "cancelled"

    def test_count(self):
        assert len(OrderStatus) == 7


class TestTimeInForce:
    def test_values(self):
        assert TimeInForce.DAY == "day"
        assert TimeInForce.GTC == "gtc"
        assert TimeInForce.OPG == "opg"
        assert TimeInForce.CLS == "cls"


class TestCatalystType:
    def test_values(self):
        assert CatalystType.PDUFA == "pdufa"
        assert CatalystType.ADCOM == "adcom"
        assert CatalystType.PHASE_3 == "phase_3"
        assert CatalystType.BREAKTHROUGH == "breakthrough"

    def test_count(self):
        assert len(CatalystType) == 12


class TestFDADecisionOutcome:
    def test_values(self):
        assert FDADecisionOutcome.APPROVED == "approved"
        assert FDADecisionOutcome.CRL == "crl"
        assert FDADecisionOutcome.WITHDRAWN == "withdrawn"

    def test_count(self):
        assert len(FDADecisionOutcome) == 6


class TestPricingModel:
    def test_values(self):
        assert PricingModel.BLACK_SCHOLES == "black_scholes"
        assert PricingModel.BLACK_76 == "black_76"
        assert PricingModel.BINOMIAL_TREE == "binomial_tree"


class TestDataFeed:
    def test_values(self):
        assert DataFeed.SIP == "sip"
        assert DataFeed.IEX == "iex"
        assert DataFeed.OTC == "otc"
        assert DataFeed.BOATS == "boats"

    def test_count(self):
        assert len(DataFeed) == 4


class TestAdjustment:
    def test_values(self):
        assert Adjustment.RAW == "raw"
        assert Adjustment.SPLIT == "split"
        assert Adjustment.DIVIDEND == "dividend"
        assert Adjustment.ALL == "all"

    def test_count(self):
        assert len(Adjustment) == 4
