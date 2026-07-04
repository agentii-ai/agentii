"""Tests for biotech models: CatalystEvent, FDADecision."""

from datetime import date, datetime, timezone

import pytest
from pydantic import ValidationError

from agentii_models.biotech import CatalystEvent, FDADecision
from agentii_models.enums import CatalystType, FDADecisionOutcome


class TestCatalystEvent:
    def test_construction(self):
        event = CatalystEvent(
            event_id="cat-001",
            symbol="MRNA",
            drug_name="mRNA-1273",
            indication="COVID-19",
            catalyst_type=CatalystType.PDUFA,
            event_date=date(2026, 4, 15),
            approval_probability=0.75,
            expected_move_pct=30.0,
            source="fda.gov",
            created_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
        )
        assert event.symbol == "MRNA"
        assert event.catalyst_type == CatalystType.PDUFA

    def test_json_serialization(self):
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
        assert '"pdufa"' in json_str
        assert '"2026-04-15"' in json_str

    def test_event_date_none_when_estimated(self):
        event = CatalystEvent(
            event_id="cat-002",
            symbol="MRNA",
            drug_name="mRNA-1273",
            indication="RSV",
            catalyst_type=CatalystType.PHASE_3,
            event_date=None,
            date_is_estimated=True,
            created_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
        )
        assert event.event_date is None
        assert event.date_is_estimated is True

    def test_approval_probability_range(self):
        with pytest.raises(ValidationError, match="approval_probability must be between"):
            CatalystEvent(
                event_id="cat-003",
                symbol="MRNA",
                drug_name="mRNA-1273",
                indication="COVID-19",
                catalyst_type=CatalystType.PDUFA,
                approval_probability=1.5,
                created_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
            )

    def test_approval_probability_negative(self):
        with pytest.raises(ValidationError, match="approval_probability must be between"):
            CatalystEvent(
                event_id="cat-004",
                symbol="MRNA",
                drug_name="mRNA-1273",
                indication="COVID-19",
                catalyst_type=CatalystType.PDUFA,
                approval_probability=-0.1,
                created_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
            )


class TestFDADecision:
    def test_construction(self):
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
        assert decision.outcome == FDADecisionOutcome.APPROVED

    def test_actual_move_pct(self):
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
        assert decision.actual_move_pct == pytest.approx(140.0)

    def test_actual_move_pct_none_when_prices_missing(self):
        decision = FDADecision(
            decision_id="fda-002",
            symbol="MRNA",
            drug_name="mRNA-1273",
            indication="COVID-19",
            outcome=FDADecisionOutcome.CRL,
            decision_date=date(2026, 4, 15),
        )
        assert decision.actual_move_pct is None

    def test_crl_reasons(self):
        decision = FDADecision(
            decision_id="fda-003",
            symbol="XYZ",
            drug_name="XYZ-001",
            indication="Oncology",
            outcome=FDADecisionOutcome.CRL,
            decision_date=date(2026, 5, 1),
            crl_reasons=["Manufacturing deficiencies", "Insufficient efficacy data"],
        )
        assert len(decision.crl_reasons) == 2

    def test_frozen(self):
        decision = FDADecision(
            decision_id="fda-001",
            symbol="MRNA",
            drug_name="mRNA-1273",
            indication="COVID-19",
            outcome=FDADecisionOutcome.APPROVED,
            decision_date=date(2026, 4, 15),
        )
        with pytest.raises(ValidationError):
            decision.outcome = FDADecisionOutcome.CRL
