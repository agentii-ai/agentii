"""Shared enums for agentii-models."""

from enum import Enum


class AssetClass(str, Enum):
    EQUITY = "equity"
    OPTION = "option"
    ETF = "etf"


class Exchange(str, Enum):
    NYSE = "NYSE"
    NASDAQ = "NASDAQ"
    CBOE = "CBOE"
    AMEX = "AMEX"
    ARCA = "ARCA"
    BATS = "BATS"
    IEX = "IEX"
    OTC = "OTC"
    OPRA = "OPRA"


class OptionType(str, Enum):
    CALL = "call"
    PUT = "put"


class OptionStyle(str, Enum):
    AMERICAN = "american"
    EUROPEAN = "european"


class BarTimeframe(str, Enum):
    TICK = "tick"
    SEC_1 = "1s"
    MIN_1 = "1min"
    MIN_5 = "5min"
    MIN_15 = "15min"
    MIN_30 = "30min"
    HOUR_1 = "1h"
    HOUR_4 = "4h"
    DAY_1 = "1d"
    WEEK_1 = "1w"
    MONTH_1 = "1mo"


class MarketSession(str, Enum):
    PRE_MARKET = "pre"
    REGULAR = "regular"
    POST_MARKET = "post"


class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"
    TRAILING_STOP = "trailing_stop"


class OrderStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    PARTIALLY_FILLED = "partially_filled"
    FILLED = "filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    EXPIRED = "expired"


class TimeInForce(str, Enum):
    DAY = "day"
    GTC = "gtc"
    IOC = "ioc"
    FOK = "fok"
    OPG = "opg"
    CLS = "cls"


class CatalystType(str, Enum):
    PDUFA = "pdufa"
    ADCOM = "adcom"
    PHASE_1 = "phase_1"
    PHASE_2 = "phase_2"
    PHASE_3 = "phase_3"
    NDA_FILING = "nda_filing"
    BLA_FILING = "bla_filing"
    CONFERENCE = "conference"
    EARNINGS = "earnings"
    DATA_READOUT = "data_readout"
    PRIORITY_REVIEW = "priority_review"
    BREAKTHROUGH = "breakthrough"


class FDADecisionOutcome(str, Enum):
    APPROVED = "approved"
    CRL = "crl"
    TENTATIVE_APPROVAL = "tentative_approval"
    REFUSED_TO_FILE = "refused_to_file"
    WITHDRAWN = "withdrawn"
    PENDING = "pending"


class DataFeed(str, Enum):
    """Alpaca data feed source. Affects data quality, latency, and cost."""

    SIP = "sip"
    IEX = "iex"
    OTC = "otc"
    BOATS = "boats"


class Adjustment(str, Enum):
    """Price adjustment type for historical bars.
    Critical for 10-year historical data accuracy."""

    RAW = "raw"
    SPLIT = "split"
    DIVIDEND = "dividend"
    ALL = "all"


class PricingModel(str, Enum):
    BLACK_SCHOLES = "black_scholes"
    BLACK_76 = "black_76"
    BINOMIAL_TREE = "binomial_tree"
