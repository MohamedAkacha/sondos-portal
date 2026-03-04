import bcrypt
from pymongo import MongoClient
from datetime import datetime, timezone

# --- Connection ---
MONGO_URI = "mongodb+srv://anis:ioN17T3Omrx283vL@cluster2.hoq0eyj.mongodb.net/Sondos-Portal?appName=Cluster2"
DB_NAME = "Sondos-Portal"
COLLECTION = "users"

# --- All Users Data ---
users_data = [
    {
        "name": "HAL SIMPLFY",
        "email": "Hussein@halsimplify.com",
        "company": "HAL SIMPLFY",
        "plain_password": "fgcQq56s*a7",
        "api_key": "1800|cmfmISClBi1XfWRGZVczZgT8ZK1kUFzA0jNP7IlEf9bc5487",
    },
    {
        "name": "مستشفى الحمادي",
        "email": "yahia.dhafar@hh.med.sa",
        "company": "مستشفى الحمادي",
        "plain_password": "2xiPCSATV#4@5kl",
        "api_key": "1801|JULfwnqiZwAKzaCQd9fCNTpQXNflVWDGbvrlwpCo93f42805",
    },
    {
        "name": "جمعية زمزم",
        "email": "itz@zmzm.sa",
        "company": "جمعية زمزم",
        "plain_password": "2xiPCSATV#4@fh5",
        "api_key": "1802|Epb3l4j1pAS8UI6AR9fNVZQgZZ96bdhNKWl9hkW5f812f40d",
    },
    {
        "name": "الساعي التقني",
        "email": "it@saaei.co",
        "company": "الساعي التقني",
        "plain_password": "2xiPCSATV#4@mml",
        "api_key": "1803|7ljmg1wKN1rkpyx6B9oKcBw28fAdrf6CJEaqE3ai6a893f5c",
    },
    {
        "name": "ورود",
        "email": "kazlak@alworoud.com",
        "company": "ورود",
        "plain_password": "2xiPCSATV#4@78gs",
        "api_key": "1804|8GwqHzWBJeKgiqkpZq12GSpvd1U2sr6Evggfvmt9991af59a",
    },
    {
        "name": "فانا",
        "email": "apm1@fana.sa",
        "company": "فانا",
        "plain_password": "2xiPCSATV#4@7hg8",
        "api_key": "1527|0nLpe4MRdlZe8DhNgSdHcPp3uShSOgpjI2jUzlAKe246f9f5",
    },
    {
        "name": "عند بيتك",
        "email": "info@aturhome.sa",
        "company": "عند بيتك",
        "plain_password": "2xiPCSATV#4@ghgdhs8",
        "api_key": "1689|iqS1V4rEZuHjbfwfjgjOSd6cnKKsgPHKdWjHXbct8b5b347d",
    },
    {
        "name": "تقدير للخدمات العقارية",
        "email": "Marketing@taqdeersa.com",
        "company": "تقدير للخدمات العقارية",
        "plain_password": "2xiPCSATV#4@ghjj8",
        "api_key": "1805|UXOUc9S91emMCinSvzy5Rcyf01TLeA59UgJhTPLVe702a4b3",
    },
]

# --- Connect ---
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db[COLLECTION]

now = datetime.now(timezone.utc)

print("🚀 Creating users...\n")

for i, user in enumerate(users_data, 1):
    # Check if user already exists
    existing = collection.find_one({"email": user["email"]})
    if existing:
        print(f"⚠️  [{i}/{len(users_data)}] SKIPPED - {user['name']} ({user['email']}) already exists")
        continue

    hashed_password = bcrypt.hashpw(
        user["plain_password"].encode("utf-8"),
        bcrypt.gensalt(rounds=12)
    ).decode("utf-8")

    new_user = {
        "name": user["name"],
        "email": user["email"],
        "phone": "",
        "company": user["company"],
        "password": hashed_password,
        "timezone": "Asia/Riyadh",
        "role": "client",
        "sondosApiKey": user["api_key"],
        "api_key": user["api_key"],
        "isActive": True,
        "avatar": "",
        "settings": {},
        "lastLogin": None,
        "automationEnabled": False,
        "planId": "6996c17d68cb2bcc8d3875eb",
        "createdAt": now,
        "updatedAt": now,
        "plainPassword": user["plain_password"],
        "__v": 0,
    }

    result = collection.insert_one(new_user)
    print(f"✅ [{i}/{len(users_data)}] {user['name']} ({user['email']}) - _id: {result.inserted_id}")

print("\n🎉 Done!")
client.close()