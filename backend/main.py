from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database.connection import client
from routes import auth_routes, group_routes, expense_routes, ws_routes, user_routes

app = FastAPI(title="SpendSphere API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_db_client():
    client.admin.command('ping')
    print("Successfully connected to MongoDB!")

@app.on_event("shutdown")
def shutdown_db_client():
    client.close()

app.include_router(auth_routes.router)
app.include_router(group_routes.router)
app.include_router(expense_routes.router)
app.include_router(ws_routes.router)
app.include_router(user_routes.router)
