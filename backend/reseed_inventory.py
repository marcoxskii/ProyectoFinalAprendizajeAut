
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text, delete, insert
from sqlalchemy.orm import sessionmaker

# Hardcoded from .env just to be safe/direct
DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/app"

from business_backend.database.models.computer import Computer

# Data to seed (Using correct mappings from YOLO)
products = [
    {
        "brand": "Lenovo",
        "code": "SKU-LAPTOP-let01",
        "price": 1200.00,
        "description": "Lenovo ThinkPad X1 Carbon - Business Ultrabook (14-inch)"
    },
    {
        "brand": "Asus",
        "code": "SKU-LAPTOP-asu01",
        "price": 1500.00,
        "description": "Asus ROG Strix Gaming - RTX 3060, Ryzen 7"
    },
    {
        "brand": "Apple",
        "code": "SKU-LAPTOP-mbk01",
        "price": 2000.00,
        "description": "MacBook Pro M1 14\" - Apple Silicon, Space Gray"
    }
]

async def seed_direct():
    print("🔌 Connecting to DB (Direct Async)...")
    engine = create_async_engine(DB_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        try:
            print("🧹 Cleaning 'computers' table...")
            await session.execute(delete(Computer))
            
            print("🌱 Inserting Correct Inventory...")
            for p in products:
                # We let the model defaults (like UUID) handle themselves if possible,
                # but SQLAlchemy model assumes python side defaults or DB side?
                # Computer model has id mapped column. 
                # Let's use the explicit constructor.
                new_comp = Computer(
                    brand=p["brand"],
                    code=p["code"],
                    price=p["price"],
                    description=p["description"]
                )
                session.add(new_comp)
            
            await session.commit()
            print("✅ Database successfully updated!")
            
        except Exception as e:
            print(f"❌ Error during seed: {e}")
            await session.rollback()
        finally:
            await session.close()
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed_direct())
