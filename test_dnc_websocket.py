#!/usr/bin/env python3
"""
Test script to verify DNC WebSocket connection
"""
import asyncio
import websockets
import json

async def test_dnc_websocket():
    uri = "ws://cncpi.local:8083/api/v1/ws"
    try:
        print(f"Connecting to {uri}...")
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket connected!")
            
            # Listen for messages
            try:
                message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(message)
                print(f"✅ Received message: {data}")
                
                if data.get("type") == "state" and data.get("state") == "connected":
                    print("✅ DNC service is ready!")
                    return True
                else:
                    print(f"⚠️  Unexpected state: {data}")
                    return False
                    
            except asyncio.TimeoutError:
                print("⚠️  No message received within 5 seconds")
                return False
                
    except Exception as e:
        print(f"❌ WebSocket connection failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_dnc_websocket())
    if success:
        print("\n🎉 DNC WebSocket connection is working!")
    else:
        print("\n💥 DNC WebSocket connection failed!")