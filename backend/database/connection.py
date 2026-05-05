from pymongo import MongoClient
import pymongo

client = MongoClient("mongodb://localhost:27021/")
db = client["spendsphere"]
expenses_collection = db["expenses"]
users_collection = db["users"]
groups_collection = db["groups"]

# MUST IMPLEMENT: Unique constraints
try:
    users_collection.create_index([("username", pymongo.ASCENDING)], unique=True)
except Exception as e:
    print(f"Warning: Could not create unique index on users: {e}")

try:
    groups_collection.create_index([("name", pymongo.ASCENDING)], unique=True)
except Exception as e:
    print(f"Warning: Could not create unique index on groups: {e}")
