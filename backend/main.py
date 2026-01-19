from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import models, database
import datetime

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def add_log(db: Session, t_id: int, t_type: str, action: str, change: str, user: str):
    log = models.History(target_id=t_id, target_type=t_type, action=action, changes=change, user=user)
    db.add(log)
    db.commit()

@app.on_event("startup")
def startup():
    models.Base.metadata.create_all(bind=database.engine)
    db = database.SessionLocal()
    if not db.query(models.User).filter(models.User.username == "admin").first():
        db.add(models.User(username="admin", hashed_password=pwd_context.hash("admin123"), role="Super Admin", status="active"))
        db.commit()
    db.close()

@app.post("/api/login")
async def login(data: dict, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == data.get("username")).first()
    if not user or not pwd_context.verify(data.get("password"), user.hashed_password):
        raise HTTPException(status_code=401, detail="Auth failed")
    return {"status": "success", "username": user.username}

@app.get("/api/servers")
async def get_servers(db: Session = Depends(database.get_db)):
    return db.query(models.Server).all()

@app.post("/api/servers")
async def add_server(data: dict, db: Session = Depends(database.get_db)):
    c_user = data.pop("current_user", "system")
    srv = models.Server(**data)
    db.add(srv)
    db.commit()
    db.refresh(srv)
    add_log(db, srv.id, "server", "Created", f"IP: {srv.ip}", c_user)
    return srv

@app.get("/api/servers/{id}")
async def get_server(id: int, db: Session = Depends(database.get_db)):
    return db.query(models.Server).filter(models.Server.id == id).first()

@app.put("/api/servers/{id}")
async def update_server(id: int, data: dict, db: Session = Depends(database.get_db)):
    srv = db.query(models.Server).filter(models.Server.id == id).first()
    if not srv: raise HTTPException(status_code=404)
    
    c_user = data.pop("current_user", "system")
    diff = []
    for k, v in data.items():
        if hasattr(srv, k):
            old = str(getattr(srv, k))
            if old != str(v):
                diff.append(f"{k}: {old} -> {v}")
                setattr(srv, k, v)
    
    if diff:
        db.commit()
        add_log(db, id, "server", "Update", " | ".join(diff), c_user)
    return srv

@app.get("/api/history/{type}/{id}")
async def get_history(type: str, id: int, db: Session = Depends(database.get_db)):
    t_type = type.rstrip('s')
    return db.query(models.History).filter(models.History.target_type == t_type, models.History.target_id == id).order_by(models.History.timestamp.desc()).all()

@app.get("/api/domains")
async def get_domains(db: Session = Depends(database.get_db)): return db.query(models.Domain).all()
