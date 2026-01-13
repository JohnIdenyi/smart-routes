import pytest
from app.routing_utils import in_greater_london, edge_cost

def test_in_greater_london_true():
    # Central London
    assert in_greater_london(51.5074, -0.1278) is True

def test_in_greater_london_false():
    # Outside Greater London (example: Birmingham-ish)
    assert in_greater_london(52.4862, -1.8904) is False

def test_edge_cost_fastest_returns_length():
    assert edge_cost(length=100, risk=0.9, preference="fastest") == 100

def test_edge_cost_balanced_penalizes_risk():
    assert edge_cost(length=100, risk=0.2, preference="balanced") == pytest.approx(110)

def test_edge_cost_safest_penalizes_more():
    # cost = 100 * (1 + 2*0.2) = 140
    assert edge_cost(length=100, risk=0.2, preference="safest") == 140

def test_edge_cost_unknown_preference_falls_back_to_length():
    assert edge_cost(length=100, risk=999, preference="whatever") == 100

def test_edge_cost_handles_missing_values():
    assert edge_cost(length=None, risk=None, preference="safest") == 1.0
