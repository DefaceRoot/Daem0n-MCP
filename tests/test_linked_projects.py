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
