#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timezone, timedelta
import uuid

class SubStageProgressionTester:
    def __init__(self, base_url="https://crm-visual.preview.emergentagent.com"):
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
        
        # MongoDB commands to create test data
        mongo_commands = f'''
use('test_database');

// Create admin user
db.users.insertOne({{
  user_id: "{admin_user_id}",
  email: "admin.substage.test.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
  name: "Test Admin SubStage",
  picture: "https://via.placeholder.com/150",
  role: "Admin",
  created_at: new Date()
}});

// Create designer user
db.users.insertOne({{
  user_id: "{designer_user_id}",
  email: "designer.substage.test.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
  name: "Test Designer SubStage", 
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

// Create a test project for sub-stage testing
db.projects.insertOne({{
  project_id: "proj_substage_test",
  project_name: "Sub-Stage Test Project",
  client_name: "Test Client",
  client_phone: "+1234567890",
  stage: "Design Finalization",
  collaborators: [],
  comments: [],
  timeline: [],
  files: [],
  notes: [],
  created_by: "{admin_user_id}",
  created_at: new Date(),
  updated_at: new Date(),
  completed_substages: []
}});

print("Admin session token: {admin_session_token}");
print("Designer session token: {designer_session_token}");
print("Admin user ID: {admin_user_id}");
print("Designer user ID: {designer_user_id}");
print("Test project created: proj_substage_test");
'''
        
        try:
            import subprocess
            result = subprocess.run(['mongosh', '--eval', mongo_commands], 
                                  capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                print("✅ Test users, sessions, and project created successfully")
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

    def test_get_project_substages(self):
        """Test GET /api/projects/{project_id}/substages returns sub-stage progress"""
        # First get a project
        success, projects_data = self.run_test("Get Projects for Sub-stages Test", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            success, substages_data = self.run_test("Get Project Sub-stages", "GET", 
                                                   f"api/projects/{project_id}/substages", 200,
                                                   auth_token=self.admin_token)
            if success:
                # Verify response structure
                has_completed_substages = 'completed_substages' in substages_data
                has_group_progress = 'group_progress' in substages_data
                
                completed_substages = substages_data.get('completed_substages', [])
                group_progress = substages_data.get('group_progress', [])
                
                is_completed_array = isinstance(completed_substages, list)
                is_group_array = isinstance(group_progress, list)
                
                print(f"   Has completed_substages: {has_completed_substages}")
                print(f"   Has group_progress: {has_group_progress}")
                print(f"   Completed substages is array: {is_completed_array}")
                print(f"   Group progress is array: {is_group_array}")
                print(f"   Completed substages count: {len(completed_substages)}")
                print(f"   Group progress count: {len(group_progress)}")
                
                # Store project ID for completion tests
                self.test_substage_project_id = project_id
                
                return (success and has_completed_substages and has_group_progress and 
                       is_completed_array and is_group_array), substages_data
            return success, substages_data
        else:
            print("⚠️  No projects found for sub-stages test")
            return False, {}

    def test_complete_first_substage(self):
        """Test POST /api/projects/{project_id}/substage/complete - Complete first sub-stage (site_measurement)"""
        if hasattr(self, 'test_substage_project_id'):
            project_id = self.test_substage_project_id
            
            # Complete the first sub-stage (site_measurement)
            success, complete_response = self.run_test("Complete First Sub-stage (site_measurement)", "POST", 
                                                     f"api/projects/{project_id}/substage/complete", 200,
                                                     data={"substage_id": "site_measurement"},
                                                     auth_token=self.admin_token)
            if success:
                # Verify response structure
                has_completed_substages = 'completed_substages' in complete_response
                has_group_complete = 'group_complete' in complete_response
                has_current_stage = 'current_stage' in complete_response
                
                completed_substages = complete_response.get('completed_substages', [])
                group_complete = complete_response.get('group_complete', False)
                current_stage = complete_response.get('current_stage', '')
                
                # Verify site_measurement is in completed list
                site_measurement_completed = 'site_measurement' in completed_substages
                
                print(f"   Has completed_substages: {has_completed_substages}")
                print(f"   Has group_complete: {has_group_complete}")
                print(f"   Has current_stage: {has_current_stage}")
                print(f"   Site measurement completed: {site_measurement_completed}")
                print(f"   Completed substages: {completed_substages}")
                print(f"   Group complete: {group_complete}")
                print(f"   Current stage: {current_stage}")
                
                return (success and has_completed_substages and has_group_complete and 
                       has_current_stage and site_measurement_completed), complete_response
            return success, complete_response
        else:
            print("⚠️  No test project available for sub-stage completion")
            return False, {}

    def test_skip_substage_validation(self):
        """Test POST /api/projects/{project_id}/substage/complete - Cannot skip sub-stages (forward-only validation)"""
        if hasattr(self, 'test_substage_project_id'):
            project_id = self.test_substage_project_id
            
            # Try to complete design_meeting_2 without completing design_meeting_1 first (should fail)
            success, error_response = self.run_test("Skip Sub-stage Validation (Should Fail)", "POST", 
                                                   f"api/projects/{project_id}/substage/complete", 400,
                                                   data={"substage_id": "design_meeting_2"},
                                                   auth_token=self.admin_token)
            if success:
                # Verify error message mentions forward-only requirement
                error_detail = error_response.get('detail', '')
                mentions_previous = 'design_meeting_1' in error_detail or 'previous' in error_detail.lower() or 'first' in error_detail.lower()
                
                print(f"   Error detail: {error_detail}")
                print(f"   Mentions previous requirement: {mentions_previous}")
                
                return success and mentions_previous, error_response
            return success, error_response
        else:
            print("⚠️  No test project available for skip validation test")
            return False, {}

    def test_complete_next_substage(self):
        """Test POST /api/projects/{project_id}/substage/complete - Complete next sub-stage (design_meeting_1)"""
        if hasattr(self, 'test_substage_project_id'):
            project_id = self.test_substage_project_id
            
            # Complete design_meeting_1 (should succeed after site_measurement)
            success, complete_response = self.run_test("Complete Next Sub-stage (design_meeting_1)", "POST", 
                                                     f"api/projects/{project_id}/substage/complete", 200,
                                                     data={"substage_id": "design_meeting_1"},
                                                     auth_token=self.admin_token)
            if success:
                # Verify response structure
                completed_substages = complete_response.get('completed_substages', [])
                
                # Verify both site_measurement and design_meeting_1 are completed
                site_measurement_completed = 'site_measurement' in completed_substages
                design_meeting_1_completed = 'design_meeting_1' in completed_substages
                
                print(f"   Site measurement still completed: {site_measurement_completed}")
                print(f"   Design meeting 1 completed: {design_meeting_1_completed}")
                print(f"   Total completed substages: {len(completed_substages)}")
                print(f"   Completed substages: {completed_substages}")
                
                return (success and site_measurement_completed and design_meeting_1_completed), complete_response
            return success, complete_response
        else:
            print("⚠️  No test project available for next sub-stage completion")
            return False, {}

    def test_complete_already_completed_substage(self):
        """Test POST /api/projects/{project_id}/substage/complete - Cannot complete already completed sub-stage"""
        if hasattr(self, 'test_substage_project_id'):
            project_id = self.test_substage_project_id
            
            # Try to complete site_measurement again (should fail)
            success, error_response = self.run_test("Complete Already Completed Sub-stage (Should Fail)", "POST", 
                                                   f"api/projects/{project_id}/substage/complete", 400,
                                                   data={"substage_id": "site_measurement"},
                                                   auth_token=self.admin_token)
            if success:
                # Verify error message mentions already completed
                error_detail = error_response.get('detail', '')
                mentions_already_completed = 'already' in error_detail.lower() or 'completed' in error_detail.lower()
                
                print(f"   Error detail: {error_detail}")
                print(f"   Mentions already completed: {mentions_already_completed}")
                
                return success and mentions_already_completed, error_response
            return success, error_response
        else:
            print("⚠️  No test project available for already completed test")
            return False, {}

    def test_complete_invalid_substage(self):
        """Test POST /api/projects/{project_id}/substage/complete - Invalid sub-stage ID"""
        if hasattr(self, 'test_substage_project_id'):
            project_id = self.test_substage_project_id
            
            # Try to complete invalid sub-stage ID (should fail)
            success, error_response = self.run_test("Complete Invalid Sub-stage (Should Fail)", "POST", 
                                                   f"api/projects/{project_id}/substage/complete", 400,
                                                   data={"substage_id": "invalid_substage_id"},
                                                   auth_token=self.admin_token)
            if success:
                # Verify error message mentions invalid ID
                error_detail = error_response.get('detail', '')
                mentions_invalid = 'invalid' in error_detail.lower() or 'not found' in error_detail.lower()
                
                print(f"   Error detail: {error_detail}")
                print(f"   Mentions invalid ID: {mentions_invalid}")
                
                return success and mentions_invalid, error_response
            return success, error_response
        else:
            print("⚠️  No test project available for invalid sub-stage test")
            return False, {}

    def test_substage_activity_log(self):
        """Test that sub-stage completion creates activity log entries"""
        if hasattr(self, 'test_substage_project_id'):
            project_id = self.test_substage_project_id
            
            # Get project details to check activity/comments
            success, project_data = self.run_test("Get Project for Activity Log Check", "GET", 
                                                 f"api/projects/{project_id}", 200,
                                                 auth_token=self.admin_token)
            if success:
                comments = project_data.get('comments', [])
                
                # Look for system comments related to sub-stage completion
                substage_comments = [c for c in comments if c.get('is_system', False) and 
                                   ('sub-stage' in c.get('message', '').lower() or 
                                    'site_measurement' in c.get('message', '').lower() or
                                    'design_meeting_1' in c.get('message', '').lower())]
                
                has_substage_activity = len(substage_comments) > 0
                
                print(f"   Total comments: {len(comments)}")
                print(f"   Sub-stage related comments: {len(substage_comments)}")
                print(f"   Has sub-stage activity: {has_substage_activity}")
                
                if substage_comments:
                    for comment in substage_comments[:2]:  # Show first 2
                        print(f"   Activity: {comment.get('message', '')}")
                
                return success and has_substage_activity, project_data
            return success, project_data
        else:
            print("⚠️  No test project available for activity log check")
            return False, {}

    def test_designer_substage_access(self):
        """Test Designer can complete sub-stages for assigned projects"""
        if hasattr(self, 'test_substage_project_id'):
            project_id = self.test_substage_project_id
            
            # First ensure designer is a collaborator on the project
            success, _ = self.run_test("Add Designer as Collaborator for Sub-stage Test", "POST", 
                                     f"api/projects/{project_id}/collaborators", 200,
                                     data={"user_id": self.designer_user_id},
                                     auth_token=self.admin_token)
            
            if success:
                # Try to complete next sub-stage as designer
                success2, complete_response = self.run_test("Complete Sub-stage as Designer", "POST", 
                                                          f"api/projects/{project_id}/substage/complete", 200,
                                                          data={"substage_id": "design_meeting_2"},
                                                          auth_token=self.designer_token)
                if success2:
                    completed_substages = complete_response.get('completed_substages', [])
                    design_meeting_2_completed = 'design_meeting_2' in completed_substages
                    
                    print(f"   Designer completed sub-stage: {design_meeting_2_completed}")
                    print(f"   Total completed: {len(completed_substages)}")
                    
                    return success2 and design_meeting_2_completed, complete_response
                return success2, complete_response
            return success, {}
        else:
            print("⚠️  No test project available for designer access test")
            return False, {}

    def test_presales_substage_access_denied(self):
        """Test PreSales cannot access sub-stage endpoints"""
        if hasattr(self, 'test_substage_project_id'):
            project_id = self.test_substage_project_id
            
            # Create PreSales user for testing
            presales_user_id = f"test-presales-substage-{uuid.uuid4().hex[:8]}"
            presales_session_token = f"test_presales_substage_session_{uuid.uuid4().hex[:16]}"
            
            mongo_commands = f'''
use('test_database');
db.users.insertOne({{
  user_id: "{presales_user_id}",
  email: "presales.substage.test.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
  name: "Test PreSales SubStage",
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
                    # Test sub-stage access with PreSales token (should be denied)
                    success1, _ = self.run_test("PreSales Get Sub-stages (Should Fail)", "GET", 
                                              f"api/projects/{project_id}/substages", 403,
                                              auth_token=presales_session_token)
                    
                    success2, _ = self.run_test("PreSales Complete Sub-stage (Should Fail)", "POST", 
                                              f"api/projects/{project_id}/substage/complete", 403,
                                              data={"substage_id": "design_meeting_3"},
                                              auth_token=presales_session_token)
                    
                    return success1 and success2, {}
                else:
                    print(f"❌ Failed to create PreSales user: {result.stderr}")
                    return False, {}
                    
            except Exception as e:
                print(f"❌ Error testing PreSales sub-stage access: {str(e)}")
                return False, {}
        else:
            print("⚠️  No test project available for PreSales access test")
            return False, {}

    def run_all_tests(self):
        """Run all sub-stage progression tests"""
        print("🚀 Starting Sub-Stage Progression System Tests")
        print("=" * 60)
        
        # Setup test users
        if not self.setup_test_users():
            print("❌ Failed to setup test users. Exiting.")
            return
        
        # Test categories
        tests = [
            self.test_get_project_substages,
            self.test_complete_first_substage,
            self.test_skip_substage_validation,
            self.test_complete_next_substage,
            self.test_complete_already_completed_substage,
            self.test_complete_invalid_substage,
            self.test_substage_activity_log,
            self.test_designer_substage_access,
            self.test_presales_substage_access_denied
        ]
        
        print(f"\n🔄 Running {len(tests)} Sub-Stage Progression Tests...")
        
        for test in tests:
            try:
                test()
            except Exception as e:
                print(f"❌ Test {test.__name__} failed with error: {str(e)}")
                self.failed_tests.append({
                    "test": test.__name__,
                    "error": str(e)
                })
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {len(self.failed_tests)}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for i, failure in enumerate(self.failed_tests, 1):
                print(f"{i}. {failure['test']}")
                if 'error' in failure:
                    print(f"   Error: {failure['error']}")
                else:
                    print(f"   Expected: {failure['expected']}, Got: {failure['actual']}")
                    print(f"   Response: {failure['response'][:100]}...")
        
        return self.tests_passed == self.tests_run

def main():
    tester = SubStageProgressionTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())