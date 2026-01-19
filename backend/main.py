from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import List, Optional

import models, schemas, database
import os

# --- Security & Auth ---
SECRET_KEY = os.environ.get("SECRET_KEY", "a_very_secret_key_for_jwt")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.username == token_data.username).first()
    if user is None:
        raise credentials_exception
    return user

class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: models.User = Depends(get_current_user)):
        if user.role not in self.allowed_roles:
            raise HTTPException(status_code=403, detail="Operation not permitted")
        return user

# --- App Initialization ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    database.Base.metadata.create_all(bind=database.engine)
    db = database.SessionLocal()
    if not db.query(models.User).filter(models.User.username == "SuperAdmin").first():
        superadmin_password = os.environ.get("SUPERADMIN_PASSWORD", "superadmin_password")
        superadmin_email = os.environ.get("SUPERADMIN_EMAIL", "admin@controlnode.com")
        hashed_password = get_password_hash(superadmin_password)
        super_admin = models.User(
            username="SuperAdmin",
            email=superadmin_email,
            hashed_password=hashed_password,
            role="Super Admin",
            status="active"
        )
        db.add(super_admin)
        db.commit()
    db.close()

# --- Utility ---
def add_log(db: Session, t_id: int, t_type: str, action: str, change: str, user: str):
    log = models.History(target_id=t_id, target_type=t_type, action=action, changes=change, user=user)
    db.add(log)
    db.commit()

# --- Auth Endpoint ---
@app.post("/api/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    if user.status != "active":
         raise HTTPException(status_code=403, detail=f"User account is {user.status}")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user.username}, expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}

# --- API Endpoints (Protected) ---

@app.get("/api/servers", response_model=List[schemas.Server])
async def get_servers(q: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.Server)
    if q:
        query = query.filter(
            models.Server.id.ilike(f"%{q}%") |
            models.Server.ip.ilike(f"%{q}%") |
            models.Server.project.has(models.Project.title.ilike(f"%{q}%")) |
            models.Server.group.has(models.Group.title.ilike(f"%{q}%"))
        )
    return query.all()

@app.post("/api/servers", response_model=schemas.Server)
async def add_server(server: schemas.ServerCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(RoleChecker(["Super Admin", "Admin 2L", "Service Manager"]))):
    srv = models.Server(**server.dict())
    db.add(srv)
    db.commit()
    db.refresh(srv)
    add_log(db, srv.id, "server", "Created", f"IP: {srv.ip}", current_user.username)
    return srv

@app.get("/api/servers/{id}", response_model=schemas.Server)
async def get_server(id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Server).filter(models.Server.id == id).first()

@app.put("/api/servers/{id}", response_model=schemas.Server)
async def update_server(id: int, server_data: schemas.ServerCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(RoleChecker(["Super Admin", "Admin 2L", "Admin 1L", "Service Manager"]))):
    srv = db.query(models.Server).filter(models.Server.id == id).first()
    if not srv: raise HTTPException(status_code=404, detail="Server not found")
    
    update_data = server_data.dict(exclude_unset=True)
    diff = []
    for key, value in update_data.items():
        if hasattr(srv, key) and getattr(srv, key) != value:
            diff.append(f"{key}: {getattr(srv, key)} -> {value}")
            setattr(srv, key, value)
    
    if diff:
        db.commit()
        add_log(db, id, "server", "Updated", " | ".join(diff), current_user.username)
    return srv

@app.get("/api/history/{type}/{id}", response_model=List[schemas.History])
async def get_history(type: str, id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.History).filter_by(target_type=type, target_id=id).order_by(models.History.timestamp.desc()).all()

@app.get("/api/domains", response_model=List[schemas.Domain])
async def get_domains(q: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.Domain)
    if q:
        query = query.filter(
            models.Domain.name.ilike(f"%{q}%") |
            models.Domain.group.has(models.Group.title.ilike(f"%{q}%"))
        )
    return query.all()

@app.post("/api/domains", response_model=schemas.Domain)
async def add_domain(domain: schemas.DomainCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(RoleChecker(["Super Admin", "Admin 2L", "Service Manager"]))):
    dom = models.Domain(**domain.dict())
    db.add(dom)
    db.commit()
    db.refresh(dom)
    add_log(db, dom.id, "domain", "Created", f"Name: {dom.name}", current_user.username)
    return dom

@app.put("/api/domains/{id}", response_model=schemas.Domain)
async def update_domain(id: int, domain_data: schemas.DomainCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(RoleChecker(["Super Admin", "Admin 2L", "Admin 1L", "Service Manager"]))):
    dom = db.query(models.Domain).filter(models.Domain.id == id).first()
    if not dom: raise HTTPException(status_code=404, detail="Domain not found")

    update_data = domain_data.dict(exclude_unset=True)
    diff = []
    for key, value in update_data.items():
        if hasattr(dom, key) and getattr(dom, key) != value:
            diff.append(f"{key}: {getattr(dom, key)} -> {value}")
            setattr(dom, key, value)

    if diff:
        db.commit()
        add_log(db, id, "domain", "Updated", " | ".join(diff), current_user.username)
    return dom

@app.get("/api/projects", response_model=List[schemas.Project])
async def get_projects(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Project).all()

