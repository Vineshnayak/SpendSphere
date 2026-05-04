from pydantic import BaseModel
from typing import Optional, List

class User(BaseModel):
    username: str
    password: str

class Group(BaseModel):
    id: str
    name: str
    members: List[str] = []

class Expense(BaseModel):
    id: str
    title: str
    amount: float
    category: str
    date: str
    notes: Optional[str] = ""
    user_id: Optional[str] = None
    group_id: Optional[str] = None  # NEW: Connects expense to a group
