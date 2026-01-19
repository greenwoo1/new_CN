from sqlalchemy import Column, Integer, String, Text, DateTime
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True)
    hashed_password = Column(String)
    role = Column(String)
    status = Column(String)

class Server(Base):
    __tablename__ = "servers"
    id = Column(Integer, primary_key=True, index=True)
    os = Column(String)
    ip = Column(String)
    additional_ip = Column(Text, default="")
    comments = Column(Text, default="")
    hoster = Column(String)
    status = Column(String)
    group = Column(String)
    project = Column(String)
    country = Column(String)
    ssh_user = Column(String, default="root")
    ssh_pass = Column(String)
    cont_pass = Column(String, default="")
    ssh_port = Column(Integer, default=22)

class Domain(Base):
    __tablename__ = "domains"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    group = Column(String)
    status = Column(String)
    ns = Column(String)
    a_record = Column(String)
    aaaa_record = Column(String)

class History(Base):
    __tablename__ = "history"
    id = Column(Integer, primary_key=True, index=True)
    target_id = Column(Integer)
    target_type = Column(String)
    user = Column(String, default="admin")
    action = Column(String)
    changes = Column(Text) # ТУТ ТЕПЕР ТЕКСТ, А НЕ JSON
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
