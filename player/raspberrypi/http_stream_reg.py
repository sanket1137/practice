"""
Ultra-simple HTTP-based stream registration
No SignalR complexity - just HTTP POST
"""
import requests
import time

class HttpStreamRegistration:
    def __init__(self, api_url, screen_id, api_key):
        self.api_url = api_url
        self.screen_id = screen_id
        self.api_key = api_key
        self.registered = False
        
    def register(self):
        """Register stream via HTTP POST"""
        try:
            url = f"{self.api_url}/api/streaming/register"
            data = {
                "screenId": self.screen_id,
                "apiKey": self.api_key,
                "connectionId": f"http-player-{self.screen_id}"
            }
            
            response = requests.post(url, json=data, timeout=5)
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ [HTTP] Stream registered: {result.get('message')}")
                self.registered = True
                return True
            else:
                print(f"❌ [HTTP] Registration failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ [HTTP] Registration error: {e}")
            return False
    
    def unregister(self):
        """Unregister stream via HTTP POST"""
        if not self.registered:
            return
            
        try:
            url = f"{self.api_url}/api/streaming/unregister"
            data = {"screenId": self.screen_id}
            
            requests.post(url, json=data, timeout=5)
            print(f"✅ [HTTP] Stream unregistered")
            self.registered = False
            
        except Exception as e:
            print(f"❌ [HTTP] Unregistration error: {e}")
    
    def keep_alive(self):
        """Re-register periodically to keep stream active"""
        while self.registered:
            time.sleep(30)  # Re-register every 30 seconds
            self.register()


if __name__ == "__main__":
    # Simple test
    import sys
    
    reg = HttpStreamRegistration(
        "http://localhost:5257",
        "c7054654-db14-4178-b5b7-389ad6ba378f",  # Lowercase to match browser
        "test-key"
    )
    
    if reg.register():
        print("\n🎉 Stream registered successfully!")
        print("→ Now go to browser and click 'Start Stream'")
        print("→ Press Ctrl+C to stop...")
        
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n\nStopping...")
            reg.unregister()
    else:
        print("\n❌ Failed to register stream")
        sys.exit(1)
