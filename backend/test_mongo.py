
import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv(override=True)
print("Username:", os.getenv("MONGODB_URI").split("://")[1].split(":")[0])
print("URI loaded:", bool(os.getenv("MONGODB_URI")))

uri = os.getenv("MONGODB_URI")
database = os.getenv("MONGODB_DATABASE", "omnigraph")

try:
    client = MongoClient(
        uri,
        serverSelectionTimeoutMS=5000
    )

    # Test connection
    client.admin.command("ping")

    print("MongoDB connected successfully!")

    db = client[database]

    print("Database:", db.name)
    print("Collections:", db.list_collection_names())

    client.close()

except Exception as e:
    print("MongoDB connection failed!")
    print(type(e).__name__, str(e))
