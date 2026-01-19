from pydantic import BaseModel
from typing import Optional, List

class LoginSchema(BaseModel):
    username: str
    password: str

class ServerOut(BaseModel):
    id: int
    os: str
    ip: str
    hoster: str
    status: str
    project: str
    group: str

    class Config:
        from_attributes = True
