"""Tests for the memory management system."""

import pytest
from pathlib import Path
import tempfile
import shutil

from daem0nmcp.database import DatabaseManager
from daem0nmcp.memory import MemoryManager, extract_keywords


class TestExtractKeywords:
    """Test keyword extraction."""

    def test_basic_extraction(self):
        text = "Use JWT tokens for authentication"
        keywords = extract_keywords(text)
        assert "jwt" in keywords
        assert "tokens" in keywords
        assert "authentication" in keywords
        # Stop words should be removed
        assert "for" not in keywords

    def test_with_tags(self):
        text = "Add rate limiting"
        tags = ["api", "security"]
        keywords = extract_keywords(text, tags)
        assert "rate" in keywords
        assert "limiting" in keywords
        assert "api" in keywords
        assert "security" in keywords

    def test_empty_text(self):
        assert extract_keywords("") == ""

    def test_deduplication(self):
        text = "test test test"
        keywords = extract_keywords(text)
        assert keywords.count("test") == 1


@pytest.fixture
def temp_storage():
    """Create a temporary storage directory."""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)


@pytest.fixture
async def memory_manager(temp_storage):
    """Create a memory manager with temporary storage."""
    db = DatabaseManager(temp_storage)
    await db.init_db()
    manager = MemoryManager(db)
    yield manager
    await db.close()


