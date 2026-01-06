"""Tests for temporal versioning of memories."""

import pytest
from datetime import datetime, timezone

from daem0nmcp.models import Memory, MemoryVersion


class TestMemoryVersionModel:
    """Test the MemoryVersion model structure."""

    def test_memory_version_has_required_fields(self):
        """MemoryVersion should have all required fields."""
        version = MemoryVersion(
            memory_id=1,
            version_number=1,
            content="Original content",
            rationale="Original rationale",
            context={},
            tags=["test"],
            change_type="created",
            changed_at=datetime.now(timezone.utc)
        )

        assert version.memory_id == 1
        assert version.version_number == 1
        assert version.content == "Original content"
        assert version.change_type == "created"
