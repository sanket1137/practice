"""
Quick test to verify StreamingHub connection and registration works
"""
import asyncio
import sys
from signalrcore.hub_connection_builder import HubConnectionBuilder

async def test_streaming_hub():
    print("=" * 60)
    print("Testing StreamingHub Connection")
    print("=" * 60)
    
    screen_id = "C7054654-DB14-4178-B5B7-389AD6BA378F"
    api_key = "test-api-key"
    hub_url = "http://localhost:5257/hubs/streaming"
    
    print(f"\n1. Connecting to: {hub_url}")
    
    try:
        connection = HubConnectionBuilder()\
            .with_url(hub_url)\
            .build()
        
        # Start connection (synchronous call, run in executor for async)
        await asyncio.get_event_loop().run_in_executor(None, connection.start)
        print("✅ Connected successfully!")
        
        print(f"\n2. Registering stream for screen: {screen_id}")
        connection.send("RegisterStream", [screen_id, api_key])
        print(f"✅ Stream registered!")
        
        print("\n3. Keeping connection alive for 5 minutes...")
        print("   → Now try connecting from browser!")
        print("   → Open http://localhost:5173")
        print("   → Go to Screen Detail → Live Activity")
        print("   → Click 'Start Stream'")
        print("\nPress Ctrl+C to stop...")
        
        # Keep alive
        await asyncio.sleep(300)
        
    except KeyboardInterrupt:
        print("\n\nStopping...")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        if 'connection' in locals():
            connection.stop()
        print("\n✅ Test complete!")

if __name__ == "__main__":
    asyncio.run(test_streaming_hub())
