from fastapi import FastAPI

app = FastAPI(title="VisaTrack API")

@app.get("/")
def health_check():
    return {"status": "ok"}
