from pydantic import BaseModel
from typing import Optional, List

class User(BaseModel):
    username: str
    password: str
    budget: float = 0.0

class Group(BaseModel):
    id: str
    name: str
    admin: str = ""
    join_key: str = ""
    members: List[str] = []

class Expense(BaseModel):
    id: str
    title: str
    amount: float
    category: str
    date: str
    notes: Optional[str] = ""
    spent_by: Optional[str] = ""
    user_id: Optional[str] = None
    group_id: Optional[str] = None
