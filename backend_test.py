import requests
import sys
import json
from datetime import datetime, timezone, timedelta
import uuid

class ArkifloAPITester:
    def __init__(self, base_url="https://designpro-setup.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.designer_token = None
        self.admin_user_id = None
        self.designer_user_id = None
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

    def setup_test_users(self):
        """Create test users and sessions directly in MongoDB"""
        print("\n🔧 Setting up test users and sessions...")
        
        # Create admin user
        admin_user_id = f"test-admin-{uuid.uuid4().hex[:8]}"
        admin_session_token = f"test_admin_session_{uuid.uuid4().hex[:16]}"
        
        # Create designer user  
        designer_user_id = f"test-designer-{uuid.uuid4().hex[:8]}"
        designer_session_token = f"test_designer_session_{uuid.uuid4().hex[:16]}"
        
        # MongoDB commands to create test data
        mongo_commands = f'''
use('test_database');

// Create admin user
db.users.insertOne({{
  user_id: "{admin_user_id}",
  email: "admin.test.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
  name: "Test Admin",
  picture: "https://via.placeholder.com/150",
  role: "Admin",
  created_at: new Date()
}});

// Create designer user
db.users.insertOne({{
  user_id: "{designer_user_id}",
  email: "designer.test.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
  name: "Test Designer", 
  picture: "https://via.placeholder.com/150",
  role: "Designer",
  created_at: new Date()
}});

// Create admin session
db.user_sessions.insertOne({{
  user_id: "{admin_user_id}",
  session_token: "{admin_session_token}",
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});

// Create designer session
db.user_sessions.insertOne({{
  user_id: "{designer_user_id}",
  session_token: "{designer_session_token}",
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});

print("Admin session token: {admin_session_token}");
print("Designer session token: {designer_session_token}");
print("Admin user ID: {admin_user_id}");
print("Designer user ID: {designer_user_id}");
'''
        
        try:
            import subprocess
            result = subprocess.run(['mongosh', '--eval', mongo_commands], 
                                  capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                print("✅ Test users and sessions created successfully")
                self.admin_token = admin_session_token
                self.designer_token = designer_session_token
                self.admin_user_id = admin_user_id
                self.designer_user_id = designer_user_id
                return True
            else:
                print(f"❌ Failed to create test users: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"❌ Error setting up test users: {str(e)}")
            return False

    def test_health_endpoint(self):
        """Test health endpoint"""
        return self.run_test("Health Check", "GET", "api/health", 200)

    def test_auth_me_admin(self):
        """Test /auth/me endpoint with admin token"""
        return self.run_test("Get Current User (Admin)", "GET", "api/auth/me", 200, 
                           auth_token=self.admin_token)

    def test_auth_me_designer(self):
        """Test /auth/me endpoint with designer token"""
        return self.run_test("Get Current User (Designer)", "GET", "api/auth/me", 200,
                           auth_token=self.designer_token)

    def test_auth_me_no_token(self):
        """Test /auth/me endpoint without token"""
        return self.run_test("Get Current User (No Token)", "GET", "api/auth/me", 401)

    def test_logout(self):
        """Test logout endpoint"""
        return self.run_test("Logout", "POST", "api/auth/logout", 200,
                           auth_token=self.admin_token)

    def test_list_users_admin(self):
        """Test list users endpoint (Admin only)"""
        return self.run_test("List Users (Admin)", "GET", "api/auth/users", 200,
                           auth_token=self.admin_token)

    def test_list_users_designer(self):
        """Test list users endpoint with designer token (should fail)"""
        return self.run_test("List Users (Designer - Should Fail)", "GET", "api/auth/users", 403,
                           auth_token=self.designer_token)

    def test_update_user_role_admin(self):
        """Test update user role endpoint (Admin only)"""
        return self.run_test("Update User Role (Admin)", "PUT", 
                           f"api/auth/users/{self.designer_user_id}/role", 200,
                           data={"role": "Manager"}, auth_token=self.admin_token)

    def test_update_user_role_designer(self):
        """Test update user role endpoint with designer token (should fail)"""
        return self.run_test("Update User Role (Designer - Should Fail)", "PUT",
                           f"api/auth/users/{self.designer_user_id}/role", 403,
                           data={"role": "Manager"}, auth_token=self.designer_token)

    def test_update_user_role_invalid(self):
        """Test update user role with invalid role"""
        return self.run_test("Update User Role (Invalid Role)", "PUT",
                           f"api/auth/users/{self.designer_user_id}/role", 400,
                           data={"role": "InvalidRole"}, auth_token=self.admin_token)

    # ============ PROJECT TESTS ============

    def test_seed_projects_admin(self):
        """Test seeding projects (Admin only)"""
        return self.run_test("Seed Projects (Admin)", "POST", "api/projects/seed", 200,
                           auth_token=self.admin_token)

    def test_seed_projects_designer(self):
        """Test seeding projects with designer token (should fail)"""
        return self.run_test("Seed Projects (Designer - Should Fail)", "POST", "api/projects/seed", 403,
                           auth_token=self.designer_token)

    def test_list_projects_admin(self):
        """Test list projects endpoint (Admin sees all)"""
        return self.run_test("List Projects (Admin)", "GET", "api/projects", 200,
                           auth_token=self.admin_token)

    def test_list_projects_designer(self):
        """Test list projects endpoint (Designer sees only assigned)"""
        return self.run_test("List Projects (Designer)", "GET", "api/projects", 200,
                           auth_token=self.designer_token)

    def test_list_projects_no_auth(self):
        """Test list projects endpoint without authentication"""
        return self.run_test("List Projects (No Auth)", "GET", "api/projects", 401)

    def test_list_projects_with_stage_filter(self):
        """Test list projects with stage filter"""
        return self.run_test("List Projects (Stage Filter)", "GET", "api/projects?stage=Pre 10%", 200,
                           auth_token=self.admin_token)

    def test_list_projects_with_search(self):
        """Test list projects with search parameter"""
        return self.run_test("List Projects (Search)", "GET", "api/projects?search=Modern", 200,
                           auth_token=self.admin_token)

    def test_get_single_project_admin(self):
        """Test get single project (Admin access)"""
        # First get list of projects to get a project ID
        success, projects_data = self.run_test("Get Projects for Single Test", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            return self.run_test("Get Single Project (Admin)", "GET", f"api/projects/{project_id}", 200,
                               auth_token=self.admin_token)
        else:
            print("⚠️  No projects found for single project test")
            return False, {}

    def test_get_single_project_designer(self):
        """Test get single project (Designer access - may be restricted)"""
        # First get list of projects to get a project ID
        success, projects_data = self.run_test("Get Projects for Designer Test", "GET", "api/projects", 200,
                                              auth_token=self.designer_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            return self.run_test("Get Single Project (Designer)", "GET", f"api/projects/{project_id}", 200,
                               auth_token=self.designer_token)
        else:
            print("⚠️  No projects found for designer single project test")
            return False, {}

    def test_get_nonexistent_project(self):
        """Test get project that doesn't exist"""
        return self.run_test("Get Nonexistent Project", "GET", "api/projects/nonexistent-id", 404,
                           auth_token=self.admin_token)

    def cleanup_test_data(self):
        """Clean up test data from MongoDB"""
        print("\n🧹 Cleaning up test data...")
        
        cleanup_commands = f'''
use('test_database');
db.users.deleteMany({{user_id: {{$regex: "^test-"}}}});
db.user_sessions.deleteMany({{user_id: {{$regex: "^test-"}}}});
db.projects.deleteMany({{project_id: {{$regex: "^proj_"}}}});
print("Test data cleaned up");
'''
        
        try:
            import subprocess
            result = subprocess.run(['mongosh', '--eval', cleanup_commands], 
                                  capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                print("✅ Test data cleaned up successfully")
            else:
                print(f"⚠️  Cleanup warning: {result.stderr}")
        except Exception as e:
            print(f"⚠️  Cleanup error: {str(e)}")

def main():
    print("🚀 Starting Arkiflo API Tests")
    print("=" * 50)
    
    tester = ArkifloAPITester()
    
    # Setup test users
    if not tester.setup_test_users():
        print("❌ Failed to setup test users, stopping tests")
        return 1

    try:
        # Run all tests
        print("\n📋 Running API Tests...")
        
        # Basic health check
        tester.test_health_endpoint()
        
        # Auth tests
        tester.test_auth_me_admin()
        tester.test_auth_me_designer()
        tester.test_auth_me_no_token()
        
        # Admin-only endpoints
        tester.test_list_users_admin()
        tester.test_list_users_designer()
        tester.test_update_user_role_admin()
        tester.test_update_user_role_designer()
        tester.test_update_user_role_invalid()
        
        # Logout test (do this last as it invalidates session)
        tester.test_logout()
        
    finally:
        # Always cleanup
        tester.cleanup_test_data()

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