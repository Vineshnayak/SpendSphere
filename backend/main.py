from fastapi import Header
from auth import hash_password, verify_password, create_access_token, SECRET_KEY, ALGORITHM
import jwt
from models import Expense, User
from database import client, expenses_collection, users_collection
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from database import client, expenses_collection
from models import Expense
from models import Expense, User, Group
from database import client, expenses_collection, users_collection, groups_collection
from fastapi import FastAPI, HTTPException, Header, WebSocket, WebSocketDisconnect


app = FastAPI()
class ConnectionManager:
    def __init__(self):
        # Maps username to a list of their active WebSocket connections
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, username: str):
        await websocket.accept()
        if username not in self.active_connections:
            self.active_connections[username] = []
        self.active_connections[username].append(websocket)

    def disconnect(self, websocket: WebSocket, username: str):
        if username in self.active_connections:
            self.active_connections[username].remove(websocket)
            if not self.active_connections[username]:
                del self.active_connections[username]

    async def broadcast_to_group(self, group_id: str, message: dict):
        group = groups_collection.find_one({"id": group_id})
        if group:
            for member in group["members"]:
                # Only send if the group member is currently online
                if member in self.active_connections:
                    for connection in self.active_connections[member]:
                        try:
                            await connection.send_json(message)
                        except:
                            pass

manager = ConnectionManager()

# --- NEW CORS SETUP ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ----------------------



@app.on_event("startup")
def startup_db_client():
    client.admin.command('ping')
    print("Successfully connected to MongoDB!")

@app.on_event("shutdown")
def shutdown_db_client():
    client.close()

# --- NEW EXPENSE ENDPOINTS ---
@app.post("/signup")
def signup(user: User):
    # Check if user exists
    if users_collection.find_one({"username": user.username}):
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Hash password and save
    hashed_pw = hash_password(user.password)
    new_user = {"username": user.username, "password": hashed_pw}
    users_collection.insert_one(new_user)
    return {"message": "User created successfully!"}

@app.post("/login")
def login(user: User):
    db_user = users_collection.find_one({"username": user.username})
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Generate token
    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}

@app.post("/expense")
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
    
    # NEW: Broadcast to the group via WebSockets if this is a group expense!
    if expense.group_id:
        await manager.broadcast_to_group(
            expense.group_id,
            {"type": "new_expense", "expense": expense.model_dump()}
        )
        
    return {"message": "Expense added successfully"}


@app.get("/expenses")
def get_expenses(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        token = authorization.split(" ")[1]
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

    # 1. Find all groups the user is a part of
    user_groups = list(groups_collection.find({"members": username}))
    group_ids = [g["id"] for g in user_groups]

    # 2. Get personal expenses OR expenses belonging to their groups
    query = {
        "$or": [
            {"user_id": username, "group_id": {"$in": [None, ""]}},
            {"group_id": {"$in": group_ids}}
        ]
    }
    expenses = list(expenses_collection.find(query, {"_id": 0}))
    return expenses


@app.put("/expense/{expense_id}")
def update_expense(expense_id: str, expense: Expense):
    # Find the expense by our custom 'id' and update its fields
    result = expenses_collection.update_one(
        {"id": expense_id}, 
        {"$set": expense.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"message": "Expense updated successfully"}

@app.delete("/expense/{expense_id}")
def delete_expense(expense_id: str):
    result = expenses_collection.delete_one({"id": expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"message": "Expense deleted successfully"}
# --- GROUP ENDPOINTS ---
@app.post("/groups")
def create_group(group: Group, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        token = authorization.split(" ")[1]
        username = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM]).get("sub")
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

    # The creator is automatically the first member
    group.members = [username]
    groups_collection.insert_one(group.model_dump())
    return {"message": "Group created!"}

@app.get("/groups")
def get_groups(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        token = authorization.split(" ")[1]
        username = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM]).get("sub")
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Return groups where this user is in the members list
    groups = list(groups_collection.find({"members": username}, {"_id": 0}))
    return groups

@app.post("/groups/{group_id}/members")
def add_member(group_id: str, new_member: dict, authorization: str = Header(None)):
    # new_member will be {"username": "friend_name"}
    member_username = new_member.get("username")
    
    # Check if the user exists in our system
    if not users_collection.find_one({"username": member_username}):
        raise HTTPException(status_code=404, detail="User not found")
        
    groups_collection.update_one(
        {"id": group_id},
        {"$addToSet": {"members": member_username}} # addToSet prevents duplicates
    )
    return {"message": f"Added {member_username} to group!"}
# --- WEBSOCKET ENDPOINT ---
@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
    except:
        await websocket.close(code=1008)
        return
        
    await manager.connect(websocket, username)
    try:
        while True:
            # Keep connection open and wait for messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, username)
