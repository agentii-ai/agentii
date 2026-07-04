"""Graph models: adjacency tables for vessel-port-commodity relationships."""

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from .enums import EdgeType, GISNodeType


class GISNode(BaseModel):
    """Graph node representing a vessel, port, commodity, or country."""

    model_config = ConfigDict(frozen=True, populate_by_name=True)

    node_id: str = Field(description="e.g. vessel:123456789, port:USHOU, commodity:crude_oil")
    node_type: str = GISNodeType.VESSEL.value
    properties: dict = Field(
        default_factory=dict,
        description="JSONB: name, coordinates, metadata",
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class GISEdge(BaseModel):
    """Graph edge representing a relationship between two nodes."""

    model_config = ConfigDict(frozen=True, populate_by_name=True)

    edge_id: str = Field(description="e.g. visit:123456789:USHOU:20260326")
    source_node_id: str
    target_node_id: str
    edge_type: str = EdgeType.VISITED.value
    timestamp: Optional[datetime] = None
    properties: dict = Field(
        default_factory=dict,
        description="JSONB: dwell_hours, cargo_inference, etc.",
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
