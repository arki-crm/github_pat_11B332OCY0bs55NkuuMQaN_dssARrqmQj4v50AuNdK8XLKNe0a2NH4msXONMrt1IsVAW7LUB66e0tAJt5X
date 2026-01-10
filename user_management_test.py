#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timezone, timedelta
import uuid
import subprocess

class UserManagementTester:
    def __init__(self, base_url="https://finance-tracker-1744.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.admin_user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, auth_token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
            
        if auth_token:
            test_headers['Authorization'] = f'Bearer {auth_token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                except:
                    print(f"   Response: {response.text[:200]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:300]}...")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:300]
                })

            return success, response.json() if response.headers.get('content-type', '').startswith('application/json') else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def setup_test_user(self):
        """Create test admin user and session"""
        print("\n🔧 Setting up test admin user...")
        
        admin_user_id = f"test-admin-{uuid.uuid4().hex[:8]}"
        admin_session_token = f"test_admin_session_{uuid.uuid4().hex[:16]}"
        
        mongo_commands = f'''
use('test_database');

// Create admin user
db.users.insertOne({{
  user_id: "{admin_user_id}",
  email: "admin.test.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
  name: "Test Admin",
  picture: "https://via.placeholder.com/150",
  role: "Admin",
  status: "Active",
  phone: null,
  created_at: new Date(),
  updated_at: new Date(),
  last_login: new Date()
}});

// Create admin session
db.user_sessions.insertOne({{
  user_id: "{admin_user_id}",
  session_token: "{admin_session_token}",
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});

print("Admin session token: {admin_session_token}");
print("Admin user ID: {admin_user_id}");
'''
        
        try:
            result = subprocess.run(['mongosh', '--eval', mongo_commands], 
                                  capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                print("✅ Test admin user created successfully")
                self.admin_token = admin_session_token
                self.admin_user_id = admin_user_id
                return True
            else:
                print(f"❌ Failed to create test admin user: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"❌ Error setting up test admin user: {str(e)}")
            return False

    def test_list_users(self):
        """Test GET /api/users - List all users"""
        return self.run_test("List Users", "GET", "api/users", 200,
                           auth_token=self.admin_token)

    def test_list_users_with_filters(self):
        """Test GET /api/users with filters"""
        # Test status filter
        success1, _ = self.run_test("List Users (Status Filter)", "GET", "api/users?status=Active", 200,
                                   auth_token=self.admin_token)
        
        # Test role filter
        success2, _ = self.run_test("List Users (Role Filter)", "GET", "api/users?role=Admin", 200,
                                   auth_token=self.admin_token)
        
        # Test search filter
        success3, _ = self.run_test("List Users (Search Filter)", "GET", "api/users?search=Test", 200,
                                   auth_token=self.admin_token)
        
        return success1 and success2 and success3, {}

    def test_invite_user(self):
        """Test POST /api/users/invite"""
        invite_data = {
            "name": "Invited Test User",
            "email": f"invited.test.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
            "role": "Designer",
            "phone": "1234567890"
        }
        
        success, invite_response = self.run_test("Invite User", "POST", "api/users/invite", 200,
                                                data=invite_data,
                                                auth_token=self.admin_token)
        if success and 'user_id' in invite_response:
            self.invited_user_id = invite_response['user_id']
        
        return success, invite_response

    def test_update_user(self):
        """Test PUT /api/users/{user_id}"""
        if hasattr(self, 'invited_user_id'):
            update_data = {
                "name": "Updated Test User",
                "phone": "9876543210",
                "role": "PreSales"
            }
            
            return self.run_test("Update User", "PUT", 
                               f"api/users/{self.invited_user_id}", 200,
                               data=update_data,
                               auth_token=self.admin_token)
        else:
            print("⚠️  No invited user available for update test")
            return True, {}

    def test_toggle_user_status(self):
        """Test PUT /api/users/{user_id}/status"""
        if hasattr(self, 'invited_user_id'):
            return self.run_test("Toggle User Status", "PUT", 
                               f"api/users/{self.invited_user_id}/status", 200,
                               auth_token=self.admin_token)
        else:
            print("⚠️  No invited user available for status toggle test")
            return True, {}

    def test_get_profile(self):
        """Test GET /api/profile"""
        return self.run_test("Get Profile", "GET", "api/profile", 200,
                           auth_token=self.admin_token)

    def test_update_profile(self):
        """Test PUT /api/profile"""
        update_data = {
            "name": "Updated Profile Name",
            "phone": "5555555555"
        }
        
        return self.run_test("Update Profile", "PUT", "api/profile", 200,
                           data=update_data,
                           auth_token=self.admin_token)

    def test_get_active_users(self):
        """Test GET /api/users/active"""
        return self.run_test("Get Active Users", "GET", "api/users/active", 200,
                           auth_token=self.admin_token)

    def test_get_active_designers(self):
        """Test GET /api/users/active/designers"""
        return self.run_test("Get Active Designers", "GET", "api/users/active/designers", 200,
                           auth_token=self.admin_token)

    def test_delete_user(self):
        """Test DELETE /api/users/{user_id}"""
        if hasattr(self, 'invited_user_id'):
            return self.run_test("Delete User", "DELETE", 
                               f"api/users/{self.invited_user_id}", 200,
                               auth_token=self.admin_token)
        else:
            print("⚠️  No invited user available for delete test")
            return True, {}

    def cleanup(self):
        """Clean up test data"""
        print("\n🧹 Cleaning up test data...")
        
        mongo_commands = f'''
use('test_database');
db.users.deleteMany({{email: /test\\..*@example\\.com/}});
db.user_sessions.deleteMany({{session_token: /test_.*_session_.*/}});
print("Test data cleaned up");
'''
        
        try:
            result = subprocess.run(['mongosh', '--eval', mongo_commands], 
                                  capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                print("✅ Test data cleaned up successfully")
            else:
                print(f"⚠️  Cleanup warning: {result.stderr}")
        except Exception as e:
            print(f"⚠️  Cleanup error: {str(e)}")

def main():
    print("🚀 Starting User Management API Tests")
    print("=" * 50)
    
    tester = UserManagementTester()
    
    # Setup test user
    if not tester.setup_test_user():
        print("❌ Failed to setup test user, stopping tests")
        return 1

    try:
        # Run user management tests
        print("\n👤 Testing User Management System...")
        
        tester.test_list_users()
        tester.test_list_users_with_filters()
        tester.test_invite_user()
        tester.test_update_user()
        tester.test_toggle_user_status()
        tester.test_get_profile()
        tester.test_update_profile()
        tester.test_get_active_users()
        tester.test_get_active_designers()
        tester.test_delete_user()
        
    finally:
        # Always cleanup
        tester.cleanup()

    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.failed_tests:
        print("\n❌ Failed Tests:")
        for failure in tester.failed_tests:
            print(f"  - {failure.get('test', 'Unknown')}: {failure}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())