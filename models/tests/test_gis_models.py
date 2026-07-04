"""Contract tests for GIS data models — round-trip serialization, field constraints."""

import pytest
from datetime import datetime, timezone
from uuid import uuid4

from gis_models import (
    EIAInventory,
    EIASpotPrice,
    VesselPosition,
    Port,
    PortVisit,
    WeatherObservation,
    WeatherForecast,
    TemperatureAnomaly,
    HDDCDDForecast,
    GISNode,
    GISEdge,
)
from gis_models.enums import (
    AnomalyCategory,
    EdgeType,
    GISNodeType,
    VesselType,
    WeatherModel,
    WeatherProvider,
)


# ---------------------------------------------------------------------------
# EIA Models
# ---------------------------------------------------------------------------

class TestEIAInventory:
    def test_round_trip(self):
        inv = EIAInventory(
            id=str(uuid4()),
            series_id="PET.WCESTUS1.W",
            region="Cushing",
            commodity="crude_oil",
            value=23456.0,
            date=datetime(2026, 3, 26, tzinfo=timezone.utc),
            weekly_change=-1200.0,
        )
        data = inv.model_dump(mode="json")
        restored = EIAInventory.model_validate(data)
        assert restored.inventory_level_thousand_barrels == 23456.0
        assert restored.weekly_change_thousand_barrels == -1200.0
        assert restored.provider == "eia"
        assert restored.region == "Cushing"

    def test_negative_inventory_rejected(self):
        with pytest.raises(Exception):
            EIAInventory(
                id=str(uuid4()),
                series_id="PET.WCESTUS1.W",
                region="Cushing",
                commodity="crude_oil",
                value=-100.0,
                date=datetime.now(timezone.utc),
            )

    def test_provider_default(self):
        inv = EIAInventory(
            id=str(uuid4()),
            series_id="X",
            region="PADD 1",
            commodity="gasoline",
            value=100.0,
            date=datetime.now(timezone.utc),
        )
        assert inv.provider == "eia"


class TestEIASpotPrice:
    def test_round_trip(self):
        price = EIASpotPrice(
            id=str(uuid4()),
            series_id="PET.RWTC.W",
            commodity="wti",
            price=72.50,
            date=datetime(2026, 3, 26, tzinfo=timezone.utc),
            daily_change=-1.25,
        )
        data = price.model_dump(mode="json")
        restored = EIASpotPrice.model_validate(data)
        assert restored.price_usd == 72.50
        assert restored.daily_change_usd == -1.25
        assert restored.commodity == "wti"

    def test_zero_price_rejected(self):
        with pytest.raises(Exception):
            EIASpotPrice(
                id=str(uuid4()),
                series_id="X",
                commodity="wti",
                price=0.0,
                date=datetime.now(timezone.utc),
            )


# ---------------------------------------------------------------------------
# AIS Vessel Models
# ---------------------------------------------------------------------------

class TestVesselPosition:
    def test_round_trip(self):
        pos = VesselPosition(
            id=str(uuid4()),
            timestamp=datetime.now(timezone.utc),
            mmsi=123456789,
            vessel_name="FRONT ALTA",
            vessel_type_category="crude_tanker",
            latitude=29.0,
            longitude=-89.5,
            speed_knots=12.5,
            heading_degrees=270.0,
            destination="HOUSTON",
        )
        data = pos.model_dump(mode="json")
        restored = VesselPosition.model_validate(data)
        assert restored.mmsi == 123456789
        assert restored.vessel_name == "FRONT ALTA"
        assert restored.provider == "aisstream"

    def test_invalid_mmsi_rejected(self):
        with pytest.raises(Exception):
            VesselPosition(
                id=str(uuid4()),
                timestamp=datetime.now(timezone.utc),
                mmsi=12345,  # too short
                vessel_type_category="tanker",
                latitude=0,
                longitude=0,
                speed_knots=0,
                heading_degrees=0,
            )

    def test_latitude_bounds(self):
        with pytest.raises(Exception):
            VesselPosition(
                id=str(uuid4()),
                timestamp=datetime.now(timezone.utc),
                mmsi=123456789,
                vessel_type_category="tanker",
                latitude=91.0,
                longitude=0,
                speed_knots=0,
                heading_degrees=0,
            )


class TestPort:
    def test_round_trip(self):
        port = Port(
            id=str(uuid4()),
            port_id="USHOU",
            name="Houston",
            country="US",
            unlocode="USHOU",
            latitude=29.76,
            longitude=-95.37,
            primary_commodities=["crude_oil", "lng"],
        )
        data = port.model_dump(mode="json")
        restored = Port.model_validate(data)
        assert restored.port_id == "USHOU"
        assert "crude_oil" in restored.primary_commodities


class TestPortVisit:
    def test_round_trip(self):
        visit = PortVisit(
            visit_id="visit:123456789:USHOU:20260326",
            mmsi=123456789,
            vessel_name="FRONT ALTA",
            port_id="USHOU",
            port_name="Houston",
            arrival_time=datetime(2026, 3, 24, tzinfo=timezone.utc),
            departure_time=datetime(2026, 3, 26, tzinfo=timezone.utc),
            dwell_hours=48.0,
            inferred_activity="loading",
            inferred_cargo="crude_oil",
        )
        data = visit.model_dump(mode="json")
        restored = PortVisit.model_validate(data)
        assert restored.dwell_hours == 48.0
        assert restored.inferred_activity == "loading"


# ---------------------------------------------------------------------------
# Weather Models
# ---------------------------------------------------------------------------

