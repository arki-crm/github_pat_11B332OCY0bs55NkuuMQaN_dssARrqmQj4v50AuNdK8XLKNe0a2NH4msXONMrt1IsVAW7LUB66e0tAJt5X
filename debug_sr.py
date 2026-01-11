#!/usr/bin/env python3
"""
Debug service request stage issue
"""

import requests
import json

def debug_service_request():
    base_url = "https://budget-master-627.preview.emergentagent.com"
    
    # Use the admin token from the previous test
    admin_token = "test_admin_session_b8b8b8b8b8b8b8b8"  # This will need to be updated
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Get service requests to see current state
    response = requests.get(f"{base_url}/api/service-requests", headers=headers)
    print("Service Requests:")
    print(json.dumps(response.json(), indent=2))
    
    if response.json():
        sr_id = response.json()[0]['service_request_id']
        
        # Get specific service request
        response = requests.get(f"{base_url}/api/service-requests/{sr_id}", headers=headers)
        print(f"\nService Request {sr_id}:")
        print(json.dumps(response.json(), indent=2))

if __name__ == "__main__":
    debug_service_request()