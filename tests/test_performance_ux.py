"""Tests for Iteration 4: Performance & UX."""

import pytest
from pathlib import Path


class TestParseTreeCache:
    """Test parse tree caching."""

    def test_cache_hit_on_unchanged_file(self, tmp_path):
        """Second parse should hit cache."""
        from daem0nmcp.code_indexer import TreeSitterIndexer

        indexer = TreeSitterIndexer()
        if not indexer.available:
            pytest.skip("tree-sitter not available")

        py_file = tmp_path / "sample.py"
        py_file.write_text("def hello(): pass")

        # First parse - miss
        list(indexer.index_file(py_file, tmp_path))
        assert indexer.cache_stats["misses"] >= 1

        # Second parse - hit
        list(indexer.index_file(py_file, tmp_path))
        assert indexer.cache_stats["hits"] >= 1

    def test_cache_invalidation_on_change(self, tmp_path):
        """Changed file should invalidate cache."""
        from daem0nmcp.code_indexer import TreeSitterIndexer

        indexer = TreeSitterIndexer()
        if not indexer.available:
            pytest.skip("tree-sitter not available")

        py_file = tmp_path / "sample.py"
        py_file.write_text("def hello(): pass")
        list(indexer.index_file(py_file, tmp_path))

        py_file.write_text("def goodbye(): pass")
        list(indexer.index_file(py_file, tmp_path))

        # Both should be misses (content changed)
        assert indexer.cache_stats["misses"] >= 2
