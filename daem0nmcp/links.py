# daem0nmcp/links.py
"""
Link Manager - Handles cross-project linking for multi-repo awareness.

Links enable reading memories from related projects while maintaining
strict write isolation (each project only writes to its own database).
"""

import logging
from typing import Any, Dict, List, Optional
from sqlalchemy import select, delete

from .database import DatabaseManager
from .models import ProjectLink

logger = logging.getLogger(__name__)


class LinkManager:
    """
    Manages project links for cross-repo awareness.

    Usage:
        link_mgr = LinkManager(db_manager)
        await link_mgr.link_projects("/repos/backend", "/repos/client", "same-project")
        links = await link_mgr.list_linked_projects("/repos/backend")
    """

    def __init__(self, db: DatabaseManager):
        self.db = db

    async def link_projects(
        self,
        source_path: str,
        linked_path: str,
        relationship: str = "related",
        label: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a link between two projects.

        Args:
            source_path: The current project path (where link is stored)
            linked_path: The project to link to
            relationship: Type of relationship (same-project, upstream, downstream, related)
            label: Optional human-readable label

        Returns:
            Status dict with link details
        """
        async with self.db.get_session() as session:
            # Check if link already exists
            existing = await session.execute(
                select(ProjectLink).where(
                    ProjectLink.source_path == source_path,
                    ProjectLink.linked_path == linked_path
                )
            )
            if existing.scalar_one_or_none():
                return {
                    "status": "already_linked",
                    "source_path": source_path,
                    "linked_path": linked_path
                }

            # Create new link
            link = ProjectLink(
                source_path=source_path,
                linked_path=linked_path,
                relationship=relationship,
                label=label
            )
            session.add(link)

            logger.info(f"Linked {source_path} -> {linked_path} ({relationship})")

            return {
                "status": "linked",
                "source_path": source_path,
                "linked_path": linked_path,
                "relationship": relationship,
                "label": label
            }

    async def unlink_projects(
        self,
        source_path: str,
        linked_path: str
    ) -> Dict[str, Any]:
        """
        Remove a link between two projects.

        Args:
            source_path: The current project path
            linked_path: The project to unlink

        Returns:
            Status dict
        """
        async with self.db.get_session() as session:
            result = await session.execute(
                delete(ProjectLink).where(
                    ProjectLink.source_path == source_path,
                    ProjectLink.linked_path == linked_path
                )
            )

            if result.rowcount > 0:
                logger.info(f"Unlinked {source_path} -> {linked_path}")
                return {
                    "status": "unlinked",
                    "source_path": source_path,
                    "linked_path": linked_path
                }
            else:
                return {
                    "status": "not_found",
                    "source_path": source_path,
                    "linked_path": linked_path
                }

    async def list_linked_projects(
        self,
        source_path: str
    ) -> List[Dict[str, Any]]:
        """
        List all projects linked from the given source.

        Args:
            source_path: The project to list links for

        Returns:
            List of link dicts with linked_path, relationship, label
        """
        async with self.db.get_session() as session:
            result = await session.execute(
                select(ProjectLink).where(
                    ProjectLink.source_path == source_path
                )
            )
            links = result.scalars().all()

            return [
                {
                    "id": link.id,
                    "linked_path": link.linked_path,
                    "relationship": link.relationship,
                    "label": link.label,
                    "created_at": link.created_at.isoformat() if link.created_at else None
                }
                for link in links
            ]

    async def get_linked_db_managers(
        self,
        source_path: str
    ) -> List[tuple]:
        """
        Get DatabaseManager instances for all linked projects.

        Returns list of (linked_path, db_manager) tuples.
        Only returns managers for projects that exist and have .daem0n directories.

        Args:
            source_path: The current project path

        Returns:
            List of (path, DatabaseManager) tuples
        """
        from pathlib import Path

        links = await self.list_linked_projects(source_path)
        managers = []

        for link in links:
            linked_path = link["linked_path"]
            # Use correct storage path pattern: .daem0nmcp/storage
            storage_path = Path(linked_path) / ".daem0nmcp" / "storage"

            if storage_path.exists():
                try:
                    linked_db = DatabaseManager(str(storage_path))
                    await linked_db.init_db()
                    managers.append((linked_path, linked_db))
                except Exception as e:
                    logger.warning(f"Could not open linked project {linked_path}: {e}")

        return managers
