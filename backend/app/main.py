from fastapi import FastAPI
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="VisaTrack API")

@app.get("/")
def health_check():
    return {"status": "ok"}
