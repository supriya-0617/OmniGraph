from datetime import date, datetime, time, timezone

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class GraphFilters(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_date: date | None = Field(default=None, alias="from")
    to_date: date | None = Field(default=None, alias="to")
    platform: str | None = None
    min_severity: float = Field(default=0, ge=0, le=1)
    min_density: int = Field(default=1, ge=1, le=10)

    @field_validator("platform", mode="before")
    @classmethod
    def normalize_platform(cls, value: str | None) -> str | None:
        if value is None or not value.strip() or value.strip().upper() == "ALL":
            return None
        return value.strip()

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.from_date and self.to_date and self.from_date > self.to_date:
            raise ValueError("from must be before or equal to to")
        return self

    def cypher_params(self) -> dict:
        start = (
            datetime.combine(self.from_date, time.min, tzinfo=timezone.utc)
            if self.from_date
            else None
        )
        end = (
            datetime.combine(self.to_date, time.max, tzinfo=timezone.utc)
            if self.to_date
            else None
        )
        return {
            "from_date": start,
            "to_date": end,
            "platform": self.platform,
            "min_severity": self.min_severity,
        }

    def post_predicates(self, variable: str = "p") -> str:
        return (
            f"($from_date IS NULL OR {variable}.timestamp >= $from_date) "
            f"AND ($to_date IS NULL OR {variable}.timestamp <= $to_date) "
            f"AND ($platform IS NULL OR {variable}.platform = $platform) "
            f"AND {variable}.severity >= $min_severity"
        )