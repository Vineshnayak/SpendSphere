from fastapi import APIRouter, HTTPException, Header
from models.schemas import Expense
from database.connection import expenses_collection, groups_collection
from routes.ws_routes import manager
from services.auth_service import SECRET_KEY, ALGORITHM
import jwt

router = APIRouter()

@router.post("/expense")
async def add_expense(expense: Expense, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        token = authorization.split(" ")[1]
        username = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM]).get("sub")
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

    expense.user_id = username
    expenses_collection.insert_one(expense.model_dump())
    
    if expense.group_id:
        await manager.broadcast_to_group(
            expense.group_id,
            {"type": "new_expense", "expense": expense.model_dump()}
        )
        
    return {"message": "Expense added successfully"}

@router.get("/expenses")
def get_expenses(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        token = authorization.split(" ")[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_groups = list(groups_collection.find({"members": username}))
    group_ids = [g["id"] for g in user_groups]

    query = {
        "$or": [
            {"user_id": username, "group_id": {"$in": [None, ""]}},
            {"group_id": {"$in": group_ids}}
        ]
    }
    expenses = list(expenses_collection.find(query, {"_id": 0}))
    return expenses

@router.delete("/expense/{expense_id}")
def delete_expense(expense_id: str, authorization: str = Header(None)):
    result = expenses_collection.delete_one({"id": expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"message": "Expense deleted successfully"}
