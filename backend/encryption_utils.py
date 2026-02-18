import base64
import hashlib
from cryptography.fernet import Fernet
from database import settings

def get_fernet_key() -> bytes:
    """
    Derive a 32-byte b64-encoded key from the application's SECRET_KEY.
    """
    secret = settings.SECRET_KEY.encode()
    # Use SHA256 to get a 32-byte key from any SECRET_KEY string
    key = hashlib.sha256(secret).digest()
    return base64.urlsafe_b64encode(key)

def encrypt_field(value: str) -> str:
    if not value:
        return ""
    f = Fernet(get_fernet_key())
    return f.encrypt(value.encode()).decode()

def decrypt_field(value: str) -> str:
    if not value:
        return ""
    try:
        f = Fernet(get_fernet_key())
        return f.decrypt(value.encode()).decode()
    except Exception as e:
        print(f"Decryption error: {e}")
        return value  # Fallback to original value if decryption fails (e.g. if it was already plaintext)
