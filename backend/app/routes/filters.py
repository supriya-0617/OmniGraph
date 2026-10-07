from datetime import date

from fastapi import Query

from app.schemas.filters import GraphFilters


def get_graph_filters(
    from_: date | None = Query(default=None, alias="from"),
    to: date | None = None,
    platform: str | None = None,
    min_severity: float = Query(default=0, ge=0, le=1),
    min_density: int = Query(default=1, ge=1, le=10),
) -> GraphFilters:
    return GraphFilters(
        from_date=from_,
        to_date=to,
        platform=platform,
        min_severity=min_severity,
        min_density=min_density,
    )