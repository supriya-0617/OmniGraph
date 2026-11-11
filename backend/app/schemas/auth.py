from pydantic import BaseModel, EmailStr, Field

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters long")

class RegisterResponse(BaseModel):
    id: str
    email: str

class LoginRequest(BaseModel):
    email: str = Field(..., min_length=1, description="Email address or the development username 1234")
    password: str = Field(..., min_length=1)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_email: str


class AccountResponse(BaseModel):
    id: str
    email: str
    expires_at: int
