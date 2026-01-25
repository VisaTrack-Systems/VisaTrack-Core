from sqlalchemy.orm import declarative_base

Base = declarative_base()

# 👇 IMPORTANT: import all models here
from app.models import test
