from uuid import UUID
from pydantic import BaseModel
from typing import Optional, Any
from decimal import Decimal
from datetime import datetime


class OrderCreate(BaseModel):
    external_ref: Optional[str] = None
    tenant_id: str
    customer_name: str
    customer_address: str
    total: Decimal
    items: list[dict[str, Any]] = []


class StatusUpdate(BaseModel):
    status: str


class OrderResponse(BaseModel):
    id: UUID
    external_ref: str
    status: str
    tenant_id: str
    customer_name: Optional[str]
    customer_address: Optional[str]
    total: Optional[Decimal]
    items: list
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    delivered_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class StatusHistoryResponse(BaseModel):
    id: UUID
    status: str
    source: str
    created_at: datetime

    model_config = {"from_attributes": True}
