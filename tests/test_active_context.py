"""Tests for active working context management."""

import pytest
from datetime import datetime, timezone

from daem0nmcp.models import ActiveContextItem


class TestActiveContextModel:
    """Test the ActiveContextItem model structure."""

    def test_active_context_item_has_required_fields(self):
        """ActiveContextItem should have all required fields."""
        item = ActiveContextItem(
            project_path="/test/project",
            memory_id=42,
            priority=1,
            added_at=datetime.now(timezone.utc),
            reason="Critical auth decision"
        )

        assert item.project_path == "/test/project"
        assert item.memory_id == 42
        assert item.priority == 1
        assert item.reason == "Critical auth decision"
