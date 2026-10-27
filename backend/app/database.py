"""
Database configuration and session management for BrandShield AI.
Supports SQLite (local dev / persistent volume) and PostgreSQL (managed cloud DB).
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Configurable database URL via environment variable; defaults to local SQLite file
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./brandshield.db")

# Cloud providers (e.g., Render, Heroku) supply "postgres://", which SQLAlchemy 1.4+ requires as "postgresql://"
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite requires check_same_thread=False for FastAPI concurrency; other engines (PostgreSQL, MySQL) do not support it
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """
    FastAPI dependency that yields a database session and ensures it is closed after request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
