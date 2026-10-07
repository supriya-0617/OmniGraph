from app.routes.analytics import router as analytics_router
from app.routes.auth import router as auth_router
from app.routes.entities import router as entities_router
from app.routes.graph import router as graph_router
from app.routes.health import router as health_router

__all__ = [
	"analytics_router",
	"auth_router",
	"entities_router",
	"graph_router",
	"health_router",
]
