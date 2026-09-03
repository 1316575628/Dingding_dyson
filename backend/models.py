from sqlalchemy import Column, Integer, String, Time, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class ShiftTemplate(Base):
    __tablename__ = "shift_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    color = Column(String, default="#1890ff")
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    remind_before_min = Column(Integer, default=15)
    remind_after_min = Column(Integer, default=30)
    overtime_min = Column(Integer, default=0)
    is_rest = Column(Boolean, default=False)

    schedules = relationship("Schedule", back_populates="shift_template")


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, unique=True, index=True, nullable=False)
    shift_template_id = Column(Integer, ForeignKey("shift_templates.id"), nullable=False)

    shift_template = relationship("ShiftTemplate", back_populates="schedules")


class PushLog(Base):
    __tablename__ = "push_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, nullable=False)
    log_type = Column(String, nullable=False)
    channel = Column(String, nullable=False)
    result = Column(String, nullable=False)
    level = Column(String, nullable=False, default="info")
    detail = Column(String, nullable=True)


class SystemConfig(Base):
    __tablename__ = "system_configs"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(String, nullable=True)
