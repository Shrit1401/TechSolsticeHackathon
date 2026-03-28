from __future__ import annotations

import math
import sys
import unittest
from pathlib import Path

_repo_root = Path(__file__).resolve().parents[1]
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))

from ml.detector_signals import fuse_signals


class TestDetectorSignals(unittest.TestCase):
    def test_all_quiet(self) -> None:
        r = fuse_signals(
            metric_score=0.0,
            metric_anomaly=False,
            log_enabled=True,
            log_anomaly=False,
            log_distance=0.0,
            trace_enabled=True,
            trace_anomaly=False,
            trace_score=0.0,
            trace_slow_service=None,
        )
        self.assertFalse(r["anomaly"])
        self.assertEqual(r["confidence"], 0.0)
        self.assertIsNone(r["root_cause"])

    def test_confidence_doc_example(self) -> None:
        tau = 3.0
        d_log = -tau * math.log(1.0 - 0.8)
        r = fuse_signals(
            metric_score=0.9,
            metric_anomaly=True,
            log_enabled=True,
            log_anomaly=True,
            log_distance=d_log,
            trace_enabled=True,
            trace_anomaly=True,
            trace_score=0.85,
            trace_slow_service="payment-service",
            log_distance_tau=tau,
        )
        self.assertAlmostEqual(r["confidence"], 0.8525, places=6)

    def test_multi_signal_requires_two_strong_when_three_layers(self) -> None:
        r = fuse_signals(
            metric_score=0.9,
            metric_anomaly=True,
            log_enabled=True,
            log_anomaly=False,
            log_distance=0.0,
            trace_enabled=True,
            trace_anomaly=False,
            trace_score=0.0,
            trace_slow_service=None,
        )
        self.assertFalse(r["anomaly"])

    def test_multi_signal_pass_two_strong(self) -> None:
        tau = 3.0
        d_log = -tau * math.log(1.0 - 0.7)
        r = fuse_signals(
            metric_score=0.7,
            metric_anomaly=True,
            log_enabled=True,
            log_anomaly=True,
            log_distance=d_log,
            trace_enabled=True,
            trace_anomaly=False,
            trace_score=0.0,
            trace_slow_service=None,
            log_distance_tau=tau,
        )
        self.assertTrue(r["anomaly"])

    def test_single_layer_metric_only(self) -> None:
        r = fuse_signals(
            metric_score=0.8,
            metric_anomaly=True,
            log_enabled=False,
            log_anomaly=False,
            log_distance=0.0,
            trace_enabled=False,
            trace_anomaly=False,
            trace_score=0.0,
            trace_slow_service=None,
        )
        self.assertTrue(r["anomaly"])

    def test_root_cause_when_trace_strong(self) -> None:
        tau = 3.0
        d_log = -tau * math.log(1.0 - 0.7)
        r = fuse_signals(
            metric_score=0.7,
            metric_anomaly=True,
            log_enabled=True,
            log_anomaly=True,
            log_distance=d_log,
            trace_enabled=True,
            trace_anomaly=True,
            trace_score=0.85,
            trace_slow_service="payment-service",
            log_distance_tau=tau,
        )
        self.assertEqual(r["root_cause"], "payment-service")


if __name__ == "__main__":
    unittest.main()
