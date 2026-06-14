import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_ref = Column(String(100), unique=True, nullable=False, index=True)
    status = Column(String(50), nullable=False, default="pendiente")
    tenant_id = Column(String(100), nullable=False)
    customer_name = Column(String(200))
    customer_address = Column(Text)
    total = Column(Numeric(10, 2))
    items = Column(JSONB, default=list)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    delivered_at = Column(DateTime(timezone=True), nullable=True)


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="admin")


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    status = Column(String(50), nullable=False)
    source = Column(String(20), nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
