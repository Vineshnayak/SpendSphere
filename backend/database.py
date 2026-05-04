from pymongo import MongoClient

# Connect to our isolated MongoDB instance on port 27025
client = MongoClient("mongodb://localhost:27021/")

# Create (or access) a database named "spendsphere_db"
db = client.spendsphere_db

expenses_collection = db.expenses
users_collection = db.users

print("Database configuration loaded!")
from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27021/")
db = client["spendsphere"]
expenses_collection = db["expenses"]
users_collection = db.users
groups_collection = db.groups # NEW!
