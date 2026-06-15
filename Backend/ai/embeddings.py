"""
KGC Lite — Embeddings
sentence-transformers for converting complaint text to vectors.
Used for finding similar complaints and clustering into issues.
"""

import logging
import numpy as np
from typing import Optional
from functools import lru_cache

logger = logging.getLogger(__name__)

# ── LAZY MODEL LOADING ───────────────────────────────────────────
# Model loads once on first use, cached for all subsequent calls

_model = None

def get_model():
    """Load sentence-transformer model lazily (only when first needed)."""
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            from config import settings
            logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
            _model = SentenceTransformer(settings.EMBEDDING_MODEL)
            logger.info("✅ Embedding model loaded")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            _model = None
    return _model


# ── GENERATE EMBEDDING ────────────────────────────────────────────

def generate_embedding(text: str) -> Optional[list[float]]:
    """
    Convert complaint text to a 384-dimensional vector.
    Returns None if model unavailable.
    """
    model = get_model()
    if model is None:
        logger.warning("Embedding model unavailable — similarity disabled")
        return None

    try:
        # Truncate very long texts (model limit is 256 tokens)
        text = text[:512] if len(text) > 512 else text
        embedding = model.encode(text, convert_to_numpy=True)
        return embedding.tolist()
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        return None


# ── COSINE SIMILARITY ─────────────────────────────────────────────

def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """
    Calculate cosine similarity between two embedding vectors.
    Returns value between -1.0 and 1.0 (higher = more similar).
    1.0 = identical, 0.0 = unrelated, -1.0 = opposite
    """
    if not vec_a or not vec_b:
        return 0.0

    a = np.array(vec_a, dtype=np.float32)
    b = np.array(vec_b, dtype=np.float32)

    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return float(np.dot(a, b) / (norm_a * norm_b))


# ── COMPUTE CENTROID ─────────────────────────────────────────────

def compute_centroid(embeddings: list[list[float]]) -> Optional[list[float]]:
    """
    Compute the average (centroid) embedding for a group of complaint embeddings.
    Used to represent the "center" of an issue cluster.
    Updated each time a new complaint is added to an issue.
    """
    if not embeddings:
        return None

    valid = [e for e in embeddings if e is not None]
    if not valid:
        return None

    matrix = np.array(valid, dtype=np.float32)
    centroid = np.mean(matrix, axis=0)
    return centroid.tolist()


# ── FIND BEST MATCHING ISSUE ──────────────────────────────────────

def find_similar_issue(
    new_embedding: list[float],
    existing_issues: list[dict],
    threshold: float = 0.82,
    same_category: bool = True,
) -> Optional[dict]:
    """
    Given a new complaint embedding, find the most similar existing issue.

    Args:
        new_embedding:   embedding of new complaint
        existing_issues: list of dicts with {id, embedding_centroid, category, location}
        threshold:       minimum similarity score to be considered a match
        same_category:   if True, only match issues in same category

    Returns:
        The best matching issue dict with added "similarity" key, or None
    """
    if not new_embedding or not existing_issues:
        return None

    best_match = None
    best_score = threshold  # must beat threshold to count

    for issue in existing_issues:
        centroid = issue.get("embedding_centroid")
        if not centroid:
            continue

        score = cosine_similarity(new_embedding, centroid)

        logger.debug(
            f"Issue {issue.get('id')} similarity: {score:.3f} "
            f"(threshold: {threshold})"
        )

        if score > best_score:
            best_score = score
            best_match = {**issue, "similarity": round(score, 4)}

    if best_match:
        logger.info(
            f"✅ Similar issue found: {best_match.get('id')} "
            f"similarity={best_match['similarity']}"
        )
    else:
        logger.info(
            f"No similar issue found above threshold {threshold}"
        )

    return best_match