@app.post("/api/projects", response_model=schemas.Project)
async def add_project(project: schemas.ProjectCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(RoleChecker(["Super Admin", "Admin 2L", "Service Manager"]))):
    proj = models.Project(**project.dict())
    db.add(proj)
    db.commit()
    db.refresh(proj)
    add_log(db, proj.id, "project", "Created", f"Title: {proj.title}", current_user.username)
    return proj

@app.get("/api/groups", response_model=List[schemas.Group])
async def get_groups(q: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.Group)
    if q:
        query = query.filter(
            models.Group.id.ilike(f"%{q}%") |
            models.Group.title.ilike(f"%{q}%")
        )
    return query.all()

@app.post("/api/groups", response_model=schemas.Group)
async def add_group(group: schemas.GroupCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(RoleChecker(["Super Admin", "Admin 2L", "Service Manager"]))):
    grp = models.Group(**group.dict())
    db.add(grp)
    db.commit()
    db.refresh(grp)
    add_log(db, grp.id, "group", "Created", f"Title: {grp.title}", current_user.username)
    return grp

@app.put("/api/groups/{id}", response_model=schemas.Group)
async def update_group(id: int, group_data: schemas.GroupCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(RoleChecker(["Super Admin", "Admin 2L", "Admin 1L", "Service Manager"]))):
    grp = db.query(models.Group).filter(models.Group.id == id).first()
    if not grp: raise HTTPException(status_code=404, detail="Group not found")

    update_data = group_data.dict(exclude_unset=True)
    diff = []
    for key, value in update_data.items():
        if hasattr(grp, key) and getattr(grp, key) != value:
            diff.append(f"{key}: {getattr(grp, key)} -> {value}")
            setattr(grp, key, value)

    if diff:
        db.commit()
        add_log(db, id, "group", "Updated", " | ".join(diff), current_user.username)
    return grp

@app.get("/api/finance", response_model=List[schemas.Finance])
async def get_finance_records(q: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(RoleChecker(["Super Admin", "Admin 2L"]))):
    query = db.query(models.Finance)
    if q:
        query = query.join(models.Server).join(models.Group).filter(
            models.Finance.id.ilike(f"%{q}%") |
            models.Finance.server_id.ilike(f"%{q}%") |
            models.Finance.payment_date.ilike(f"%{q}%") |
            models.Group.title.ilike(f"%{q}%")
        )
    return query.all()

@app.post("/api/finance", response_model=schemas.Finance)
async def add_finance_record(record: schemas.FinanceCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(RoleChecker(["Super Admin", "Admin 2L", "Service Manager"]))):
    fin = models.Finance(**record.dict())
    db.add(fin)
    db.commit()
    db.refresh(fin)
    add_log(db, fin.id, "finance", "Created", f"Server ID: {fin.server_id}, Price: {fin.price}", current_user.username)
    return fin

@app.put("/api/finance/{id}", response_model=schemas.Finance)
async def update_finance_record(id: int, record_data: schemas.FinanceCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(RoleChecker(["Super Admin", "Admin 2L"]))):
    fin = db.query(models.Finance).filter(models.Finance.id == id).first()
    if not fin: raise HTTPException(status_code=404, detail="Finance record not found")

    update_data = record_data.dict(exclude_unset=True)
    diff = []
    for key, value in update_data.items():
        if hasattr(fin, key) and getattr(fin, key) != value:
            diff.append(f"{key}: {getattr(fin, key)} -> {value}")
            setattr(fin, key, value)

    if diff:
        db.commit()
        add_log(db, id, "finance", "Updated", " | ".join(diff), current_user.username)
    return fin

@app.get("/api/users", response_model=List[schemas.User])
async def get_users(q: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(RoleChecker(["Super Admin", "Admin 2L"]))):
    query = db.query(models.User)
    if q:
        query = query.filter(
            models.User.username.ilike(f"%{q}%") |
            models.User.email.ilike(f"%{q}%") |
            models.User.number.ilike(f"%{q}%") |
            models.User.role.ilike(f"%{q}%")
        )
    return query.all()

@app.post("/api/users", response_model=schemas.User)
async def add_user(user: schemas.UserCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(RoleChecker(["Super Admin", "Admin 2L"]))):
    hashed_password = get_password_hash(user.password)
    new_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        role=user.role,
        status=user.status,
        number=user.number
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    add_log(db, new_user.id, "user", "Created", f"Username: {new_user.username}", current_user.username)
    return new_user

@app.put("/api/users/{id}", response_model=schemas.User)
async def update_user(id: int, user_data: schemas.UserUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(RoleChecker(["Super Admin", "Admin 2L"]))):
    usr = db.query(models.User).filter(models.User.id == id).first()
    if not usr: raise HTTPException(status_code=404, detail="User not found")

    update_data = user_data.dict(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))

    diff = []
    for key, value in update_data.items():
        if hasattr(usr, key) and getattr(usr, key) != value:
            diff.append(f"{key}: {getattr(usr, key)} -> {value}")
            setattr(usr, key, value)

    if diff:
        db.commit()
        add_log(db, id, "user", "Updated", " | ".join(diff), current_user.username)
    return usr

@app.get("/api/settings/me", response_model=schemas.User)
async def get_my_settings(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.put("/api/settings/me", response_model=schemas.User)
async def update_my_settings(user_data: schemas.UserCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    update_data = user_data.dict(exclude_unset=True)
    if "password" in update_data:
        current_user.hashed_password = get_password_hash(update_data.pop("password"))

    for key, value in update_data.items():
        setattr(current_user, key, value)

    db.commit()
    return current_user
