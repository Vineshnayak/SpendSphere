from fastapi import APIRouter, HTTPException
from models.schemas import User
from database.connection import users_collection
from services.auth_service import hash_password, verify_password, create_access_token
import pymongo

router = APIRouter()

@router.post("/signup")
def signup(user: User):
    hashed_pw = hash_password(user.password)
    new_user = {"username": user.username, "password": hashed_pw, "budget": 0.0}
    try:
        users_collection.insert_one(new_user)
        return {"message": "User created successfully!"}
    except pymongo.errors.DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Username already exists")

@router.post("/login")
def login(user: User):
    db_user = users_collection.find_one({"username": user.username})
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}
