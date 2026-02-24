import bcrypt
from pymongo import MongoClient
from datetime import datetime, timezone

# --- Connection ---
MONGO_URI = "mongodb+srv://anis:ioN17T3Omrx283vL@cluster2.hoq0eyj.mongodb.net/Sondos-Portal?appName=Cluster2"
DB_NAME = "Sondos-Portal"
COLLECTION = "users"

# --- User Data ---
plain_password = "2xiPCSATV#4@ghgdhs8"
hashed_password = bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")

now = datetime.now(timezone.utc)

new_user = {
    "name": "عند بيتك",
    "email": "info@aturhome.sa",
    "phone": "",
    "company": "عند بيتك",
    "password": hashed_password,
    "timezone": "Asia/Riyadh",
    "role": "client",
    "sondosApiKey": "1689|iqS1V4rEZuHjbfwfjgjOSd6cnKKsgPHKdWjHXbct8b5b347d",
    "api_key": "1689|iqS1V4rEZuHjbfwfjgjOSd6cnKKsgPHKdWjHXbct8b5b347d",
    "isActive": True,
    "avatar": "",
    "settings": {},
    "lastLogin": None,
    "automationEnabled": False,
    "planId": "6996c17d68cb2bcc8d3875eb",
    "createdAt": now,
    "updatedAt": now,
    "plainPassword": plain_password,
    "__v": 0,
}

# --- Insert ---
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db[COLLECTION]

result = collection.insert_one(new_user)
print(f"✅ User created successfully!")
print(f"   _id: {result.inserted_id}")
print(f"   email: {new_user['email']}")
print(f"   name: {new_user['name']}")

client.close()