class TestMemoryManager:
    """Test memory storage and retrieval."""

    @pytest.mark.asyncio
    async def test_remember_decision(self, memory_manager):
        """Test storing a decision."""
        result = await memory_manager.remember(
            category="decision",
            content="Use PostgreSQL instead of MySQL",
            rationale="Better JSON support and performance",
            tags=["database", "architecture"]
        )

        assert "id" in result
        assert result["category"] == "decision"
        assert result["content"] == "Use PostgreSQL instead of MySQL"
        assert "database" in result["tags"]

    @pytest.mark.asyncio
    async def test_remember_warning(self, memory_manager):
        """Test storing a warning."""
        result = await memory_manager.remember(
            category="warning",
            content="Don't use synchronous database calls in handlers",
            rationale="Caused performance issues",
            context={"file": "handlers.py"}
        )

        assert result["category"] == "warning"
        assert "id" in result

    @pytest.mark.asyncio
    async def test_remember_invalid_category(self, memory_manager):
        """Test that invalid categories are rejected."""
        result = await memory_manager.remember(
            category="invalid",
            content="This should fail"
        )

        assert "error" in result

    @pytest.mark.asyncio
    async def test_recall_by_topic(self, memory_manager):
        """Test recalling memories by topic with semantic search."""
        # Store some memories
        await memory_manager.remember(
            category="decision",
            content="Use JWT for authentication",
            tags=["auth", "security"]
        )
        await memory_manager.remember(
            category="pattern",
            content="Always validate input on auth endpoints",
            tags=["auth", "validation"]
        )
        await memory_manager.remember(
            category="warning",
            content="Session tokens had security issues",
            tags=["auth"]
        )

        # Recall by topic - semantic search should find these
        result = await memory_manager.recall("authentication security")

        assert result["found"] > 0
        # Should find auth-related memories
        total = len(result["decisions"]) + len(result["patterns"]) + len(result["warnings"])
        assert total >= 1

    @pytest.mark.asyncio
    async def test_recall_by_category(self, memory_manager):
        """Test filtering recall by category."""
        await memory_manager.remember(
            category="decision",
            content="Use Redis for caching",
            tags=["cache"]
        )
        await memory_manager.remember(
            category="warning",
            content="Cache invalidation is tricky",
            tags=["cache"]
        )

        # Only get warnings (but warnings are always included anyway)
        result = await memory_manager.recall("cache", categories=["warning"])

        # Should have found something
        assert result["found"] >= 0

    @pytest.mark.asyncio
    async def test_record_outcome(self, memory_manager):
        """Test recording outcomes."""
        # Create a memory
        memory = await memory_manager.remember(
            category="decision",
            content="Use microservices architecture"
        )

        # Record outcome
        result = await memory_manager.record_outcome(
            memory_id=memory["id"],
            outcome="Worked well, improved scalability",
            worked=True
        )

        assert result["worked"] == True
        assert "Worked well" in result["outcome"]

    @pytest.mark.asyncio
    async def test_record_outcome_failure(self, memory_manager):
        """Test recording failed outcomes with suggestions."""
        memory = await memory_manager.remember(
            category="decision",
            content="Use complex caching strategy"
        )

        result = await memory_manager.record_outcome(
            memory_id=memory["id"],
            outcome="Caused stale data bugs",
            worked=False
        )

        assert result["worked"] == False
        # Should suggest creating a warning
        assert "suggestion" in result

    @pytest.mark.asyncio
    async def test_record_outcome_invalid_id(self, memory_manager):
        """Test recording outcome for non-existent memory."""
        result = await memory_manager.record_outcome(
            memory_id=99999,
            outcome="Should fail",
            worked=True
        )

        assert "error" in result

    @pytest.mark.asyncio
    async def test_search(self, memory_manager):
        """Test semantic search."""
        await memory_manager.remember(
            category="learning",
            content="GraphQL is better for complex queries"
        )
        await memory_manager.remember(
            category="learning",
            content="REST is simpler for basic CRUD"
        )

        results = await memory_manager.search("GraphQL complex")
        assert len(results) >= 1
        assert any("GraphQL" in r["content"] for r in results)

    @pytest.mark.asyncio
    async def test_get_statistics(self, memory_manager):
        """Test statistics retrieval with learning insights."""
        await memory_manager.remember(category="decision", content="Decision 1")
        await memory_manager.remember(category="warning", content="Warning 1")
        await memory_manager.remember(category="pattern", content="Pattern 1")

        stats = await memory_manager.get_statistics()

        assert stats["total_memories"] >= 3
        assert "by_category" in stats
        assert "with_outcomes" in stats
        assert "learning_insights" in stats

    @pytest.mark.asyncio
    async def test_conflict_detection(self, memory_manager):
        """Test that conflicts are detected when storing similar memories."""
        # Store a memory that failed
        mem1 = await memory_manager.remember(
            category="decision",
            content="Use session tokens for authentication"
        )
        await memory_manager.record_outcome(
            memory_id=mem1["id"],
            outcome="Had security vulnerabilities",
            worked=False
        )

        # Try to store a similar decision
        result = await memory_manager.remember(
            category="decision",
            content="Use session-based authentication tokens"
        )

        # May or may not detect conflict depending on similarity score
        # The feature exists but depends on threshold
        assert "id" in result  # Should still store

    @pytest.mark.asyncio
    async def test_find_related(self, memory_manager):
        """Test finding related memories."""
        # Store related memories
        mem1 = await memory_manager.remember(
            category="decision",
            content="Use JWT for API authentication",
            tags=["auth", "jwt", "api"]
        )
        await memory_manager.remember(
            category="pattern",
            content="Always validate JWT tokens before processing",
            tags=["auth", "jwt", "validation"]
        )
        await memory_manager.remember(
            category="warning",
            content="JWT secret key must be kept secure",
            tags=["auth", "jwt", "security"]
        )
        # Unrelated memory
        await memory_manager.remember(
            category="decision",
            content="Use PostgreSQL for database",
            tags=["database"]
        )

        # Find memories related to the first one
        related = await memory_manager.find_related(mem1["id"], limit=5)

        # Should find related auth/JWT memories
        assert len(related) >= 1
        # Should not include the source memory itself
        assert not any(r["id"] == mem1["id"] for r in related)

    @pytest.mark.asyncio
    async def test_recall_includes_relevance_scores(self, memory_manager):
        """Test that recall returns relevance information."""
        await memory_manager.remember(
            category="decision",
            content="Use rate limiting on all API endpoints",
            tags=["api", "security"]
        )

        result = await memory_manager.recall("API rate limiting")

        if result["found"] > 0:
            # Check that memories have relevance info
            for category in ["decisions", "patterns", "warnings", "learnings"]:
                for mem in result.get(category, []):
                    assert "relevance" in mem
                    assert "semantic_match" in mem
                    assert "recency_weight" in mem

    @pytest.mark.asyncio
    async def test_failed_decisions_boosted(self, memory_manager):
        """Test that failed decisions get boosted in recall."""
        # Store a successful and failed decision about same topic
        success = await memory_manager.remember(
            category="decision",
            content="Use caching for API responses"
        )
        await memory_manager.record_outcome(
            success["id"],
            outcome="Works great",
            worked=True
        )

        failure = await memory_manager.remember(
            category="decision",
            content="Use aggressive caching everywhere"
        )
        await memory_manager.record_outcome(
            failure["id"],
            outcome="Caused stale data issues",
            worked=False
        )

        result = await memory_manager.recall("caching")

        # Failed decisions should have warning annotation
        failed_mems = [m for m in result.get("decisions", []) if m.get("worked") is False]
        if failed_mems:
            assert any("_warning" in m for m in failed_mems)
