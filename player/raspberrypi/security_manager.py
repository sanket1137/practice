"""
CCMS Player Security Module
Implements secure communication between player and server
"""

import hashlib
import hmac
import secrets
import time
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any


class PlayerSecurityManager:
    """
    Handles all security operations for the CCMS player
    - HMAC message signing
    - Session token management
    - Timestamp validation (prevents replay attacks)
    - API key hashing
    """
    
    def __init__(self, api_key: str, screen_id: str):
        self.api_key = api_key
        self.screen_id = screen_id
        self.session_token: Optional[str] = None
        self.server_salt: Optional[str] = None
        self.session_expiry: Optional[datetime] = None
        self.max_timestamp_drift_seconds = 300  # 5 minutes
        
    def hash_api_key(self) -> str:
        """
        Hash the API key using SHA-256 for comparison with server
        Never send the raw API key over the network after initial handshake
        """
        return hashlib.sha256(self.api_key.encode()).hexdigest()
    
    def generate_nonce(self) -> str:
        """Generate a cryptographic nonce for handshake"""
        return secrets.token_hex(32)
    
    def create_signature(self, payload: Dict[str, Any], timestamp: int) -> str:
        """
        Create HMAC-SHA256 signature for request payload.

        Signed with the session token (not the API key): the server only ever
        stores a one-way BCrypt hash of the API key, so it has no way to
        recompute an API-key-keyed HMAC. The session token is a high-entropy
        value both sides hold in plaintext after a successful (BCrypt-verified)
        handshake, so it works as the shared HMAC key instead — this must
        match PlayerAuthenticationService.ValidateSignature on the server.

        Args:
            payload: The request data to sign
            timestamp: Unix timestamp of the request

        Returns:
            Hex-encoded HMAC signature
        """
        if not self.session_token:
            raise SecurityError("No session token - perform handshake first")

        # Create canonical message: sorted JSON + timestamp (must match server exactly)
        canonical_payload = json.dumps(payload, sort_keys=True, separators=(',', ':'))
        message = f"{canonical_payload}|{timestamp}"

        signature = hmac.new(
            self.session_token.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()

        return signature
    
    def verify_server_response(self, response_data: Dict[str, Any], 
                                signature: str, timestamp: int) -> bool:
        """
        Verify that a response actually came from the server
        
        Args:
            response_data: The response payload
            signature: The signature provided by server
            timestamp: The timestamp from the response
            
        Returns:
            True if signature is valid
        """
        # Check timestamp freshness (prevent replay attacks)
        now = int(time.time())
        if abs(now - timestamp) > self.max_timestamp_drift_seconds:
            raise SecurityError(f"Timestamp too old/new: {abs(now - timestamp)}s drift")
        
        # Recreate the expected signature
        expected_sig = self.create_signature(response_data, timestamp)
        
        # Constant-time comparison to prevent timing attacks
        return hmac.compare_digest(signature, expected_sig)
    
    def create_secure_request_headers(self, payload: Dict[str, Any]) -> Dict[str, str]:
        """
        Create headers for a secure API request
        
        Returns headers dict with:
        - X-Screen-Id: Screen identifier
        - X-Timestamp: Current Unix timestamp
        - X-Signature: HMAC signature of payload
        - X-Session-Token: Current session token
        """
        timestamp = int(time.time())
        signature = self.create_signature(payload, timestamp)
        
        return {
            "Content-Type": "application/json",
            "X-Screen-Id": self.screen_id,
            "X-Timestamp": str(timestamp),
            "X-Signature": signature,
            "X-Session-Token": self.session_token or "",
        }
    
    def process_handshake_response(self, response: Dict[str, Any]) -> bool:
        """
        Process the server's handshake response
        
        Expected response format:
        {
            "sessionToken": "...",
            "serverSalt": "...",
            "expiresAt": "ISO-8601 datetime",
            "signature": "HMAC signature of response"
        }
        """
        self.session_token = response.get("sessionToken")
        self.server_salt = response.get("serverSalt")
        
        expiry_str = response.get("expiresAt")
        if expiry_str:
            self.session_expiry = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
        
        if not self.session_token or not self.server_salt:
            raise SecurityError("Invalid handshake response - missing session data")
        
        return True
    
    def is_session_valid(self) -> bool:
        """Check if current session is still valid"""
        if not self.session_token:
            return False
        
        if self.session_expiry:
            now = datetime.now(timezone.utc)
            if now >= self.session_expiry:
                return False
        
        return True
    
    def create_impression_hash(self, impression_data: Dict[str, Any]) -> str:
        """
        Create a tamper-proof hash for impression data
        This proves the impression came from a valid player
        
        Args:
            impression_data: {
                "creativeId": "...",
                "timestamp": "ISO-8601",
                "slotNumber": 1,
                "playDurationMs": 10000
            }
        """
        # Include screen ID and session token in the hash
        data_to_hash = {
            **impression_data,
            "screenId": self.screen_id,
            "sessionToken": self.session_token[:16] if self.session_token else ""  # First 16 chars only
        }
        
        canonical = json.dumps(data_to_hash, sort_keys=True, separators=(',', ':'))
        
        # HMAC with API key ensures only valid players can create these hashes
        return hmac.new(
            self.api_key.encode(),
            canonical.encode(),
            hashlib.sha256
        ).hexdigest()[:32]  # First 32 chars (128 bits)


class SecurityError(Exception):
    """Raised when a security operation fails"""
    pass


class SecurePlayerConfig:
    """
    Secure configuration loader that protects sensitive data
    """
    
    @staticmethod
    def load_api_key_securely(config_path: str) -> str:
        """
        Load API key from secure storage
        In production, this should:
        1. Read from encrypted file
        2. Or read from hardware security module
        3. Or read from environment variable
        """
        import os
        
        # Priority 1: Environment variable (most secure)
        api_key = os.environ.get("CCMS_PLAYER_API_KEY")
        if api_key:
            return api_key
        
        # Priority 2: Encrypted config file (implement encryption)
        # This is a placeholder - implement actual encryption
        with open(config_path) as f:
            config = json.load(f)
            return config.get("api_key", "")
    
    @staticmethod
    def generate_device_fingerprint() -> str:
        """
        Generate a unique device fingerprint for additional verification
        This helps detect if a player config is copied to another device
        """
        import platform
        import uuid
        
        # Collect hardware identifiers
        components = [
            platform.node(),  # Hostname
            platform.machine(),  # Hardware type
            str(uuid.getnode()),  # MAC address (as integer)
        ]
        
        # Try to get more unique identifiers on Linux/Raspberry Pi
        try:
            with open('/sys/firmware/devicetree/base/serial-number', 'r') as f:
                components.append(f.read().strip())
        except:
            pass
        
        try:
            with open('/proc/cpuinfo', 'r') as f:
                for line in f:
                    if line.startswith('Serial'):
                        components.append(line.split(':')[1].strip())
                        break
        except:
            pass
        
        # Create a hash of all components
        fingerprint_data = "|".join(components)
        return hashlib.sha256(fingerprint_data.encode()).hexdigest()


# Example usage in player
if __name__ == "__main__":
    # Initialize security manager
    security = PlayerSecurityManager(
        api_key="your-secret-api-key",
        screen_id="screen-uuid-here"
    )
    
    # Create secure handshake request
    nonce = security.generate_nonce()
    handshake_payload = {
        "screenId": security.screen_id,
        "apiKeyHash": security.hash_api_key(),
        "nonce": nonce,
        "deviceFingerprint": SecurePlayerConfig.generate_device_fingerprint(),
        "timestamp": int(time.time())
    }
    
    print("Handshake payload:", json.dumps(handshake_payload, indent=2))
