from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

# Define the global rate limiter using the remote address of the client
limiter = Limiter(key_func=get_remote_address)
