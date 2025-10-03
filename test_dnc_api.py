#!/usr/bin/env python3
"""
Test script to verify DNC API functionality
"""
import requests
import json

# DNC service URL
DNC_URL = "http://cncpi.local:8083/api/v1"

def test_dnc_api():
    print("🔧 Testing DNC API...")
    
    # Test health
    try:
        response = requests.get(f"{DNC_URL}/health")
        if response.status_code == 200:
            print("✅ Health check passed")
            print(f"   Response: {response.json()}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False
    
    # Test config
    try:
        response = requests.get(f"{DNC_URL}/config")
        if response.status_code == 200:
            config = response.json()
            print("✅ Config retrieved")
            print(f"   Mode: {config.get('mode', {}).get('value', 'unknown')}")
            print(f"   Serial: {config.get('serial', {})}")
        else:
            print(f"❌ Config failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Config error: {e}")
        return False
    
    # Test ports
    try:
        response = requests.get(f"{DNC_URL}/ports")
        if response.status_code == 200:
            ports = response.json()
            print("✅ Ports retrieved")
            print(f"   Available ports: {ports}")
        else:
            print(f"❌ Ports failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Ports error: {e}")
        return False
    
    # Test state
    try:
        response = requests.get(f"{DNC_URL}/state")
        if response.status_code == 200:
            state = response.json()
            print("✅ State retrieved")
            print(f"   Current state: {state.get('state', 'unknown')}")
        else:
            print(f"❌ State failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ State error: {e}")
        return False
    
    # Test file upload
    try:
        with open("test_program.H", "rb") as f:
            files = {"file": ("test_program.H", f, "text/plain")}
            response = requests.post(f"{DNC_URL}/upload", files=files)
            if response.status_code == 200:
                upload_result = response.json()
                print("✅ File uploaded successfully")
                print(f"   File ID: {upload_result.get('file_id')}")
                print(f"   Filename: {upload_result.get('filename')}")
                return upload_result.get('file_id')
            else:
                print(f"❌ Upload failed: {response.status_code}")
                print(f"   Response: {response.text}")
                return False
    except Exception as e:
        print(f"❌ Upload error: {e}")
        return False

if __name__ == "__main__":
    file_id = test_dnc_api()
    if file_id:
        print("\n🎉 DNC API is working! File uploaded successfully.")
        print(f"📁 File ID: {file_id}")
    else:
        print("\n💥 DNC API test failed!")