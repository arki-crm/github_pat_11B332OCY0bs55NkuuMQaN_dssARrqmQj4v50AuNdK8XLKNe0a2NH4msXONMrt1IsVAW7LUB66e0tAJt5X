#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timezone, timedelta
import uuid

class NewFeaturesAPITester:
    def __init__(self, base_url="https://budget-master-627.preview.emergentagent.com"):
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

    def test_delivery_milestone_4_substages(self):
        """Test Delivery milestone 4-step workflow: dispatch_scheduled, installation_team_scheduled, materials_dispatched, delivery_confirmed"""
        # First get a project to test with
        success, projects_data = self.run_test("Get Projects for Delivery Test", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            
            # Test completing delivery sub-stages in order
            delivery_substages = [
                "dispatch_scheduled",
                "installation_team_scheduled", 
                "materials_dispatched",
                "delivery_confirmed"
            ]
            
            all_success = True
            for i, substage_id in enumerate(delivery_substages):
                success, response = self.run_test(f"Complete Delivery Sub-stage {i+1}: {substage_id}", "POST",
                                                f"api/projects/{project_id}/substage/complete", 200,
                                                data={"substage_id": substage_id},
                                                auth_token=self.admin_token)
                if not success:
                    all_success = False
                    break
                    
                # Verify response structure
                if success:
                    has_success = response.get('success') == True
                    has_substage_id = response.get('substage_id') == substage_id
                    has_group_name = response.get('group_name') == "Delivery"
                    print(f"   Sub-stage {substage_id}: Success={has_success}, ID={has_substage_id}, Group={has_group_name}")
                    
                    # Check if all 4 sub-stages complete the Delivery milestone
                    if i == 3:  # Last sub-stage
                        group_complete = response.get('group_complete', False)
                        print(f"   Delivery milestone auto-completed: {group_complete}")
                        all_success = all_success and group_complete
            
            return all_success, {}
        else:
            print("⚠️  No projects found for delivery milestone test")
            return False, {}

    def test_handover_milestone_8_substages(self):
        """Test Handover milestone 8-step workflow: final_inspection, cleaning, handover_docs, project_handover, csat, review_video_photos, issue_warranty_book, closed"""
        # First get a project to test with
        success, projects_data = self.run_test("Get Projects for Handover Test", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            
            # Test completing handover sub-stages in order
            handover_substages = [
                "final_inspection",
                "cleaning",
                "handover_docs",
                "project_handover",
                "csat",
                "review_video_photos",
                "issue_warranty_book",
                "closed"
            ]
            
            all_success = True
            for i, substage_id in enumerate(handover_substages):
                success, response = self.run_test(f"Complete Handover Sub-stage {i+1}: {substage_id}", "POST",
                                                f"api/projects/{project_id}/substage/complete", 200,
                                                data={"substage_id": substage_id},
                                                auth_token=self.admin_token)
                if not success:
                    all_success = False
                    break
                    
                # Verify response structure
                if success:
                    has_success = response.get('success') == True
                    has_substage_id = response.get('substage_id') == substage_id
                    has_group_name = response.get('group_name') == "Handover"
                    print(f"   Sub-stage {substage_id}: Success={has_success}, ID={has_substage_id}, Group={has_group_name}")
                    
                    # Check if all 8 sub-stages mark project as Completed
                    if i == 7:  # Last sub-stage (closed)
                        group_complete = response.get('group_complete', False)
                        print(f"   Project marked as Completed: {group_complete}")
                        all_success = all_success and group_complete
            
            return all_success, {}
        else:
            print("⚠️  No projects found for handover milestone test")
            return False, {}

    def test_project_hold_status_admin(self):
        """Test PUT /api/projects/{project_id}/hold-status with Admin permissions"""
        # First get a project to test with
        success, projects_data = self.run_test("Get Projects for Hold Status Test", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            
            # Test Hold action
            success1, hold_response = self.run_test("Hold Project (Admin)", "PUT",
                                                   f"api/projects/{project_id}/hold-status", 200,
                                                   data={"action": "Hold", "reason": "Testing hold functionality"},
                                                   auth_token=self.admin_token)
            
            # Test Activate action
            success2, activate_response = self.run_test("Activate Project (Admin)", "PUT",
                                                       f"api/projects/{project_id}/hold-status", 200,
                                                       data={"action": "Activate", "reason": "Testing activate functionality"},
                                                       auth_token=self.admin_token)
            
            # Test Deactivate action
            success3, deactivate_response = self.run_test("Deactivate Project (Admin)", "PUT",
                                                         f"api/projects/{project_id}/hold-status", 200,
                                                         data={"action": "Deactivate", "reason": "Testing deactivate functionality"},
                                                         auth_token=self.admin_token)
            
            return success1 and success2 and success3, {}
        else:
            print("⚠️  No projects found for hold status test")
            return False, {}

    def test_project_hold_status_designer_restricted(self):
        """Test Designer can only Hold projects, not Activate/Deactivate"""
        # First get a project to test with
        success, projects_data = self.run_test("Get Projects for Designer Hold Test", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            
            # Test Hold action (should work for Designer)
            success1, _ = self.run_test("Hold Project (Designer - Should Work)", "PUT",
                                      f"api/projects/{project_id}/hold-status", 200,
                                      data={"action": "Hold", "reason": "Designer testing hold"},
                                      auth_token=self.designer_token)
            
            # Test Activate action (should fail for Designer)
            success2, _ = self.run_test("Activate Project (Designer - Should Fail)", "PUT",
                                      f"api/projects/{project_id}/hold-status", 403,
                                      data={"action": "Activate", "reason": "Designer testing activate"},
                                      auth_token=self.designer_token)
            
            # Test Deactivate action (should fail for Designer)
            success3, _ = self.run_test("Deactivate Project (Designer - Should Fail)", "PUT",
                                      f"api/projects/{project_id}/hold-status", 403,
                                      data={"action": "Deactivate", "reason": "Designer testing deactivate"},
                                      auth_token=self.designer_token)
            
            return success1 and success2 and success3, {}
        else:
            print("⚠️  No projects found for designer hold status test")
            return False, {}

    def test_project_hold_status_validation(self):
        """Test hold status validation - empty reason should fail"""
        # First get a project to test with
        success, projects_data = self.run_test("Get Projects for Hold Validation Test", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            
            # Test with empty reason (should fail with 400)
            success1, _ = self.run_test("Hold Project with Empty Reason (Should Fail)", "PUT",
                                      f"api/projects/{project_id}/hold-status", 400,
                                      data={"action": "Hold", "reason": ""},
                                      auth_token=self.admin_token)
            
            # Test with missing reason (should fail with 400)
            success2, _ = self.run_test("Hold Project with Missing Reason (Should Fail)", "PUT",
                                      f"api/projects/{project_id}/hold-status", 400,
                                      data={"action": "Hold"},
                                      auth_token=self.admin_token)
            
            return success1 and success2, {}
        else:
            print("⚠️  No projects found for hold validation test")
            return False, {}

    def test_lead_hold_status_admin(self):
        """Test PUT /api/leads/{lead_id}/hold-status with Admin permissions"""
        # First get a lead to test with
        success, leads_data = self.run_test("Get Leads for Hold Status Test", "GET", "api/leads", 200,
                                          auth_token=self.admin_token)
        if success and leads_data and len(leads_data) > 0:
            lead_id = leads_data[0]['lead_id']
            
            # Test Hold action
            success1, _ = self.run_test("Hold Lead (Admin)", "PUT",
                                      f"api/leads/{lead_id}/hold-status", 200,
                                      data={"action": "Hold", "reason": "Testing lead hold functionality"},
                                      auth_token=self.admin_token)
            
            # Test Activate action
            success2, _ = self.run_test("Activate Lead (Admin)", "PUT",
                                      f"api/leads/{lead_id}/hold-status", 200,
                                      data={"action": "Activate", "reason": "Testing lead activate functionality"},
                                      auth_token=self.admin_token)
            
            # Test Deactivate action
            success3, _ = self.run_test("Deactivate Lead (Admin)", "PUT",
                                      f"api/leads/{lead_id}/hold-status", 200,
                                      data={"action": "Deactivate", "reason": "Testing lead deactivate functionality"},
                                      auth_token=self.admin_token)
            
            return success1 and success2 and success3, {}
        else:
            print("⚠️  No leads found for hold status test")
            return False, {}

    def test_milestone_progression_blocking_when_on_hold(self):
        """Test that milestone progression is blocked when project is on Hold"""
        # First get a project to test with
        success, projects_data = self.run_test("Get Projects for Hold Blocking Test", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            
            # Put project on Hold
            success1, _ = self.run_test("Hold Project for Blocking Test", "PUT",
                                      f"api/projects/{project_id}/hold-status", 200,
                                      data={"action": "Hold", "reason": "Testing milestone blocking"},
                                      auth_token=self.admin_token)
            
            if success1:
                # Try to complete a sub-stage (should fail with 400)
                success2, _ = self.run_test("Complete Sub-stage on Hold Project (Should Fail)", "POST",
                                          f"api/projects/{project_id}/substage/complete", 400,
                                          data={"substage_id": "site_measurement"},
                                          auth_token=self.admin_token)
                
                # Activate project again for cleanup
                self.run_test("Activate Project for Cleanup", "PUT",
                            f"api/projects/{project_id}/hold-status", 200,
                            data={"action": "Activate", "reason": "Cleanup after test"},
                            auth_token=self.admin_token)
                
                return success1 and success2, {}
            
            return success1, {}
        else:
            print("⚠️  No projects found for hold blocking test")
            return False, {}

    def test_activity_logging_for_hold_status(self):
        """Test that hold status changes create timeline entries"""
        # First get a project to test with
        success, projects_data = self.run_test("Get Projects for Activity Logging Test", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            
            # Hold project and check for activity logging
            success1, hold_response = self.run_test("Hold Project for Activity Test", "PUT",
                                                   f"api/projects/{project_id}/hold-status", 200,
                                                   data={"action": "Hold", "reason": "Testing activity logging"},
                                                   auth_token=self.admin_token)
            
            if success1:
                # Get project details to check for timeline/activity entries
                success2, project_data = self.run_test("Get Project After Hold for Activity Check", "GET",
                                                     f"api/projects/{project_id}", 200,
                                                     auth_token=self.admin_token)
                
                if success2:
                    # Check if comments or activity entries were created
                    comments = project_data.get('comments', [])
                    activity = project_data.get('activity', [])
                    
                    # Look for hold-related entries
                    hold_comment_found = any('Hold' in comment.get('message', '') for comment in comments)
                    hold_activity_found = any('Hold' in entry.get('message', '') for entry in activity)
                    
                    print(f"   Hold comment found: {hold_comment_found}")
                    print(f"   Hold activity found: {hold_activity_found}")
                    
                    activity_logged = hold_comment_found or hold_activity_found
                    return success1 and success2 and activity_logged, {}
                
                return success1 and success2, {}
            
            return success1, {}
        else:
            print("⚠️  No projects found for activity logging test")
            return False, {}

def main():
    print("🚀 Testing NEW FEATURES for Arkiflo CRM...")
    print("=" * 60)
    
    tester = NewFeaturesAPITester()
    
    # Setup test users first
    if not tester.setup_test_users():
        print("❌ Failed to setup test users. Exiting.")
        return 1
    
    # Seed some projects first
    tester.run_test("Seed Projects for Testing", "POST", "api/projects/seed", 200, auth_token=tester.admin_token)
    tester.run_test("Seed Leads for Testing", "POST", "api/leads/seed", 200, auth_token=tester.admin_token)
    
    print("\n🚀 Testing NEW FEATURES - Delivery, Handover & Hold System...")
    print("=" * 60)
    
    # Run new feature tests
    tester.test_delivery_milestone_4_substages()
    tester.test_handover_milestone_8_substages()
    tester.test_project_hold_status_admin()
    tester.test_project_hold_status_designer_restricted()
    tester.test_project_hold_status_validation()
    tester.test_lead_hold_status_admin()
    tester.test_milestone_progression_blocking_when_on_hold()
    tester.test_activity_logging_for_hold_status()
    
    # Print summary
    print(f"\n{'='*60}")
    print(f"🏁 NEW FEATURES TEST SUMMARY")
    print(f"{'='*60}")
    print(f"Total Tests: {tester.tests_run}")
    print(f"Passed: {tester.tests_passed}")
    print(f"Failed: {len(tester.failed_tests)}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%" if tester.tests_run > 0 else "0%")
    
    if tester.failed_tests:
        print(f"\n❌ FAILED TESTS:")
        for i, failure in enumerate(tester.failed_tests, 1):
            print(f"{i}. {failure['test']}")
            if 'expected' in failure:
                print(f"   Expected: {failure['expected']}, Got: {failure['actual']}")
            if 'error' in failure:
                print(f"   Error: {failure['error']}")
            if 'response' in failure:
                print(f"   Response: {failure['response'][:200]}...")
            print()
    
    print(f"{'='*60}")
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())