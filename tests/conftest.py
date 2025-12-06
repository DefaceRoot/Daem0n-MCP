# tests/conftest.py
"""
Pytest configuration for Daem0nMCP tests.
"""

import pytest

# Register pytest-asyncio plugin
pytest_plugins = ('pytest_asyncio',)


def pytest_configure(config):
    """Configure custom pytest markers."""
    config.addinivalue_line(
        "markers", "asyncio: mark test as an asyncio test."
    )
