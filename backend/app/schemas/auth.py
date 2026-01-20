from pydantic import BaseModel, Field, field_validator
from email_validator import validate_email, EmailNotValidError


def _validate_email_dev(v: str) -> str:
    v = v.strip().lower()
    # Allow common dev-only domains like *.local/localhost without strict validation.
    if "@" in v:
        local_part, domain = v.split("@", 1)
        if domain == "localhost" or domain.endswith(".local"):
            if local_part:  # minimal sanity check
                return v
    try:
        # allows .local and other reserved domains in dev
        validate_email(v, check_deliverability=False, test_environment=True)
    except EmailNotValidError as e:
        raise ValueError(str(e))
    return v


class RegisterIn(BaseModel):
    email: str
    full_name: str = Field(..., min_length=1)
    password: str = Field(..., min_length=6)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return _validate_email_dev(v)


class LoginIn(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return _validate_email_dev(v)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
