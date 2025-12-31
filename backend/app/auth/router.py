from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .schemas import SignupRequest, LoginRequest, TokenResponse, UserMeResponse
from .security import hash_password, verify_password, create_access_token
from .deps import get_current_user
from ..database import get_db
from ..models import User

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/signup", response_model=UserMeResponse)
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")

    user = User(email=req.email, password_hash=hash_password(req.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email}

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_access_token(subject=user.email)
    return {"access_token": token, "token_type": "bearer"}

@router.get("/me", response_model=UserMeResponse)
def me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "email": current_user.email}
