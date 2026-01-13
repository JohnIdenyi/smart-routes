# backend/app/routing_utils.py

LONDON_BBOX = {
    "min_lat": 51.2868,
    "max_lat": 51.6919,
    "min_lon": -0.5103,
    "max_lon": 0.3340
}

def in_greater_london(lat: float, lon: float) -> bool:
    return (
        LONDON_BBOX["min_lat"] <= lat <= LONDON_BBOX["max_lat"] and
        LONDON_BBOX["min_lon"] <= lon <= LONDON_BBOX["max_lon"]
    )

def edge_cost(length: float, risk: float, preference: str) -> float:
    """Pure cost function: no graph, no osmnx, easy to test."""
    length = float(length) if length is not None else 1.0
    risk = float(risk) if risk is not None else 0.0

    if preference == "fastest":
        return length
    if preference == "balanced":
        return length * (1 + 0.5 * risk)
    if preference == "safest":
        return length * (1 + 2.0 * risk)
    return length
