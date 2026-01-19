from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="Admin 1L")
    ip = Column(String, nullable=True)
    number = Column(String, nullable=True)
    status = Column(String, default="active")

class Server(Base):
    __tablename__ = "servers"
    id = Column(Integer, primary_key=True, index=True)
    os = Column(String)
    ip = Column(String)
    additional_ip = Column(Text, default="")
    comments = Column(Text, default="")
    hoster = Column(String)
    status = Column(String, default="Running")
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    country = Column(String)
    ssh_user = Column(String, default="root")
    ssh_pass = Column(String)
    cont_pass = Column(String, default="")
    ssh_port = Column(Integer, default=22)

    group = relationship("Group", back_populates="servers")
    project = relationship("Project")

class Domain(Base):
    __tablename__ = "domains"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    status = Column(String, default="Active")
    ns = Column(String, nullable=True)
    a_record = Column(String, nullable=True)
    aaaa_record = Column(String, nullable=True)

    group = relationship("Group", back_populates="domains")

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, unique=True, index=True)

    groups = relationship("Group", back_populates="project")

class Group(Base):
    __tablename__ = "groups"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, unique=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    status = Column(String, default="Enabled")
    description = Column(Text, nullable=True)

    project = relationship("Project", back_populates="groups")
    servers = relationship("Server", back_populates="group")
    domains = relationship("Domain", back_populates="group")

class Finance(Base):
    __tablename__ = "finance"
    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id"))
    price = Column(Float)
    account_status = Column(String)
    payment_date = Column(DateTime)

    server = relationship("Server")

class History(Base):
    __tablename__ = "history"
    id = Column(Integer, primary_key=True, index=True)
    target_id = Column(Integer)
    target_type = Column(String)
    user = Column(String)
    action = Column(String)
    changes = Column(Text)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
