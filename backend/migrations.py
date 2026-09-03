from sqlalchemy import text
from sqlalchemy.engine import Engine


def _column_exists(engine: Engine, table: str, column: str) -> bool:
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT name FROM pragma_table_info(:table)"),
            {"table": table},
        )
        columns = {row[0] for row in result}
    return column in columns


def run_migrations(engine: Engine):
    """SQLite 轻量级迁移：在启动时补齐后续版本新增的字段。"""
    if not _column_exists(engine, "push_logs", "level"):
        with engine.connect() as conn:
            conn.execute(
                text("ALTER TABLE push_logs ADD COLUMN level VARCHAR NOT NULL DEFAULT 'info'")
            )
            conn.commit()
