import os
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Order, StatusHistory
from app.schemas import OrderCreate, StatusUpdate, OrderResponse, StatusHistoryResponse
from app.routes.auth import get_current_user

router = APIRouter(prefix="/orders", tags=["orders"], dependencies=[Depends(get_current_user)])
MRSUSHI_API_URL = os.getenv("MRSUSHI_API_URL", "http://localhost:3000")
RAPPI_WEBHOOK_SECRET = os.getenv("RAPPI_WEBHOOK_SECRET", "")


def verify_api_key(x_api_key: str = Header(None)):
    if x_api_key != os.getenv("RAPPI_WEBHOOK_SECRET", "change-me"):
        raise HTTPException(401, "Unauthorized")
    return True


@router.post("")
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    order = Order(
        external_ref=payload.external_ref,
        tenant_id=payload.tenant_id,
        status="pendiente",
        customer_name=payload.customer_name,
        customer_address=payload.customer_address,
        total=payload.total,
        items=payload.items,
    )
    db.add(order)
    db.add(StatusHistory(order_id=order.id, status="pendiente", source="rappi"))
    db.commit()
    db.refresh(order)
    return {
        "id": str(order.id),
        "external_ref": order.external_ref,
        "status": order.status,
    }


@router.get("")
def list_orders(db: Session = Depends(get_db)):
    orders = db.query(Order).order_by(Order.created_at.desc()).all()
    return [OrderResponse.model_validate(o) for o in orders]


@router.get("/{external_ref}")
def get_order(external_ref: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.external_ref == external_ref).first()
    if not order:
        raise HTTPException(404, "Order not found")
    return OrderResponse.model_validate(order)


@router.get("/{external_ref}/history")
def get_order_history(external_ref: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.external_ref == external_ref).first()
    if not order:
        raise HTTPException(404, "Order not found")
    history = (
        db.query(StatusHistory)
        .filter(StatusHistory.order_id == order.id)
        .order_by(StatusHistory.created_at)
        .all()
    )
    return [StatusHistoryResponse.model_validate(h) for h in history]


@router.post("/{external_ref}/status")
def receive_status(
    external_ref: str,
    payload: StatusUpdate,
    db: Session = Depends(get_db),
    _=Depends(verify_api_key),
):
    order = db.query(Order).filter(Order.external_ref == external_ref).first()
    if not order:
        raise HTTPException(404, "Order not found")
    order.status = payload.status
    order.updated_at = datetime.now(timezone.utc)
    db.add(StatusHistory(order_id=order.id, status=payload.status, source="mrsushi"))
    db.commit()
    return {"message": "Status updated", "status": order.status}


@router.post("/{external_ref}/deliver")
def simulate_delivery(external_ref: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.external_ref == external_ref).first()
    if not order:
        raise HTTPException(404, "Order not found")

    order.status = "entregado"
    order.delivered_at = datetime.now(timezone.utc)
    order.updated_at = datetime.now(timezone.utc)
    db.add(StatusHistory(order_id=order.id, status="entregado", source="rappi"))
    db.commit()

    try:
        httpx.post(
            f"{MRSUSHI_API_URL}/webhooks/rappi/delivered",
            json={
                "tenantId": order.tenant_id,
                "orderId": external_ref,
                "deliveredAt": int(order.delivered_at.timestamp()),
            },
            headers={"x-api-key": RAPPI_WEBHOOK_SECRET},
        )
    except httpx.RequestError:
        pass

    return {"message": "Delivery completed", "external_ref": external_ref}
