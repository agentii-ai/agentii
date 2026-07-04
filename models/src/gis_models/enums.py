"""GIS enums shared across EIA, AIS, weather, and graph models."""

from enum import Enum


class VesselType(str, Enum):
    """AIS vessel type categories (derived from MMSI type codes)."""
    CRUDE_TANKER = "crude_tanker"
    PRODUCT_TANKER = "product_tanker"
    CHEMICAL_TANKER = "chemical_tanker"
    LNG_CARRIER = "lng_carrier"
    LPG_CARRIER = "lpg_carrier"
    TANKER_OTHER = "tanker_other"
    CARGO = "cargo"
    CONTAINER = "container"
    BULK_CARRIER = "bulk_carrier"
    PASSENGER = "passenger"
    OTHER = "other"


class AnomalyCategory(str, Enum):
    """Temperature anomaly severity vs. baseline."""
    EXTREME_WARM = "extreme_warm"
    EXTREME_COLD = "extreme_cold"
    MODERATE = "moderate"
    NORMAL = "normal"


class EIACommodity(str, Enum):
    """EIA petroleum commodity types."""
    CRUDE_OIL = "crude_oil"
    GASOLINE = "gasoline"
    DISTILLATE = "distillate"
    HEATING_OIL = "heating_oil"
    JET_FUEL = "jet_fuel"
    PROPANE = "propane"


class EIAPriceType(str, Enum):
    """EIA spot price commodity identifiers."""
    WTI = "wti"
    BRENT = "brent"
    RBOB = "rbob"
    HEATING_OIL = "heating_oil"


class GISNodeType(str, Enum):
    """Graph node entity types."""
    VESSEL = "vessel"
    PORT = "port"
    COMMODITY = "commodity"
    COUNTRY = "country"


class EdgeType(str, Enum):
    """Graph edge relationship types."""
    VISITED = "visited"
    LOADED = "loaded"
    DISCHARGED = "discharged"
    TRADES = "trades"
    LOCATED_IN = "located_in"


class WeatherModel(str, Enum):
    """Numerical weather prediction model identifiers."""
    ECMWF = "ecmwf"
    GFS = "gfs"
    HRRR = "hrrr"


class WeatherProvider(str, Enum):
    """Weather data provider identifiers."""
    ERA5 = "era5"
    OPEN_METEO = "open-meteo"
    NASA_POWER = "nasa-power"


class EnergySignal(str, Enum):
    """Weather-derived energy demand signal."""
    HEATING_DEMAND = "heating_demand"
    COOLING_DEMAND = "cooling_demand"
    NEUTRAL = "neutral"


class AgSignal(str, Enum):
    """Weather-derived agricultural signal."""
    DROUGHT_RISK = "drought_risk"
    FLOOD_RISK = "flood_risk"
    FROST_RISK = "frost_risk"
    NORMAL = "normal"


class SupplySignal(str, Enum):
    """EIA-derived supply signal for trading."""
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"


class WeeklyTrend(str, Enum):
    """EIA weekly inventory trend."""
    BUILD = "build"
    DRAW = "draw"
    FLAT = "flat"
