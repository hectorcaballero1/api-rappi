import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from app.database import engine, Base, SessionLocal
from app.routes import orders, auth
from app.routes.orders import catalog_router, webhook_router
from app.models import User
from app.auth import hash_password


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_admin()
    yield


def seed_admin():
    username = os.getenv("RAPPI_ADMIN_USER", "admin")
    password = os.getenv("RAPPI_ADMIN_PASSWORD", "admin123")
    db: Session = SessionLocal()
    try:
        if not db.query(User).filter(User.username == username).first():
            db.add(User(username=username, password_hash=hash_password(password), role="admin"))
            db.commit()
    finally:
        db.close()


app = FastAPI(title="Rappi Simulator API", lifespan=lifespan)
app.include_router(auth.router)
app.include_router(orders.router)
app.include_router(catalog_router)
app.include_router(webhook_router)


@app.get("/health")
def health():
    return {"status": "ok"}


app.mount("/", StaticFiles(directory="app/static", html=True), name="static")
