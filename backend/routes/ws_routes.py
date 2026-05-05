from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from database.connection import groups_collection
from services.auth_service import SECRET_KEY, ALGORITHM
import jwt

router = APIRouter()

class ConnectionManager:
    def __init__(self):
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
                if member in self.active_connections:
                    for connection in self.active_connections[member]:
                        try:
                            await connection.send_json(message)
                        except:
                            pass

manager = ConnectionManager()

@router.websocket("/ws/{token}")
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
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, username)
