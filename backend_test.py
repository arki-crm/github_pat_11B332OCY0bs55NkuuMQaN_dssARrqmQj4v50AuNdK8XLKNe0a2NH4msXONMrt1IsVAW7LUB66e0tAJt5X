import requests
import sys
import json
from datetime import datetime, timezone, timedelta
import uuid

class ArkifloAPITester:
    def __init__(self, base_url="https://design-workflow-7.preview.emergentagent.com"):
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

    def setup_test_users(self):
        """Create test users and sessions directly in MongoDB"""
        print("\n🔧 Setting up test users and sessions...")
        
        # Create admin user
        admin_user_id = f"test-admin-{uuid.uuid4().hex[:8]}"
        admin_session_token = f"test_admin_session_{uuid.uuid4().hex[:16]}"
        
        # Create designer user  
        designer_user_id = f"test-designer-{uuid.uuid4().hex[:8]}"
        designer_session_token = f"test_designer_session_{uuid.uuid4().hex[:16]}"
        
        # Create pure designer user for permission tests
        pure_designer_user_id = f"test-pure-designer-{uuid.uuid4().hex[:8]}"
        pure_designer_session_token = f"test_pure_designer_session_{uuid.uuid4().hex[:16]}"
        
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

// Create pure designer user for permission tests
db.users.insertOne({{
  user_id: "{pure_designer_user_id}",
  email: "pure.designer.test.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
  name: "Test Pure Designer", 
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

// Create pure designer session
db.user_sessions.insertOne({{
  user_id: "{pure_designer_user_id}",
  session_token: "{pure_designer_session_token}",
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});

print("Admin session token: {admin_session_token}");
print("Designer session token: {designer_session_token}");
print("Pure Designer session token: {pure_designer_session_token}");
print("Admin user ID: {admin_user_id}");
print("Designer user ID: {designer_user_id}");
print("Pure Designer user ID: {pure_designer_user_id}");
'''
        
        try:
            import subprocess
            result = subprocess.run(['mongosh', '--eval', mongo_commands], 
                                  capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                print("✅ Test users and sessions created successfully")
                self.admin_token = admin_session_token
                self.designer_token = designer_session_token
                self.pure_designer_token = pure_designer_session_token
                self.admin_user_id = admin_user_id
                self.designer_user_id = designer_user_id
                self.pure_designer_user_id = pure_designer_user_id
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
                           auth_token=self.pure_designer_token)

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

    # ============ PROJECT DETAIL VIEW TESTS ============

    def test_get_project_with_timeline_and_comments(self):
        """Test GET /api/projects/:id returns timeline and comments"""
        # First get list of projects to get a project ID
        success, projects_data = self.run_test("Get Projects for Detail Test", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            success, project_data = self.run_test("Get Project Detail with Timeline/Comments", "GET", 
                                                 f"api/projects/{project_id}", 200,
                                                 auth_token=self.admin_token)
            if success:
                # Verify timeline and comments are present
                has_timeline = 'timeline' in project_data
                has_comments = 'comments' in project_data
                print(f"   Timeline present: {has_timeline}")
                print(f"   Comments present: {has_comments}")
                if has_timeline and has_comments:
                    print(f"   Timeline items: {len(project_data.get('timeline', []))}")
                    print(f"   Comments count: {len(project_data.get('comments', []))}")
                return success and has_timeline and has_comments, project_data
            return success, project_data
        else:
            print("⚠️  No projects found for detail test")
            return False, {}

    def test_add_comment_to_project(self):
        """Test POST /api/projects/:id/comments adds a comment"""
        # First get a project ID
        success, projects_data = self.run_test("Get Projects for Comment Test", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            comment_message = f"Test comment added at {datetime.now().isoformat()}"
            
            success, comment_data = self.run_test("Add Comment to Project", "POST", 
                                                 f"api/projects/{project_id}/comments", 200,
                                                 data={"message": comment_message},
                                                 auth_token=self.admin_token)
            if success:
                # Verify comment structure
                has_id = 'id' in comment_data
                has_user_info = 'user_name' in comment_data and 'role' in comment_data
                has_message = comment_data.get('message') == comment_message
                has_timestamp = 'created_at' in comment_data
                print(f"   Comment ID present: {has_id}")
                print(f"   User info present: {has_user_info}")
                print(f"   Message correct: {has_message}")
                print(f"   Timestamp present: {has_timestamp}")
                return success and has_id and has_user_info and has_message and has_timestamp, comment_data
            return success, comment_data
        else:
            print("⚠️  No projects found for comment test")
            return False, {}

    def test_update_project_stage(self):
        """Test PUT /api/projects/:id/stage changes stage and adds system comment"""
        # First get a project ID
        success, projects_data = self.run_test("Get Projects for Stage Test", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            current_stage = projects_data[0].get('stage', 'Pre 10%')
            
            # Choose a different stage to update to
            stages = ["Design Finalization", "Production Preparation", "Production", "Delivery", "Installation", "Handover"]
            new_stage = None
            for stage in stages:
                if stage != current_stage:
                    new_stage = stage
                    break
            
            if new_stage:
                success, stage_data = self.run_test("Update Project Stage", "PUT", 
                                                   f"api/projects/{project_id}/stage", 200,
                                                   data={"stage": new_stage},
                                                   auth_token=self.admin_token)
                if success:
                    # Verify response structure
                    has_message = 'message' in stage_data
                    has_stage = stage_data.get('stage') == new_stage
                    has_system_comment = 'system_comment' in stage_data
                    print(f"   Update message present: {has_message}")
                    print(f"   Stage updated correctly: {has_stage}")
                    print(f"   System comment generated: {has_system_comment}")
                    
                    # Verify system comment structure
                    if has_system_comment:
                        sys_comment = stage_data['system_comment']
                        is_system = sys_comment.get('is_system', False)
                        has_stage_message = f'"{current_stage}"' in sys_comment.get('message', '') and f'"{new_stage}"' in sys_comment.get('message', '')
                        print(f"   System comment is_system: {is_system}")
                        print(f"   System comment mentions stages: {has_stage_message}")
                    
                    return success and has_message and has_stage and has_system_comment, stage_data
                return success, stage_data
            else:
                print("⚠️  Could not find different stage to update to")
                return False, {}
        else:
            print("⚠️  No projects found for stage test")
            return False, {}

    def test_add_comment_designer_access(self):
        """Test Designer can add comments to assigned projects"""
        # First get projects as designer
        success, projects_data = self.run_test("Get Designer Projects for Comment", "GET", "api/projects", 200,
                                              auth_token=self.designer_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            comment_message = f"Designer test comment at {datetime.now().isoformat()}"
            
            return self.run_test("Add Comment as Designer", "POST", 
                               f"api/projects/{project_id}/comments", 200,
                               data={"message": comment_message},
                               auth_token=self.designer_token)
        else:
            print("⚠️  Designer has no assigned projects for comment test")
            return True, {}  # This is expected if designer has no projects

    def test_update_stage_designer_access(self):
        """Test Designer can update stage for assigned projects"""
        # First get projects as designer
        success, projects_data = self.run_test("Get Designer Projects for Stage Update", "GET", "api/projects", 200,
                                              auth_token=self.designer_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            current_stage = projects_data[0].get('stage', 'Pre 10%')
            
            # Try to update to next stage
            stages = ["Design Finalization", "Production Preparation", "Production", "Delivery", "Installation", "Handover"]
            current_index = stages.index(current_stage) if current_stage in stages else 0
            new_stage = stages[min(current_index + 1, len(stages) - 1)]
            
            if new_stage != current_stage:
                return self.run_test("Update Stage as Designer", "PUT", 
                                   f"api/projects/{project_id}/stage", 200,
                                   data={"stage": new_stage},
                                   auth_token=self.designer_token)
            else:
                print("⚠️  Project already at final stage")
                return True, {}
        else:
            print("⚠️  Designer has no assigned projects for stage update test")
            return True, {}  # This is expected if designer has no projects

    def test_presales_access_denied(self):
        """Test PreSales user cannot access project details"""
        # Create a PreSales user for testing
        presales_user_id = f"test-presales-{uuid.uuid4().hex[:8]}"
        presales_session_token = f"test_presales_session_{uuid.uuid4().hex[:16]}"
        
        mongo_commands = f'''
use('test_database');
db.users.insertOne({{
  user_id: "{presales_user_id}",
  email: "presales.test.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
  name: "Test PreSales",
  picture: "https://via.placeholder.com/150",
  role: "PreSales",
  created_at: new Date()
}});
db.user_sessions.insertOne({{
  user_id: "{presales_user_id}",
  session_token: "{presales_session_token}",
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});
'''
        
        try:
            import subprocess
            result = subprocess.run(['mongosh', '--eval', mongo_commands], 
                                  capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                # Test project access with PreSales token
                success, projects_data = self.run_test("Get Projects for PreSales Test", "GET", "api/projects", 200,
                                                      auth_token=self.admin_token)
                if success and projects_data and len(projects_data) > 0:
                    project_id = projects_data[0]['project_id']
                    
                    # Test project detail access (should be denied)
                    success, _ = self.run_test("PreSales Project Detail Access (Should Fail)", "GET", 
                                             f"api/projects/{project_id}", 403,
                                             auth_token=presales_session_token)
                    
                    # Test add comment (should be denied)
                    success2, _ = self.run_test("PreSales Add Comment (Should Fail)", "POST", 
                                              f"api/projects/{project_id}/comments", 403,
                                              data={"message": "Test comment"},
                                              auth_token=presales_session_token)
                    
                    # Test stage update (should be denied)
                    success3, _ = self.run_test("PreSales Update Stage (Should Fail)", "PUT", 
                                              f"api/projects/{project_id}/stage", 403,
                                              data={"stage": "Production Preparation"},
                                              auth_token=presales_session_token)
                    
                    return success and success2 and success3, {}
                else:
                    print("⚠️  No projects found for PreSales test")
                    return False, {}
            else:
                print(f"❌ Failed to create PreSales user: {result.stderr}")
                return False, {}
                
        except Exception as e:
            print(f"❌ Error testing PreSales access: {str(e)}")
            return False, {}

    # ============ FILES ENDPOINTS TESTS ============

    def test_get_project_files(self):
        """Test GET /api/projects/:id/files returns files array"""
        success, projects_data = self.run_test("Get Projects for Files Test", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            success, files_data = self.run_test("Get Project Files", "GET", 
                                               f"api/projects/{project_id}/files", 200,
                                               auth_token=self.admin_token)
            if success:
                is_array = isinstance(files_data, list)
                print(f"   Files is array: {is_array}")
                print(f"   Files count: {len(files_data) if is_array else 'N/A'}")
                return success and is_array, files_data
            return success, files_data
        else:
            print("⚠️  No projects found for files test")
            return False, {}

    def test_upload_file(self):
        """Test POST /api/projects/:id/files uploads a file"""
        success, projects_data = self.run_test("Get Projects for File Upload", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            
            # Create a test file (base64 encoded)
            test_file_data = {
                "file_name": "test_document.pdf",
                "file_url": "data:application/pdf;base64,JVBERi0xLjQKJdPr6eEKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPD4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQo+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDQKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjE3NAolJUVPRgo=",
                "file_type": "pdf"
            }
            
            success, file_response = self.run_test("Upload File", "POST", 
                                                  f"api/projects/{project_id}/files", 200,
                                                  data=test_file_data,
                                                  auth_token=self.admin_token)
            if success:
                # Verify file response structure
                has_id = 'id' in file_response
                has_name = file_response.get('file_name') == test_file_data['file_name']
                has_uploader = 'uploaded_by' in file_response and 'uploaded_by_name' in file_response
                has_timestamp = 'uploaded_at' in file_response
                print(f"   File ID present: {has_id}")
                print(f"   File name correct: {has_name}")
                print(f"   Uploader info present: {has_uploader}")
                print(f"   Upload timestamp present: {has_timestamp}")
                
                # Store file ID for deletion test
                if has_id:
                    self.test_file_id = file_response['id']
                    self.test_project_id = project_id
                
                return success and has_id and has_name and has_uploader and has_timestamp, file_response
            return success, file_response
        else:
            print("⚠️  No projects found for file upload test")
            return False, {}

    def test_delete_file_admin(self):
        """Test DELETE /api/projects/:id/files/:file_id (Admin only)"""
        if hasattr(self, 'test_file_id') and hasattr(self, 'test_project_id'):
            return self.run_test("Delete File (Admin)", "DELETE", 
                               f"api/projects/{self.test_project_id}/files/{self.test_file_id}", 200,
                               auth_token=self.admin_token)
        else:
            print("⚠️  No test file available for deletion test")
            return True, {}  # Skip if no file to delete

    def test_delete_file_designer(self):
        """Test DELETE /api/projects/:id/files/:file_id with Designer token (should fail)"""
        # First upload a file as admin
        success, projects_data = self.run_test("Get Projects for Designer Delete Test", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            
            # Upload a test file
            test_file_data = {
                "file_name": "test_for_designer_delete.pdf",
                "file_url": "data:application/pdf;base64,JVBERi0xLjQKJdPr6eEK",
                "file_type": "pdf"
            }
            
            success, file_response = self.run_test("Upload File for Designer Delete Test", "POST", 
                                                  f"api/projects/{project_id}/files", 200,
                                                  data=test_file_data,
                                                  auth_token=self.admin_token)
            if success and 'id' in file_response:
                file_id = file_response['id']
                
                # Try to delete as designer (should fail)
                return self.run_test("Delete File (Designer - Should Fail)", "DELETE", 
                                   f"api/projects/{project_id}/files/{file_id}", 403,
                                   auth_token=self.pure_designer_token)
            else:
                print("⚠️  Failed to upload test file for designer delete test")
                return False, {}
        else:
            print("⚠️  No projects found for designer delete test")
            return False, {}

    # ============ NOTES ENDPOINTS TESTS ============

    def test_get_project_notes(self):
        """Test GET /api/projects/:id/notes returns notes array"""
        success, projects_data = self.run_test("Get Projects for Notes Test", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            success, notes_data = self.run_test("Get Project Notes", "GET", 
                                               f"api/projects/{project_id}/notes", 200,
                                               auth_token=self.admin_token)
            if success:
                is_array = isinstance(notes_data, list)
                print(f"   Notes is array: {is_array}")
                print(f"   Notes count: {len(notes_data) if is_array else 'N/A'}")
                return success and is_array, notes_data
            return success, notes_data
        else:
            print("⚠️  No projects found for notes test")
            return False, {}

    def test_create_note(self):
        """Test POST /api/projects/:id/notes creates a note"""
        success, projects_data = self.run_test("Get Projects for Note Creation", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            
            note_data = {
                "title": "Test Note",
                "content": "This is a test note content for API testing."
            }
            
            success, note_response = self.run_test("Create Note", "POST", 
                                                  f"api/projects/{project_id}/notes", 200,
                                                  data=note_data,
                                                  auth_token=self.admin_token)
            if success:
                # Verify note response structure
                has_id = 'id' in note_response
                has_title = note_response.get('title') == note_data['title']
                has_content = note_response.get('content') == note_data['content']
                has_creator = 'created_by' in note_response and 'created_by_name' in note_response
                has_timestamps = 'created_at' in note_response and 'updated_at' in note_response
                print(f"   Note ID present: {has_id}")
                print(f"   Title correct: {has_title}")
                print(f"   Content correct: {has_content}")
                print(f"   Creator info present: {has_creator}")
                print(f"   Timestamps present: {has_timestamps}")
                
                # Store note ID for update test
                if has_id:
                    self.test_note_id = note_response['id']
                    self.test_note_project_id = project_id
                
                return success and has_id and has_title and has_content and has_creator and has_timestamps, note_response
            return success, note_response
        else:
            print("⚠️  No projects found for note creation test")
            return False, {}

    def test_update_note(self):
        """Test PUT /api/projects/:id/notes/:note_id updates a note"""
        if hasattr(self, 'test_note_id') and hasattr(self, 'test_note_project_id'):
            update_data = {
                "title": "Updated Test Note",
                "content": "This note content has been updated via API test."
            }
            
            success, note_response = self.run_test("Update Note", "PUT", 
                                                  f"api/projects/{self.test_note_project_id}/notes/{self.test_note_id}", 200,
                                                  data=update_data,
                                                  auth_token=self.admin_token)
            if success:
                # Verify updated content
                title_updated = note_response.get('title') == update_data['title']
                content_updated = note_response.get('content') == update_data['content']
                has_updated_timestamp = 'updated_at' in note_response
                print(f"   Title updated: {title_updated}")
                print(f"   Content updated: {content_updated}")
                print(f"   Updated timestamp present: {has_updated_timestamp}")
                
                return success and title_updated and content_updated and has_updated_timestamp, note_response
            return success, note_response
        else:
            print("⚠️  No test note available for update test")
            return True, {}  # Skip if no note to update

    def test_update_note_designer_permission(self):
        """Test Designer can only update their own notes"""
        # First create a note as admin
        success, projects_data = self.run_test("Get Projects for Designer Note Test", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            
            # Create note as admin
            note_data = {"title": "Admin Note", "content": "Created by admin"}
            success, admin_note = self.run_test("Create Admin Note", "POST", 
                                               f"api/projects/{project_id}/notes", 200,
                                               data=note_data,
                                               auth_token=self.admin_token)
            
            if success and 'id' in admin_note:
                admin_note_id = admin_note['id']
                
                # Try to update admin's note as designer (should fail)
                update_data = {"title": "Designer Updated", "content": "Designer tried to update"}
                success, _ = self.run_test("Update Admin Note as Designer (Should Fail)", "PUT", 
                                         f"api/projects/{project_id}/notes/{admin_note_id}", 403,
                                         data=update_data,
                                         auth_token=self.pure_designer_token)
                return success, {}
            else:
                print("⚠️  Failed to create admin note for permission test")
                return False, {}
        else:
            print("⚠️  No projects found for designer note permission test")
            return False, {}

    # ============ COLLABORATORS ENDPOINTS TESTS ============

    def test_get_project_collaborators(self):
        """Test GET /api/projects/:id/collaborators returns collaborators with details"""
        success, projects_data = self.run_test("Get Projects for Collaborators Test", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            success, collaborators_data = self.run_test("Get Project Collaborators", "GET", 
                                                       f"api/projects/{project_id}/collaborators", 200,
                                                       auth_token=self.admin_token)
            if success:
                is_array = isinstance(collaborators_data, list)
                print(f"   Collaborators is array: {is_array}")
                print(f"   Collaborators count: {len(collaborators_data) if is_array else 'N/A'}")
                
                # Check if collaborators have required fields
                if is_array and len(collaborators_data) > 0:
                    first_collab = collaborators_data[0]
                    has_user_details = all(field in first_collab for field in ['user_id', 'name', 'email', 'role'])
                    print(f"   Collaborator details complete: {has_user_details}")
                    return success and is_array and has_user_details, collaborators_data
                
                return success and is_array, collaborators_data
            return success, collaborators_data
        else:
            print("⚠️  No projects found for collaborators test")
            return False, {}

    def test_add_collaborator_admin(self):
        """Test POST /api/projects/:id/collaborators adds collaborator (Admin/Manager only)"""
        success, projects_data = self.run_test("Get Projects for Add Collaborator", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            
            # Add designer as collaborator
            collaborator_data = {"user_id": self.designer_user_id}
            
            success, add_response = self.run_test("Add Collaborator (Admin)", "POST", 
                                                 f"api/projects/{project_id}/collaborators", 200,
                                                 data=collaborator_data,
                                                 auth_token=self.admin_token)
            if success:
                # Verify response structure
                has_message = 'message' in add_response
                has_user_id = add_response.get('user_id') == self.designer_user_id
                has_name = 'name' in add_response
                print(f"   Success message present: {has_message}")
                print(f"   User ID correct: {has_user_id}")
                print(f"   User name present: {has_name}")
                
                # Store for removal test
                self.test_collab_project_id = project_id
                self.test_collab_user_id = self.designer_user_id
                
                return success and has_message and has_user_id and has_name, add_response
            return success, add_response
        else:
            print("⚠️  No projects found for add collaborator test")
            return False, {}

    def test_add_collaborator_designer(self):
        """Test POST /api/projects/:id/collaborators with Designer token (should fail)"""
        success, projects_data = self.run_test("Get Projects for Designer Add Collaborator", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            
            # Try to add collaborator as designer (should fail)
            collaborator_data = {"user_id": self.admin_user_id}
            
            return self.run_test("Add Collaborator (Designer - Should Fail)", "POST", 
                               f"api/projects/{project_id}/collaborators", 403,
                               data=collaborator_data,
                               auth_token=self.pure_designer_token)
        else:
            print("⚠️  No projects found for designer add collaborator test")
            return False, {}

    def test_remove_collaborator_admin(self):
        """Test DELETE /api/projects/:id/collaborators/:user_id (Admin only)"""
        if hasattr(self, 'test_collab_project_id') and hasattr(self, 'test_collab_user_id'):
            return self.run_test("Remove Collaborator (Admin)", "DELETE", 
                               f"api/projects/{self.test_collab_project_id}/collaborators/{self.test_collab_user_id}", 200,
                               auth_token=self.admin_token)
        else:
            print("⚠️  No test collaborator available for removal test")
            return True, {}  # Skip if no collaborator to remove

    def test_remove_collaborator_designer(self):
        """Test DELETE /api/projects/:id/collaborators/:user_id with Designer token (should fail)"""
        # First add a collaborator as admin
        success, projects_data = self.run_test("Get Projects for Designer Remove Test", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            
            # Add pure designer as collaborator first
            collaborator_data = {"user_id": self.pure_designer_user_id}
            success, _ = self.run_test("Add Pure Designer for Remove Test", "POST", 
                                     f"api/projects/{project_id}/collaborators", 200,
                                     data=collaborator_data,
                                     auth_token=self.admin_token)
            
            if success:
                # Try to remove as designer (should fail)
                return self.run_test("Remove Collaborator (Designer - Should Fail)", "DELETE", 
                                   f"api/projects/{project_id}/collaborators/{self.pure_designer_user_id}", 403,
                                   auth_token=self.pure_designer_token)
            else:
                print("⚠️  Failed to add collaborator for designer remove test")
                return False, {}
        else:
            print("⚠️  No projects found for designer remove collaborator test")
            return False, {}

    def test_get_available_users(self):
        """Test GET /api/users/available returns list of all users"""
        success, users_data = self.run_test("Get Available Users (Admin)", "GET", "api/users/available", 200,
                                           auth_token=self.admin_token)
        if success:
            is_array = isinstance(users_data, list)
            print(f"   Users is array: {is_array}")
            print(f"   Users count: {len(users_data) if is_array else 'N/A'}")
            
            # Check if users have required fields
            if is_array and len(users_data) > 0:
                first_user = users_data[0]
                has_user_fields = all(field in first_user for field in ['user_id', 'name', 'email', 'role'])
                print(f"   User fields complete: {has_user_fields}")
                return success and is_array and has_user_fields, users_data
            
            return success and is_array, users_data
        return success, users_data

    def test_get_available_users_designer(self):
        """Test GET /api/users/available with Designer token (should fail)"""
        return self.run_test("Get Available Users (Designer - Should Fail)", "GET", "api/users/available", 403,
                           auth_token=self.pure_designer_token)

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
        
        # Project tests
        print("\n📁 Testing Project Endpoints...")
        tester.test_seed_projects_admin()
        tester.test_seed_projects_designer()
        tester.test_list_projects_admin()
        tester.test_list_projects_designer()
        tester.test_list_projects_no_auth()
        tester.test_list_projects_with_stage_filter()
        tester.test_list_projects_with_search()
        tester.test_get_single_project_admin()
        tester.test_get_single_project_designer()
        tester.test_get_nonexistent_project()
        
        # Project Detail View tests
        print("\n🔍 Testing Project Detail View Endpoints...")
        tester.test_get_project_with_timeline_and_comments()
        tester.test_add_comment_to_project()
        tester.test_update_project_stage()
        tester.test_add_comment_designer_access()
        tester.test_update_stage_designer_access()
        tester.test_presales_access_denied()
        
        # Files endpoints tests
        print("\n📁 Testing Files Endpoints...")
        tester.test_get_project_files()
        tester.test_upload_file()
        tester.test_delete_file_admin()
        tester.test_delete_file_designer()
        
        # Notes endpoints tests
        print("\n📝 Testing Notes Endpoints...")
        tester.test_get_project_notes()
        tester.test_create_note()
        tester.test_update_note()
        tester.test_update_note_designer_permission()
        
        # Collaborators endpoints tests
        print("\n👥 Testing Collaborators Endpoints...")
        tester.test_get_project_collaborators()
        tester.test_add_collaborator_admin()
        tester.test_add_collaborator_designer()
        tester.test_remove_collaborator_admin()
        tester.test_remove_collaborator_designer()
        tester.test_get_available_users()
        tester.test_get_available_users_designer()
        
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