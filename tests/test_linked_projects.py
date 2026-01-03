# tests/test_linked_projects.py
"""Tests for linked projects feature."""

import pytest


class TestProjectLinkModel:
    """Test the ProjectLink model exists and has correct fields."""

    def test_project_link_model_exists(self):
        """ProjectLink model should be importable."""
        from daem0nmcp.models import ProjectLink

        assert hasattr(ProjectLink, '__tablename__')
        assert ProjectLink.__tablename__ == "project_links"

    def test_project_link_has_required_fields(self):
        """ProjectLink should have source_path, linked_path, relationship."""
        from daem0nmcp.models import ProjectLink

        # Check columns exist
        columns = {c.name for c in ProjectLink.__table__.columns}
        assert "id" in columns
        assert "source_path" in columns
        assert "linked_path" in columns
        assert "relationship" in columns
        assert "created_at" in columns


class TestProjectLinkMigration:
    """Test the migration creates the project_links table."""

    @pytest.fixture
    def db_manager(self, tmp_path):
        from daem0nmcp.database import DatabaseManager
        return DatabaseManager(str(tmp_path / "storage"))

    @pytest.mark.asyncio
    async def test_migration_creates_project_links_table(self, db_manager):
        """Migration should create project_links table."""
        await db_manager.init_db()

        import sqlite3
        conn = sqlite3.connect(str(db_manager.db_path))
        cursor = conn.cursor()
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='project_links'"
        )
        result = cursor.fetchone()
        conn.close()

        assert result is not None, "project_links table should exist"
