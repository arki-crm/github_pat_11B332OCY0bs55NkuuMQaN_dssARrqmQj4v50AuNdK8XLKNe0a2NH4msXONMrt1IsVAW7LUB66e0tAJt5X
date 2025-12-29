#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timezone, timedelta
import uuid

class Phase15AFullTester:
    def __init__(self, base_url="https://design-workflow-9.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.designer_token = None
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

    def test_seed_design_workflow(self):
        """Test POST /api/design-workflow/seed - Create test data for design workflow"""
        return self.run_test("Seed Design Workflow Data", "POST", "api/design-workflow/seed", 200,
                           auth_token=self.admin_token)

    def test_create_design_project(self):
        """Test POST /api/design-projects - Create a design project for testing"""
        project_data = {
            "project_name": "Test Design Project",
            "client_name": "Test Client",
            "client_phone": "9876543210",
            "project_value": 500000,
            "assigned_designer": self.designer_user_id
        }
        
        success, response_data = self.run_test("Create Design Project", "POST", "api/design-projects", 200,
                                             data=project_data, auth_token=self.admin_token)
        if success and 'id' in response_data:
            self.test_design_project_id = response_data['id']
            print(f"   Created design project ID: {self.test_design_project_id}")
        
        return success, response_data

    def test_validation_pipeline_with_data(self):
        """Test GET /api/validation-pipeline - Validation Pipeline with data"""
        success, pipeline_data = self.run_test("Validation Pipeline (With Data)", "GET", "api/validation-pipeline", 200,
                                              auth_token=self.admin_token)
        if success:
            # Check if it's the new format with pipeline array
            if isinstance(pipeline_data, dict) and 'pipeline' in pipeline_data:
                pipeline_array = pipeline_data['pipeline']
                is_array = isinstance(pipeline_array, list)
                print(f"   Pipeline is array: {is_array}")
                print(f"   Pipeline items: {len(pipeline_array) if is_array else 'N/A'}")
                
                if is_array and len(pipeline_array) > 0:
                    first_item = pipeline_array[0]
                    required_fields = ['design_project', 'project', 'designer', 'has_drawings', 'has_sign_off', 'files']
                    has_required_fields = all(field in first_item for field in required_fields)
                    print(f"   Has required fields: {has_required_fields}")
                    
                    # Store for validation test
                    if 'design_project' in first_item and 'id' in first_item['design_project']:
                        self.validation_design_project_id = first_item['design_project']['id']
                    
                    return success and is_array and has_required_fields, pipeline_data
                
                return success and is_array, pipeline_data
            else:
                # Old format - direct array
                is_array = isinstance(pipeline_data, list)
                print(f"   Pipeline is array: {is_array}")
                print(f"   Pipeline items: {len(pipeline_data) if is_array else 'N/A'}")
                return success and is_array, pipeline_data
        return success, pipeline_data

    def test_validate_design_project(self):
        """Test POST /api/validation-pipeline/{design_project_id}/validate - Validate a design project"""
        if hasattr(self, 'validation_design_project_id'):
            validation_data = {
                "status": "approved",
                "notes": "Design approved after review. Ready for production."
            }
            
            success, validate_response = self.run_test("Validate Design Project", "POST", 
                                                     f"api/validation-pipeline/{self.validation_design_project_id}/validate", 200,
                                                     data=validation_data,
                                                     auth_token=self.admin_token)
            if success:
                # Verify response structure
                has_message = 'message' in validate_response
                print(f"   Validation message present: {has_message}")
                
                return success and has_message, validate_response
            return success, validate_response
        else:
            print("⚠️  No design project available for validation test")
            return True, {}

    def test_validate_design_project_designer_denied(self):
        """Test POST /api/validation-pipeline/{design_project_id}/validate with Designer token (should fail)"""
        if hasattr(self, 'validation_design_project_id'):
            validation_data = {
                "status": "approved",
                "notes": "Designer trying to validate"
            }
            
            return self.run_test("Validate Design Project (Designer - Should Fail)", "POST", 
                               f"api/validation-pipeline/{self.validation_design_project_id}/validate", 403,
                               data=validation_data,
                               auth_token=self.designer_token)
        else:
            print("⚠️  No design project for designer validation test")
            return True, {}

    def test_send_to_production(self):
        """Test POST /api/validation-pipeline/{design_project_id}/send-to-production - Send to production"""
        if hasattr(self, 'validation_design_project_id'):
            success, production_response = self.run_test("Send to Production", "POST", 
                                                        f"api/validation-pipeline/{self.validation_design_project_id}/send-to-production", 200,
                                                        auth_token=self.admin_token)
            if success:
                # Verify response structure
                has_message = 'message' in production_response
                print(f"   Production message present: {has_message}")
                
                return success and has_message, production_response
            return success, production_response
        else:
            print("⚠️  No design project available for production test")
            return True, {}

    def test_get_design_tasks_with_data(self):
        """Test GET /api/design-tasks - Get design tasks with data"""
        success, tasks_data = self.run_test("Get Design Tasks (With Data)", "GET", "api/design-tasks", 200,
                                           auth_token=self.admin_token)
        if success:
            # Verify tasks structure
            is_array = isinstance(tasks_data, list)
            print(f"   Tasks is array: {is_array}")
            print(f"   Tasks count: {len(tasks_data) if is_array else 'N/A'}")
            
            if is_array and len(tasks_data) > 0:
                first_task = tasks_data[0]
                required_fields = ['id', 'title', 'status', 'due_date', 'is_overdue']
                has_required_fields = all(field in first_task for field in required_fields)
                
                print(f"   Has required fields: {has_required_fields}")
                print(f"   First task status: {first_task.get('status', 'N/A')}")
                
                # Store task ID for update test
                if 'id' in first_task:
                    self.test_design_task_id = first_task['id']
                
                return success and is_array and has_required_fields, tasks_data
            
            return success and is_array, tasks_data
        return success, tasks_data

    def test_update_design_task_status(self):
        """Test PUT /api/design-tasks/{task_id} - Update task status"""
        if hasattr(self, 'test_design_task_id'):
            update_data = {
                "status": "In Progress"
            }
            
            success, update_response = self.run_test("Update Design Task Status", "PUT", 
                                                   f"api/design-tasks/{self.test_design_task_id}", 200,
                                                   data=update_data,
                                                   auth_token=self.admin_token)
            if success:
                # Verify response structure
                has_message = 'message' in update_response
                print(f"   Update message present: {has_message}")
                
                return success and has_message, update_response
            return success, update_response
        else:
            print("⚠️  No test design task available for status update")
            return True, {}

    def test_update_design_task_invalid_status(self):
        """Test PUT /api/design-tasks/{task_id} with invalid status (should fail)"""
        if hasattr(self, 'test_design_task_id'):
            update_data = {
                "status": "InvalidStatus"
            }
            
            return self.run_test("Update Design Task (Invalid Status)", "PUT", 
                               f"api/design-tasks/{self.test_design_task_id}", 400,
                               data=update_data,
                               auth_token=self.admin_token)
        else:
            print("⚠️  No test design task available for invalid status test")
            return True, {}

    def test_get_design_projects_with_data(self):
        """Test GET /api/design-projects - Get design projects with data"""
        success, projects_data = self.run_test("Get Design Projects (With Data)", "GET", "api/design-projects", 200,
                                              auth_token=self.admin_token)
        if success:
            # Verify projects structure
            is_array = isinstance(projects_data, list)
            print(f"   Design projects is array: {is_array}")
            print(f"   Design projects count: {len(projects_data) if is_array else 'N/A'}")
            
            if is_array and len(projects_data) > 0:
                first_project = projects_data[0]
                required_fields = ['id', 'project_id', 'current_stage', 'status', 'tasks_completed', 'tasks_total', 'has_delays']
                has_required_fields = all(field in first_project for field in required_fields)
                
                print(f"   Has required fields: {has_required_fields}")
                print(f"   First project stage: {first_project.get('current_stage', 'N/A')}")
                print(f"   Tasks progress: {first_project.get('tasks_completed', 0)}/{first_project.get('tasks_total', 0)}")
                
                return success and has_required_fields, projects_data
            
            return success and is_array, projects_data
        return success, projects_data

    def test_role_based_access_design_manager_dashboard(self):
        """Test role-based access for design manager dashboard"""
        return self.run_test("Design Manager Dashboard (Designer - Should Fail)", "GET", "api/design-manager/dashboard", 403,
                           auth_token=self.designer_token)

    def test_role_based_access_ceo_dashboard(self):
        """Test role-based access for CEO dashboard"""
        return self.run_test("CEO Dashboard (Designer - Should Fail)", "GET", "api/ceo/dashboard", 403,
                           auth_token=self.designer_token)

    def cleanup_test_data(self):
        """Clean up test data from MongoDB"""
        print("\n🧹 Cleaning up test data...")
        
        cleanup_commands = f'''
use('test_database');
db.users.deleteMany({{user_id: /^test-/}});
db.user_sessions.deleteMany({{user_id: /^test-/}});
print("Cleanup completed");
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
    print("🚀 Starting Phase 15A Design Workflow API Tests (Full)")
    print("=" * 60)
    
    tester = Phase15AFullTester()
    
    try:
        # Setup test environment
        if not tester.setup_test_users():
            print("❌ Failed to setup test environment")
            return 1
        
        # Phase 15A Design Workflow Tests
        print("\n🎨 Testing Phase 15A Design Workflow API...")
        
        # 1. Seed data
        tester.test_seed_design_workflow()
        
        # 2. Create a design project for testing
        tester.test_create_design_project()
        
        # 3. Test dashboard endpoints
        print("\n📊 Testing Dashboard Endpoints...")
        tester.test_validation_pipeline_with_data()
        
        # 4. Test validation endpoints
        print("\n✅ Testing Validation Endpoints...")
        tester.test_validate_design_project()
        tester.test_validate_design_project_designer_denied()
        tester.test_send_to_production()
        
        # 5. Test task endpoints
        print("\n📋 Testing Task Endpoints...")
        tester.test_get_design_tasks_with_data()
        tester.test_update_design_task_status()
        tester.test_update_design_task_invalid_status()
        
        # 6. Test project endpoints
        print("\n🏗️ Testing Project Endpoints...")
        tester.test_get_design_projects_with_data()
        
        # 7. Test role-based access
        print("\n🔒 Testing Role-Based Access...")
        tester.test_role_based_access_design_manager_dashboard()
        tester.test_role_based_access_ceo_dashboard()
        
    finally:
        # Always cleanup
        tester.cleanup_test_data()

    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.failed_tests:
        print("\n❌ Failed Tests:")
        for failure in tester.failed_tests:
            print(f"  - {failure.get('test', 'Unknown')}: {failure}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())