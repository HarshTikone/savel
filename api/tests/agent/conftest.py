"""Agent tests need no database, so override the parent's DB-bound session fixture."""
import pytest


@pytest.fixture(scope="session", autouse=True)
def database():
    yield
