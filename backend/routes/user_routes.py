from fastapi import APIRouter, HTTPException, Header
from database.connection import users_collection
from services.auth_service import SECRET_KEY, ALGORITHM
from pydantic import BaseModel
import jwt

router = APIRouter()

class BudgetUpdate(BaseModel):
    budget: float

def get_current_user(authorization: str):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        token = authorization.split(" ")[1]
        username = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM]).get("sub")
        return username
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.get("/user")
def get_user_profile(authorization: str = Header(None)):
    username = get_current_user(authorization)
    user = users_collection.find_one({"username": username}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Handle older users without a budget field
    if "budget" not in user:
        user["budget"] = 0.0
        users_collection.update_one({"username": username}, {"$set": {"budget": 0.0}})
        
    return user

@router.put("/user/budget")
def update_budget(payload: BudgetUpdate, authorization: str = Header(None)):
    username = get_current_user(authorization)
    
    if payload.budget < 0:
        raise HTTPException(status_code=400, detail="Budget cannot be negative")
        
    result = users_collection.update_one(
        {"username": username},
        {"$set": {"budget": payload.budget}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"message": "Budget updated successfully", "budget": payload.budget}