class TestWeatherObservation:
    def test_round_trip(self):
        obs = WeatherObservation(
            id=str(uuid4()),
            timestamp=datetime(2024, 7, 15, 12, 0, tzinfo=timezone.utc),
            location_id="nyc",
            latitude=40.7128,
            longitude=-74.0060,
            temperature_c=28.5,
            precipitation_mm=0.0,
            windspeed_ms=3.2,
            pressure_hpa=1013.25,
            humidity_pct=65.0,
        )
        data = obs.model_dump(mode="json")
        restored = WeatherObservation.model_validate(data)
        assert restored.temperature_c == 28.5
        assert restored.provider == "era5"

    def test_temperature_bounds(self):
        with pytest.raises(Exception):
            WeatherObservation(
                id=str(uuid4()),
                timestamp=datetime.now(timezone.utc),
                location_id="bad",
                latitude=0,
                longitude=0,
                temperature_c=100.0,  # impossible
                precipitation_mm=0,
                windspeed_ms=0,
                pressure_hpa=1013,
                humidity_pct=50,
            )

    def test_humidity_bounds(self):
        with pytest.raises(Exception):
            WeatherObservation(
                id=str(uuid4()),
                timestamp=datetime.now(timezone.utc),
                location_id="bad",
                latitude=0,
                longitude=0,
                temperature_c=20,
                precipitation_mm=0,
                windspeed_ms=0,
                pressure_hpa=1013,
                humidity_pct=150,  # impossible
            )


class TestWeatherForecast:
    def test_round_trip(self):
        fc = WeatherForecast(
            timestamp=datetime.now(timezone.utc),
            location_id="chicago",
            latitude=41.88,
            longitude=-87.63,
            temperature_c=5.0,
            precipitation_mm=2.5,
            windspeed_ms=8.0,
            forecast_horizon_hours=48,
            model=WeatherModel.GFS.value,
        )
        data = fc.model_dump(mode="json")
        restored = WeatherForecast.model_validate(data)
        assert restored.model == "gfs"
        assert restored.provider == "open-meteo"


class TestTemperatureAnomaly:
    def test_extreme_warm(self):
        a = TemperatureAnomaly(
            location_id="nyc",
            forecast_date=datetime.now(timezone.utc),
            forecast_temp_c=35.0,
            baseline_temp_c=25.0,
            baseline_stddev_c=4.0,
            anomaly_c=10.0,
            z_score=2.5,
            anomaly_category=AnomalyCategory.EXTREME_WARM.value,
        )
        assert a.anomaly_category == "extreme_warm"
        assert a.z_score > 2.0

    def test_normal(self):
        a = TemperatureAnomaly(
            location_id="chicago",
            forecast_date=datetime.now(timezone.utc),
            forecast_temp_c=20.0,
            baseline_temp_c=19.5,
            baseline_stddev_c=5.0,
            anomaly_c=0.5,
            z_score=0.1,
        )
        assert a.anomaly_category == "normal"


class TestHDDCDDForecast:
    def test_round_trip(self):
        hdd = HDDCDDForecast(
            latitude=41.88,
            longitude=-87.63,
            location_id="chicago",
            forecast_days=7,
            daily=[
                {"date": "2026-01-15", "avg_temp_c": -5.0, "avg_temp_f": 23.0, "hdd": 42.0, "cdd": 0.0},
            ],
            cumulative_hdd=294.0,
            cumulative_cdd=0.0,
            interpretation="Net heating demand: 294 HDD over 7 days.",
        )
        data = hdd.model_dump(mode="json")
        restored = HDDCDDForecast.model_validate(data)
        assert restored.cumulative_hdd == 294.0
        assert restored.cumulative_cdd == 0.0


# ---------------------------------------------------------------------------
# Graph Models
# ---------------------------------------------------------------------------

class TestGISNode:
    def test_vessel_node(self):
        node = GISNode(
            node_id="vessel:123456789",
            node_type=GISNodeType.VESSEL.value,
            properties={"name": "FRONT ALTA", "mmsi": 123456789, "flag": "NO"},
        )
        data = node.model_dump(mode="json")
        restored = GISNode.model_validate(data)
        assert restored.node_id == "vessel:123456789"
        assert restored.properties["mmsi"] == 123456789

    def test_port_node(self):
        node = GISNode(
            node_id="port:USHOU",
            node_type=GISNodeType.PORT.value,
            properties={"name": "Houston", "country": "US", "lat": 29.76, "lon": -95.37},
        )
        assert node.node_type == "port"


class TestGISEdge:
    def test_visit_edge(self):
        edge = GISEdge(
            edge_id="visit:123456789:USHOU:20260326",
            source_node_id="vessel:123456789",
            target_node_id="port:USHOU",
            edge_type=EdgeType.VISITED.value,
            timestamp=datetime.now(timezone.utc),
            properties={"dwell_hours": 48, "inferred_cargo": "crude_oil"},
        )
        data = edge.model_dump(mode="json")
        restored = GISEdge.model_validate(data)
        assert restored.edge_type == "visited"
        assert restored.properties["dwell_hours"] == 48

    def test_node_edge_relationship(self):
        vessel = GISNode(
            node_id="vessel:123456789",
            node_type="vessel",
            properties={"name": "FRONT ALTA"},
        )
        port = GISNode(
            node_id="port:USHOU",
            node_type="port",
            properties={"name": "Houston"},
        )
        edge = GISEdge(
            edge_id="visit:123456789:USHOU:20260326",
            source_node_id=vessel.node_id,
            target_node_id=port.node_id,
            edge_type="visited",
            properties={"dwell_hours": 48},
        )
        assert edge.source_node_id == "vessel:123456789"
        assert edge.target_node_id == "port:USHOU"
