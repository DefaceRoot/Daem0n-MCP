"""Tests for temporal versioning of memories."""

import pytest
import tempfile
import shutil
from datetime import datetime, timezone

from daem0nmcp.models import Memory, MemoryVersion


@pytest.fixture
def temp_storage():
    """Create a temporary storage directory."""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir, ignore_errors=True)


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


@pytest.mark.asyncio
async def test_memory_versions_table_created(temp_storage):
    """Verify memory_versions table is created during migration."""
    from daem0nmcp.database import DatabaseManager

    db = DatabaseManager(temp_storage)
    await db.init_db()

    async with db.get_session() as session:
        from sqlalchemy import text
        result = await session.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='memory_versions'")
        )
        tables = result.fetchall()

    await db.close()
    assert len(tables) == 1
    assert tables[0][0] == "memory_versions"


@pytest.mark.asyncio
async def test_memory_versions_has_composite_index(temp_storage):
    """Verify memory_versions table has composite index on (memory_id, version_number)."""
    from daem0nmcp.database import DatabaseManager

    db = DatabaseManager(temp_storage)
    await db.init_db()

    async with db.get_session() as session:
        from sqlalchemy import text
        result = await session.execute(
            text("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='memory_versions'")
        )
        indexes = {row[0]: row[1] for row in result.fetchall()}

    await db.close()
    # Check that the composite index exists on (memory_id, version_number)
    composite_index_found = any(
        'memory_id' in (sql or '') and 'version_number' in (sql or '')
        for sql in indexes.values()
    )
    assert composite_index_found, \
        f"Expected composite index on (memory_id, version_number), found indexes: {indexes}"
