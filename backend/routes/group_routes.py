from fastapi import APIRouter, HTTPException, Header
from models.schemas import Group
from database.connection import groups_collection, users_collection
from services.auth_service import SECRET_KEY, ALGORITHM
import jwt
import pymongo
import string
import random

router = APIRouter()

def get_current_user(authorization: str):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        token = authorization.split(" ")[1]
        username = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM]).get("sub")
        return username
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

def generate_join_key(length=6):
    characters = string.ascii_uppercase + string.digits
    return ''.join(random.choice(characters) for _ in range(length))

@router.post("/groups")
def create_group(group: Group, authorization: str = Header(None)):
    username = get_current_user(authorization)
    
    group.admin = username
    group.members = [username]
    
    # Generate unique join key
    while True:
        key = generate_join_key()
        if not groups_collection.find_one({"join_key": key}):
            group.join_key = key
            break

    try:
        groups_collection.insert_one(group.model_dump())
        return {"message": "Group created!", "join_key": group.join_key}
    except pymongo.errors.DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Group name already exists")

@router.get("/groups")
def get_groups(authorization: str = Header(None)):
    username = get_current_user(authorization)
    groups = list(groups_collection.find({"members": username}, {"_id": 0}))
    return groups

@router.post("/groups/join")
def join_group(payload: dict, authorization: str = Header(None)):
    username = get_current_user(authorization)
    join_key = payload.get("join_key", "").upper().strip()
    
    if not join_key:
        raise HTTPException(status_code=400, detail="Join key is required")

    group = groups_collection.find_one({"join_key": join_key})
    if not group:
        raise HTTPException(status_code=404, detail="Invalid join key")
        
    if username in group.get("members", []):
        raise HTTPException(status_code=400, detail="You are already in this group")

    groups_collection.update_one(
        {"join_key": join_key},
        {"$addToSet": {"members": username}}
    )
    return {"message": f"Successfully joined {group['name']}!"}

@router.delete("/groups/{group_id}/members/{target_username}")
def remove_member(group_id: str, target_username: str, authorization: str = Header(None)):
    username = get_current_user(authorization)
    group = groups_collection.find_one({"id": group_id})
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    if group.get("admin") != username:
        raise HTTPException(status_code=403, detail="Only the admin can remove members")
        
    if target_username == username:
        raise HTTPException(status_code=400, detail="Admin cannot remove themselves")

    if target_username not in group.get("members", []):
        raise HTTPException(status_code=404, detail="User not in group")

    groups_collection.update_one(
        {"id": group_id},
        {"$pull": {"members": target_username}}
    )
    return {"message": f"Removed {target_username} from the group"}

@router.delete("/groups/{group_id}")
def delete_group(group_id: str, authorization: str = Header(None)):
    username = get_current_user(authorization)
    group = groups_collection.find_one({"id": group_id})
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    if group.get("admin") != username:
        raise HTTPException(status_code=403, detail="Only the admin can delete the group")

    groups_collection.delete_one({"id": group_id})
    return {"message": "Group deleted successfully"}

@router.delete("/groups/{group_id}/leave")
def leave_group(group_id: str, authorization: str = Header(None)):
    username = get_current_user(authorization)
    group = groups_collection.find_one({"id": group_id})
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    members = group.get("members", [])
    if username not in members:
        raise HTTPException(status_code=400, detail="You are not in this group")
        
    # If the user is the admin
    if group.get("admin") == username:
        members.remove(username)
        if len(members) == 0:
            # Delete group if no members left
            groups_collection.delete_one({"id": group_id})
            return {"message": "Left and deleted empty group"}
        else:
            # Transfer ownership to the next oldest member
            new_admin = members[0]
            groups_collection.update_one(
                {"id": group_id},
                {"$set": {"admin": new_admin, "members": members}}
            )
            return {"message": f"Left group. Ownership transferred to {new_admin}"}
    else:
        # Normal member leaving
        groups_collection.update_one(
            {"id": group_id},
            {"$pull": {"members": username}}
        )
        return {"message": "Left group successfully"}
