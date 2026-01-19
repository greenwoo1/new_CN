from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    username: str
    email: str
    role: str
    status: str
    number: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(UserBase):
    password: Optional[str] = None

class User(UserBase):
    id: int
    class Config:
        orm_mode = True

class History(BaseModel):
    id: int
    target_id: int
    target_type: str
    user: str
    action: str
    changes: str
    timestamp: datetime
    class Config:
        orm_mode = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class ServerBase(BaseModel):
    os: str
    ip: str
    additional_ip: Optional[str] = None
    comments: Optional[str] = None
    hoster: str
    status: str
    group_id: Optional[int] = None
    project_id: Optional[int] = None
    country: str
    ssh_user: Optional[str] = 'root'
    ssh_port: Optional[int] = 22
    cont_pass: Optional[str] = None

class ServerCreate(ServerBase):
    ssh_pass: str

class Server(ServerBase):
    id: int
    group: Optional["Group"]
    project: Optional["Project"]
    class Config:
        orm_mode = True

class DomainBase(BaseModel):
    name: str
    group_id: Optional[int] = None
    status: str

class DomainCreate(DomainBase):
    pass

class Domain(DomainBase):
    id: int
    ns: Optional[str] = None
    a_record: Optional[str] = None
    aaaa_record: Optional[str] = None
    group: Optional["Group"]
    class Config:
        orm_mode = True

class ProjectBase(BaseModel):
    title: str

class ProjectCreate(ProjectBase):
    pass

class Project(ProjectBase):
    id: int
    class Config:
        orm_mode = True

class GroupBase(BaseModel):
    title: str
    project_id: Optional[int] = None
    status: str
    description: Optional[str] = None

class GroupCreate(GroupBase):
    pass

class Group(GroupBase):
    id: int
    project: Optional[Project]
    class Config:
        orm_mode = True

class FinanceBase(BaseModel):
    server_id: int
    price: float
    account_status: str
    payment_date: datetime

class FinanceCreate(FinanceBase):
    pass

class Finance(FinanceBase):
    id: int
    server: Server
    class Config:
        orm_mode = True
