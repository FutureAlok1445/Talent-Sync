"""
backend/app/ml/scorer.py
Loads trained XGBoost model and scores student-job pairs.
Falls back to policy-first scoring when model is absent.
"""

from __future__ import annotations

from pathlib import Path

import logging
import json
import joblib
import numpy as np
import xgboost as xgb

from app.ml.feature_builder import SAFE_FEATURES, build_features

ARTIFACTS_DIR = Path(__file__).parent / "artifacts"
logger = logging.getLogger(__name__)

# These MUST match the training feature order exactly.
# Loaded dynamically when the model file is present.
_DEFAULT_FEATURES = SAFE_FEATURES

# Policy-first blend to better reflect real-world internship shortlisting.
POLICY_WEIGHT = 0.55
SIMILARITY_WEIGHT = 0.25
ML_WEIGHT = 0.20

FALLBACK_POLICY_WEIGHT = 0.85
FALLBACK_SIMILARITY_WEIGHT = 0.15


class MatchScorer:

    def __init__(self) -> None:
        self._model = None
        self._scaler = None
        self._model_available: bool | None = None
        self._feature_names: list[str] = _DEFAULT_FEATURES

    @property
    def has_model(self) -> bool:
        """Check if the trained model file exists."""
        if self._model_available is None:
            # Try .pkl first (new), fall back to .joblib (legacy)
            self._model_available = (
                (ARTIFACTS_DIR / "scorer_model.pkl").exists()
                or (ARTIFACTS_DIR / "scorer_model.joblib").exists()
            )
            if not self._model_available:
                logger.warning(
                    "Scorer model not found at %s. "
                    "Using similarity-only fallback. "
                    "Run: python -m scripts.train_scorer to train the model.",
                    ARTIFACTS_DIR,
                )
        return self._model_available

    @property
    def model(self):
        if self._model is None:
            # Try .pkl first, fall back to .joblib
            pkl_path = ARTIFACTS_DIR / "scorer_model.pkl"
            joblib_path = ARTIFACTS_DIR / "scorer_model.joblib"
            model_path = pkl_path if pkl_path.exists() else joblib_path

            scaler_path = ARTIFACTS_DIR / "feature_scaler.pkl"

            if not model_path.exists():
                return None

            try:
                self._model = joblib.load(model_path)

                if scaler_path.exists():
                    self._scaler = joblib.load(scaler_path)

                self._model_available = True

                # Load feature names if available
                fn_path = ARTIFACTS_DIR / "feature_names.json"
                if fn_path.exists():
                    self._feature_names = json.loads(fn_path.read_text())
            except Exception as e:
                logger.error("Failed to load ML artifacts (corrupted files). Falling back to similarity. Error: %s", e)
                self._model = None
                self._scaler = None
                self._model_available = False

        return self._model

    @property
    def scaler(self):
        if self._scaler is None:
            self.model  # Trigger loading
        return self._scaler

    def _feature_value(self, features: np.ndarray, name: str, default: float = 0.0) -> float:
        try:
            idx = self._feature_names.index(name)
        except ValueError:
            return default
        if idx >= len(features):
            return default
        return float(features[idx])

    def policy_merit_score(self, features: np.ndarray, similarity: float) -> float:
        """Compute skills-first merit score from engineered features."""
        skill_overlap = np.clip(self._feature_value(features, "skill_overlap_ratio"), 0.0, 1.0)
        semantic_score = np.clip(self._feature_value(features, "semantic_score", similarity), 0.0, 1.0)
        skill_gap = np.clip(self._feature_value(features, "skill_gap_score"), 0.0, 1.0)

        experience_score = np.clip(self._feature_value(features, "experience_score"), 0.0, 1.0)
        experience_months = np.clip(self._feature_value(features, "experience_months") / 24.0, 0.0, 1.0)
        domain_match = np.clip(self._feature_value(features, "domain_match"), 0.0, 1.0)

        cgpa_signal = np.clip(self._feature_value(features, "cgpa_normalized"), 0.0, 1.0)
        location_match = np.clip(self._feature_value(features, "location_match"), 0.0, 1.0)
        preference_score = np.clip(self._feature_value(features, "preference_score"), 0.0, 1.0)
        branch_eligible = np.clip(self._feature_value(features, "branch_eligible", 1.0), 0.0, 1.0)

        profile_completeness = np.clip(self._feature_value(features, "profile_completeness"), 0.0, 1.0)
        sbert_similarity = np.clip(self._feature_value(features, "sbert_similarity", similarity), 0.0, 1.0)

        backlog_penalty = self._feature_value(features, "backlog_penalty")
        backlog_risk = np.clip(-backlog_penalty, 0.0, 1.0)
        backlog_signal = 1.0 - backlog_risk

        skill_signal = np.clip((0.6 * skill_overlap) + (0.4 * semantic_score), 0.0, 1.0)
        experience_signal = np.clip((0.65 * experience_score) + (0.35 * experience_months), 0.0, 1.0)

        policy_score = (
            (0.34 * skill_signal)
            + (0.22 * experience_signal)
            + (0.14 * domain_match)
            + (0.06 * backlog_signal)
            + (0.05 * location_match)
            + (0.03 * preference_score)
            + (0.05 * cgpa_signal)
            + (0.01 * branch_eligible)
            + (0.01 * profile_completeness)
            + (0.02 * sbert_similarity)
            - (0.12 * skill_gap)
        )

        return float(np.clip(policy_score, 0.0, 1.0))

    # ── Feature builder ───────────────────────────────────────────────────────

    def build_features(
        self,
        student: dict,
        job: dict,
        similarity: float,
    ) -> np.ndarray:
        """Build feature vector using shared Feature Builder."""
        return build_features(student, job, similarity)

    # ── Scoring ───────────────────────────────────────────────────────────────

    def score(
        self,
        student: dict,
        job: dict,
        similarity: float,
    ) -> float:
        """Score one student-job pair. Returns final_score 0–1."""
        raw_features = self.build_features(student, job, similarity).reshape(1, -1)
        policy_score = self.policy_merit_score(raw_features[0], similarity)

        if not self.has_model or self.model is None:
            # Fallback: policy-first score with a light semantic anchor.
            final = (FALLBACK_POLICY_WEIGHT * policy_score) + (FALLBACK_SIMILARITY_WEIGHT * similarity)
            return round(min(max(final, 0.0), 1.0), 4)

        features = raw_features

        # Ensure scaling if scaler exists
        if self.scaler is not None:
            features = self.scaler.transform(features)

        ml_score = float(self.model.predict_proba(features)[0][1])
        final = (
            (POLICY_WEIGHT * policy_score)
            + (SIMILARITY_WEIGHT * similarity)
            + (ML_WEIGHT * ml_score)
        )
        return round(min(max(final, 0.0), 1.0), 4)

    def score_batch(
        self,
        student: dict,
        jobs: list[dict],
        similarities: list[float],
    ) -> tuple[list[float], list[float]]:
        """Score batch of jobs. Returns (final_scores, ml_scores)."""
        if not jobs:
            return [], []

        # Assemble numpy matrix
        raw_feature_matrix = np.array([
            self.build_features(student, j, sim)
            for j, sim in zip(jobs, similarities)
        ], dtype=np.float32)

        policy_scores = [
            self.policy_merit_score(raw_feature_matrix[i], similarities[i])
            for i in range(len(jobs))
        ]

        if not self.has_model or self.model is None:
            final_scores = []
            for i, sim in enumerate(similarities):
                score = (FALLBACK_POLICY_WEIGHT * policy_scores[i]) + (FALLBACK_SIMILARITY_WEIGHT * sim)
                final_scores.append(round(min(max(score, 0.0), 1.0), 4))
            return final_scores, [0.0] * len(jobs)

        feature_matrix = raw_feature_matrix

        # Ensure scaling
        if self.scaler is not None:
            feature_matrix = self.scaler.transform(feature_matrix)

        ml_scores = self.model.predict_proba(feature_matrix)[:, 1]

        final_scores = []
        for i, ml_score in enumerate(ml_scores):
            f_score = (
                (POLICY_WEIGHT * policy_scores[i])
                + (SIMILARITY_WEIGHT * similarities[i])
                + (ML_WEIGHT * float(ml_score))
            )
            final_scores.append(round(min(max(f_score, 0.0), 1.0), 4))

        return final_scores, ml_scores.tolist()