#!/usr/bin/env python3
"""
Warranty & After-Service Module Test Script for Arkiflo CRM
Tests the newly implemented warranty and service request endpoints
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
import subprocess

class WarrantyServiceTester:
    def __init__(self):
        self.base_url = "https://designbooks-1.preview.emergentagent.com"
        self.admin_token = None
        self.technician_token = None
        self.technician_user_id = None
        self.test_service_request_id = None
        self.failed_tests = []
        self.tests_run = 0
        self.tests_passed = 0
        
    def setup_test_users(self):
        """Setup admin and technician users for testing"""
        print("🔧 Setting up test users...")
        
        # Create admin user
        admin_user_id = f"test-admin-{uuid.uuid4().hex[:8]}"
        admin_session_token = f"test_admin_session_{uuid.uuid4().hex[:16]}"
        
        # Create technician user
        technician_user_id = f"test-technician-{uuid.uuid4().hex[:8]}"
        technician_session_token = f"test_technician_session_{uuid.uuid4().hex[:16]}"
        
        mongo_commands = f'''
use('test_database');
db.users.insertOne({{
  user_id: "{admin_user_id}",
  email: "admin.warranty.test.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
  name: "Test Admin Warranty",
  picture: "https://via.placeholder.com/150",
  role: "Admin",
  status: "Active",
  created_at: new Date()
}});
db.user_sessions.insertOne({{
  user_id: "{admin_user_id}",
  session_token: "{admin_session_token}",
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});
db.users.insertOne({{
  user_id: "{technician_user_id}",
  email: "technician.warranty.test.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
  name: "Test Technician Warranty",
  picture: "https://via.placeholder.com/150",
  role: "Technician",
  status: "Active",
  created_at: new Date()
}});
db.user_sessions.insertOne({{
  user_id: "{technician_user_id}",
  session_token: "{technician_session_token}",
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});
'''
        
        try:
            result = subprocess.run(['mongosh', '--eval', mongo_commands], 
                                  capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                self.admin_token = admin_session_token
                self.technician_token = technician_session_token
                self.technician_user_id = technician_user_id
                print("✅ Test users created successfully")
                return True
            else:
                print(f"❌ Failed to create test users: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"❌ Error setting up test users: {str(e)}")
            return False

    def run_test(self, test_name, method, endpoint, expected_status, data=None, auth_token=None):
        """Run a single test"""
        self.tests_run += 1
        url = f"{self.base_url}/{endpoint}"
        
        headers = {"Content-Type": "application/json"}
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"
        
        print(f"\n🔍 Testing {test_name}...")
        print(f"   URL: {url}")
        
        try:
            if method == "GET":
                response = requests.get(url, headers=headers, timeout=30)
            elif method == "POST":
                response = requests.post(url, headers=headers, json=data, timeout=30)
            elif method == "PUT":
                response = requests.put(url, headers=headers, json=data, timeout=30)
            elif method == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            if response.status_code == expected_status:
                print(f"✅ Passed - Status: {response.status_code}")
                self.tests_passed += 1
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    self.failed_tests.append({
                        "test": test_name,
                        "expected": expected_status,
                        "actual": response.status_code,
                        "response": response_data
                    })
                    return False, response_data
                except:
                    self.failed_tests.append({
                        "test": test_name,
                        "expected": expected_status,
                        "actual": response.status_code,
                        "response": response.text
                    })
                    return False, {}
                    
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            self.failed_tests.append({
                "test": test_name,
                "error": str(e)
            })
            return False, {}

    def test_technician_role_exists(self):
        """Test that Technician role exists in VALID_ROLES"""
        invite_data = {
            "name": "Test Technician Role",
            "email": f"technician.role.test.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
            "role": "Technician"
        }
        
        success, invite_response = self.run_test("Create User with Technician Role", "POST", 
                                                "api/users/invite", 200,
                                                data=invite_data, auth_token=self.admin_token)
        if success:
            user_data = invite_response.get('user', {})
            role_correct = user_data.get('role') == 'Technician'
            print(f"   User created with Technician role: {role_correct}")
            print(f"   User role: {user_data.get('role')}")
            return success and role_correct
        return success

    def test_list_warranties_admin(self):
        """Test GET /api/warranties - Admin should succeed"""
        success, _ = self.run_test("List Warranties (Admin)", "GET", "api/warranties", 200,
                                 auth_token=self.admin_token)
        return success

    def test_list_warranties_technician_denied(self):
        """Test GET /api/warranties - Technician should fail with 403"""
        success, _ = self.run_test("List Warranties (Technician - Should Fail)", "GET", "api/warranties", 403,
                                 auth_token=self.technician_token)
        return success

    def test_get_warranty_by_project(self):
        """Test GET /api/warranties/by-project/{project_id}"""
        # First get projects
        success, projects_data = self.run_test("Get Projects for Warranty Test", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            success, _ = self.run_test("Get Warranty by Project ID", "GET", 
                                     f"api/warranties/by-project/{project_id}", 200,
                                     auth_token=self.admin_token)
            return success
        else:
            print("⚠️  No projects found for warranty test")
            return True  # Skip test if no projects

    def test_list_service_requests(self):
        """Test GET /api/service-requests - List all service requests"""
        success, _ = self.run_test("List Service Requests", "GET", "api/service-requests", 200,
                                 auth_token=self.admin_token)
        return success

    def test_create_service_request_internal(self):
        """Test POST /api/service-requests - Create internal service request"""
        request_data = {
            "customer_name": "Jane Smith",
            "customer_phone": "+1-555-0456",
            "customer_email": "jane.smith@example.com",
            "customer_address": "123 Main St, City, State",
            "issue_category": "Fitting Issue",
            "issue_description": "Drawer slides are not smooth",
            "priority": "High"
        }
        
        success, create_response = self.run_test("Create Internal Service Request", "POST", 
                                                "api/service-requests", 200,
                                                data=request_data, auth_token=self.admin_token)
        if success:
            has_id = 'service_request_id' in create_response
            has_stage = create_response.get('stage') == 'New'
            has_source = create_response.get('source') == 'Internal'
            
            print(f"   Service request ID present: {has_id}")
            print(f"   Stage is New: {has_stage}")
            print(f"   Source is Internal: {has_source}")
            
            if has_id:
                self.test_service_request_id = create_response['service_request_id']
            
            return success and has_id and has_stage and has_source
        return success

    def test_create_service_request_google_form(self):
        """Test POST /api/service-requests/from-google-form - No auth required"""
        form_data = {
            "name": "Bob Johnson",
            "phone": "+1-555-0789",
            "issue_description": "Kitchen cabinet handle is loose",
            "image_urls": ["https://example.com/image1.jpg", "https://example.com/image2.jpg"]
        }
        
        success, create_response = self.run_test("Create Service Request from Google Form", "POST", 
                                                "api/service-requests/from-google-form", 200,
                                                data=form_data)  # No auth token
        if success:
            has_id = 'service_request_id' in create_response
            has_stage = create_response.get('stage') == 'New'
            has_source = create_response.get('source') == 'Google Form'
            
            print(f"   Service request ID present: {has_id}")
            print(f"   Stage is New: {has_stage}")
            print(f"   Source is Google Form: {has_source}")
            
            return success and has_id and has_stage and has_source
        return success

    def test_assign_technician_to_service_request(self):
        """Test PUT /api/service-requests/{request_id}/assign"""
        if self.test_service_request_id and self.technician_user_id:
            assign_data = {
                "technician_id": self.technician_user_id
            }
            
            success, _ = self.run_test("Assign Technician to Service Request", "PUT", 
                                     f"api/service-requests/{self.test_service_request_id}/assign", 200,
                                     data=assign_data, auth_token=self.admin_token)
            return success
        else:
            print("⚠️  No test service request or technician available for assignment test")
            return True

    def test_update_service_request_stage(self):
        """Test PUT /api/service-requests/{request_id}/stage"""
        if self.test_service_request_id:
            # First get the current service request to see its stage
            success, sr_data = self.run_test("Get Service Request Details", "GET", 
                                            f"api/service-requests/{self.test_service_request_id}", 200,
                                            auth_token=self.admin_token)
            
            if success:
                current_stage = sr_data.get('stage', 'Unknown')
                print(f"   Current stage: {current_stage}")
                
                # Try to move to the next stage based on current stage
                if current_stage == "New":
                    next_stage = "Assigned to Technician"
                elif current_stage == "Assigned to Technician":
                    next_stage = "Technician Visit Scheduled"
                else:
                    next_stage = "Technician Visit Scheduled"  # Default next stage
                
                stage_data = {
                    "stage": next_stage,
                    "notes": f"Moving from {current_stage} to {next_stage}"
                }
                
                success, _ = self.run_test("Update Service Request Stage", "PUT", 
                                         f"api/service-requests/{self.test_service_request_id}/stage", 200,
                                         data=stage_data, auth_token=self.admin_token)
                return success
            else:
                print("⚠️  Could not get service request details")
                return False
        else:
            print("⚠️  No test service request available for stage update test")
            return True

    def test_list_technicians(self):
        """Test GET /api/technicians - List all technicians"""
        success, _ = self.run_test("List Technicians", "GET", "api/technicians", 200,
                                 auth_token=self.admin_token)
        return success

    def test_technician_role_permissions(self):
        """Test that Technician role has proper permissions"""
        # Test 1: Technician can view their assigned requests
        success1, requests_data = self.run_test("Technician View Assigned Requests", "GET", 
                                               "api/service-requests", 200,
                                               auth_token=self.technician_token)
        
        # Test 2: Technician cannot create service requests (403)
        request_data = {
            "customer_name": "Test Customer",
            "customer_phone": "+1-555-0000",
            "issue_category": "Hardware Issue",
            "issue_description": "Test issue"
        }
        
        success2, _ = self.run_test("Technician Create Service Request (Should Fail)", "POST", 
                                  "api/service-requests", 403,
                                  data=request_data, auth_token=self.technician_token)
        
        # Test 3: Technician cannot access warranties (403)
        success3, _ = self.run_test("Technician Access Warranties (Should Fail)", "GET", 
                                  "api/warranties", 403,
                                  auth_token=self.technician_token)
        
        if success1:
            print(f"   Total requests visible: {len(requests_data)}")
        
        return success1 and success2 and success3

    def run_all_tests(self):
        """Run all warranty and service request tests"""
        print("🚀 Starting Warranty & After-Service Module Tests...")
        print(f"🌐 Base URL: {self.base_url}")
        
        # Setup test users
        if not self.setup_test_users():
            print("❌ Failed to setup test users. Exiting.")
            return
        
        # Test categories
        test_functions = [
            self.test_technician_role_exists,
            self.test_list_warranties_admin,
            self.test_list_warranties_technician_denied,
            self.test_get_warranty_by_project,
            self.test_list_service_requests,
            self.test_create_service_request_internal,
            self.test_create_service_request_google_form,
            self.test_assign_technician_to_service_request,
            self.test_update_service_request_stage,
            self.test_list_technicians,
            self.test_technician_role_permissions
        ]
        
        print(f"\n🛡️ Warranty & After-Service Module Tests")
        print("=" * 50)
        
        for test_func in test_functions:
            try:
                test_func()
            except Exception as e:
                print(f"❌ {test_func.__name__} failed with exception: {str(e)}")
                self.failed_tests.append({
                    "test": test_func.__name__,
                    "error": str(e)
                })
        
        # Print summary
        self.print_summary()

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("🏁 WARRANTY & SERVICE REQUEST TEST SUMMARY")
        print("="*60)
        print(f"📊 Total Tests: {self.tests_run}")
        print(f"✅ Passed: {self.tests_passed}")
        print(f"❌ Failed: {len(self.failed_tests)}")
        print(f"📈 Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS ({len(self.failed_tests)}):")
            print("-" * 40)
            for i, failure in enumerate(self.failed_tests, 1):
                print(f"{i}. {failure['test']}")
                if 'expected' in failure:
                    print(f"   Expected: {failure['expected']}, Got: {failure['actual']}")
                if 'error' in failure:
                    print(f"   Error: {failure['error']}")
                print()
        
        print("="*60)

if __name__ == "__main__":
    tester = WarrantyServiceTester()
    tester.run_all_tests()