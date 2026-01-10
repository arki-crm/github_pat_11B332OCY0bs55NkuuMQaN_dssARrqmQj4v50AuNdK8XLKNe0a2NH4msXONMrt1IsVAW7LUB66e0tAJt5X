#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timezone, timedelta
import uuid

class ProductionMilestoneAPITester:
    def __init__(self, base_url="https://finance-tracker-1744.preview.emergentagent.com"):
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

    def test_production_milestone_structure(self):
        """Test that Production milestone has 11 sub-stages with correct structure"""
        # First get a project
        success, projects_data = self.run_test("Get Projects for Production Structure Test", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            success, substages_data = self.run_test("Get Project Sub-stages for Production Test", "GET", 
                                                   f"api/projects/{project_id}/substages", 200,
                                                   auth_token=self.admin_token)
            if success:
                group_progress = substages_data.get('group_progress', [])
                
                # Find Production group
                production_group = next((g for g in group_progress if g.get('id') == 'production'), None)
                
                if production_group:
                    substages = production_group.get('subStages', [])
                    has_11_substages = len(substages) == 11
                    
                    # Check for specific sub-stages
                    expected_substages = [
                        'vendor_mapping', 'factory_slot_allocation', 'jit_delivery_plan',
                        'non_modular_dependency', 'raw_material_procurement', 'production_kickstart',
                        'modular_production_complete', 'quality_check_inspection', 
                        'full_order_confirmation_45', 'piv_site_readiness', 'ready_for_dispatch'
                    ]
                    
                    found_substages = [s.get('id') for s in substages]
                    all_substages_present = all(substage in found_substages for substage in expected_substages)
                    
                    # Check for percentage-type sub-stage
                    non_modular = next((s for s in substages if s.get('id') == 'non_modular_dependency'), None)
                    has_percentage_type = non_modular and non_modular.get('type') == 'percentage'
                    
                    print(f"   Production group found: {production_group is not None}")
                    print(f"   Has 11 sub-stages: {has_11_substages} (found: {len(substages)})")
                    print(f"   All expected sub-stages present: {all_substages_present}")
                    print(f"   Non-modular dependency has percentage type: {has_percentage_type}")
                    
                    # Store project ID for further tests
                    self.test_production_project_id = project_id
                    
                    return (success and production_group is not None and has_11_substages and 
                           all_substages_present and has_percentage_type), substages_data
                else:
                    print("   Production group not found")
                    return False, substages_data
            return success, substages_data
        else:
            print("⚠️  No projects found for production structure test")
            return False, {}

    def test_complete_design_finalization_substages(self):
        """Test completing Design Finalization sub-stages to unlock Production"""
        if hasattr(self, 'test_production_project_id'):
            project_id = self.test_production_project_id
            
            # Complete all Design Finalization sub-stages
            design_substages = [
                'site_measurement', 'design_meeting_1', 'design_meeting_2', 'design_meeting_3',
                'final_design_presentation', 'material_selection', 'payment_collection_50',
                'production_drawing_prep', 'validation_internal', 'kws_signoff', 'kickoff_meeting'
            ]
            
            completed_count = 0
            for substage in design_substages:
                success, _ = self.run_test(f"Complete Design Sub-stage: {substage}", "POST", 
                                         f"api/projects/{project_id}/substage/complete", 200,
                                         data={"substage_id": substage},
                                         auth_token=self.admin_token)
                if success:
                    completed_count += 1
                else:
                    break
            
            all_design_completed = completed_count == len(design_substages)
            print(f"   Design Finalization sub-stages completed: {completed_count}/{len(design_substages)}")
            print(f"   All Design Finalization completed: {all_design_completed}")
            
            return all_design_completed, {}
        else:
            print("⚠️  No test project available for design completion")
            return False, {}

    def test_complete_production_substages_sequence(self):
        """Test completing first 3 Production sub-stages in sequence"""
        if hasattr(self, 'test_production_project_id'):
            project_id = self.test_production_project_id
            
            # Complete first 3 Production sub-stages
            production_substages = ['vendor_mapping', 'factory_slot_allocation', 'jit_delivery_plan']
            
            completed_count = 0
            for substage in production_substages:
                success, complete_response = self.run_test(f"Complete Production Sub-stage: {substage}", "POST", 
                                                         f"api/projects/{project_id}/substage/complete", 200,
                                                         data={"substage_id": substage},
                                                         auth_token=self.admin_token)
                if success:
                    completed_count += 1
                    completed_substages = complete_response.get('completed_substages', [])
                    print(f"   {substage} completed. Total completed: {len(completed_substages)}")
                else:
                    break
            
            all_production_prep_completed = completed_count == len(production_substages)
            print(f"   Production preparation sub-stages completed: {completed_count}/{len(production_substages)}")
            print(f"   Ready for percentage testing: {all_production_prep_completed}")
            
            return all_production_prep_completed, {}
        else:
            print("⚠️  No test project available for production sequence")
            return False, {}

    def test_percentage_endpoint_basic_functionality(self):
        """Test POST /api/projects/{project_id}/substage/percentage basic functionality"""
        if hasattr(self, 'test_production_project_id'):
            project_id = self.test_production_project_id
            
            # Test updating percentage to 30%
            success, percentage_response = self.run_test("Update Percentage to 30%", "POST", 
                                                       f"api/projects/{project_id}/substage/percentage", 200,
                                                       data={
                                                           "substage_id": "non_modular_dependency",
                                                           "percentage": 30,
                                                           "comment": "Initial progress update"
                                                       },
                                                       auth_token=self.admin_token)
            if success:
                # Verify response structure
                has_success = percentage_response.get('success') == True
                has_substage_id = percentage_response.get('substage_id') == 'non_modular_dependency'
                has_percentage = percentage_response.get('percentage') == 30
                has_auto_completed = 'auto_completed' in percentage_response
                has_percentage_substages = 'percentage_substages' in percentage_response
                
                auto_completed = percentage_response.get('auto_completed', True)  # Should be False at 30%
                percentage_substages = percentage_response.get('percentage_substages', {})
                
                print(f"   Success flag: {has_success}")
                print(f"   Substage ID correct: {has_substage_id}")
                print(f"   Percentage correct: {has_percentage}")
                print(f"   Has auto_completed field: {has_auto_completed}")
                print(f"   Has percentage_substages: {has_percentage_substages}")
                print(f"   Auto completed (should be False): {auto_completed}")
                print(f"   Percentage substages: {percentage_substages}")
                
                return (success and has_success and has_substage_id and has_percentage and 
                       has_auto_completed and has_percentage_substages and not auto_completed), percentage_response
            return success, percentage_response
        else:
            print("⚠️  No test project available for percentage basic test")
            return False, {}

    def test_percentage_endpoint_forward_only_validation(self):
        """Test percentage endpoint forward-only validation (cannot decrease)"""
        if hasattr(self, 'test_production_project_id'):
            project_id = self.test_production_project_id
            
            # First, add designer as collaborator to the project
            success_collab, _ = self.run_test("Add Designer as Collaborator for Forward-Only Test", "POST", 
                                            f"api/projects/{project_id}/collaborators", 200,
                                            data={"user_id": self.designer_user_id},
                                            auth_token=self.admin_token)
            
            if not success_collab:
                print("⚠️  Failed to add designer as collaborator, testing with admin")
                test_token = self.admin_token
                should_fail = False  # Admin can decrease percentage
            else:
                test_token = self.designer_token
                should_fail = True  # Designer cannot decrease percentage
            
            # First update to 60%
            success1, _ = self.run_test("Update Percentage to 60%", "POST", 
                                      f"api/projects/{project_id}/substage/percentage", 200,
                                      data={
                                          "substage_id": "non_modular_dependency",
                                          "percentage": 60,
                                          "comment": "Progress update to 60%"
                                      },
                                      auth_token=test_token)
            
            if success1:
                # Try to decrease to 40%
                expected_status = 400 if should_fail else 200
                success2, error_response = self.run_test("Try to Decrease Percentage to 40%", "POST", 
                                                       f"api/projects/{project_id}/substage/percentage", expected_status,
                                                       data={
                                                           "substage_id": "non_modular_dependency",
                                                           "percentage": 40,
                                                           "comment": "Trying to decrease"
                                                       },
                                                       auth_token=test_token)
                
                if should_fail and success2:
                    # Verify error message mentions forward-only
                    error_detail = error_response.get('detail', '')
                    mentions_forward_only = ('forward-only' in error_detail.lower() or 
                                           'cannot decrease' in error_detail.lower() or
                                           'decrease progress' in error_detail.lower())
                    
                    print(f"   60% update successful: {success1}")
                    print(f"   40% decrease properly rejected: {success2}")
                    print(f"   Error detail: {error_detail}")
                    print(f"   Mentions forward-only: {mentions_forward_only}")
                    
                    return success1 and success2 and mentions_forward_only, error_response
                elif not should_fail and success2:
                    print(f"   60% update successful: {success1}")
                    print(f"   40% decrease allowed for Admin: {success2}")
                    return success1 and success2, error_response
                else:
                    return success1 and success2, error_response
            return success1, {}
        else:
            print("⚠️  No test project available for forward-only validation test")
            return False, {}

    def test_percentage_endpoint_auto_completion(self):
        """Test percentage endpoint auto-completion at 100%"""
        if hasattr(self, 'test_production_project_id'):
            project_id = self.test_production_project_id
            
            # Update to 100% (should auto-complete)
            success, completion_response = self.run_test("Update Percentage to 100% (Auto-complete)", "POST", 
                                                       f"api/projects/{project_id}/substage/percentage", 200,
                                                       data={
                                                           "substage_id": "non_modular_dependency",
                                                           "percentage": 100,
                                                           "comment": "Final completion"
                                                       },
                                                       auth_token=self.admin_token)
            if success:
                # Verify auto-completion
                auto_completed = completion_response.get('auto_completed', False)
                completed_substages = completion_response.get('completed_substages', [])
                non_modular_completed = 'non_modular_dependency' in completed_substages
                
                print(f"   Auto completed flag: {auto_completed}")
                print(f"   Non-modular dependency in completed list: {non_modular_completed}")
                print(f"   Total completed substages: {len(completed_substages)}")
                
                # Verify next sub-stage is now available
                # Try to complete raw_material_procurement (should succeed now)
                success2, next_response = self.run_test("Complete Next Sub-stage After Auto-completion", "POST", 
                                                      f"api/projects/{project_id}/substage/complete", 200,
                                                      data={"substage_id": "raw_material_procurement"},
                                                      auth_token=self.admin_token)
                
                print(f"   Next sub-stage completion successful: {success2}")
                
                return (success and auto_completed and non_modular_completed and success2), completion_response
            return success, completion_response
        else:
            print("⚠️  No test project available for auto-completion test")
            return False, {}

    def test_percentage_endpoint_designer_forward_only_validation(self):
        """Test percentage endpoint forward-only validation specifically for Designer role"""
        # Create a new project for Designer test to avoid conflicts
        success_create, create_response = self.run_test("Create Project for Designer Forward-Only Test", "POST", 
                                                      "api/projects", 200,
                                                      data={
                                                          "project_name": "Designer Forward-Only Test Project",
                                                          "client_name": "Test Client",
                                                          "client_phone": "+1-555-0123",
                                                          "collaborators": [self.designer_user_id]
                                                      },
                                                      auth_token=self.admin_token)
        
        if success_create and 'project_id' in create_response:
            designer_project_id = create_response['project_id']
            
            # Complete design finalization and first 3 production stages for designer project
            all_substages = [
                'site_measurement', 'design_meeting_1', 'design_meeting_2', 'design_meeting_3',
                'final_design_presentation', 'material_selection', 'payment_collection_50',
                'production_drawing_prep', 'validation_internal', 'kws_signoff', 'kickoff_meeting',
                'vendor_mapping', 'factory_slot_allocation', 'jit_delivery_plan'
            ]
            
            for substage in all_substages:
                self.run_test(f"Complete {substage} for Designer Test", "POST", 
                            f"api/projects/{designer_project_id}/substage/complete", 200,
                            data={"substage_id": substage},
                            auth_token=self.admin_token)
            
            # Test Designer percentage access with forward-only validation
            # First update to 50% as Designer
            success1, _ = self.run_test("Designer: Update Percentage to 50%", "POST", 
                                      f"api/projects/{designer_project_id}/substage/percentage", 200,
                                      data={
                                          "substage_id": "non_modular_dependency",
                                          "percentage": 50,
                                          "comment": "Designer progress update to 50%"
                                      },
                                      auth_token=self.designer_token)
            
            if success1:
                # Try to decrease to 30% as Designer (should fail)
                success2, error_response = self.run_test("Designer: Try to Decrease to 30% (Should Fail)", "POST", 
                                                       f"api/projects/{designer_project_id}/substage/percentage", 400,
                                                       data={
                                                           "substage_id": "non_modular_dependency",
                                                           "percentage": 30,
                                                           "comment": "Designer trying to decrease"
                                                       },
                                                       auth_token=self.designer_token)
                
                if success2:
                    # Verify error message mentions forward-only
                    error_detail = error_response.get('detail', '')
                    mentions_forward_only = ('forward-only' in error_detail.lower() or 
                                           'cannot decrease' in error_detail.lower() or
                                           'decrease progress' in error_detail.lower())
                    
                    print(f"   Designer 50% update successful: {success1}")
                    print(f"   Designer 30% decrease properly rejected: {success2}")
                    print(f"   Error detail: {error_detail}")
                    print(f"   Mentions forward-only: {mentions_forward_only}")
                    
                    return success1 and success2 and mentions_forward_only, error_response
                return success1 and success2, error_response
            return success1, {}
        else:
            print("⚠️  Failed to create project for designer forward-only test")
            return False, {}

    def test_percentage_endpoint_validation(self):
        """Test percentage endpoint validation rules"""
        if hasattr(self, 'test_production_project_id'):
            project_id = self.test_production_project_id
            
            # Test 1: Missing substage_id (should fail)
            success1, _ = self.run_test("Validation: Missing substage_id (Should Fail)", "POST", 
                                      f"api/projects/{project_id}/substage/percentage", 400,
                                      data={"percentage": 50},
                                      auth_token=self.admin_token)
            
            # Test 2: Invalid percentage > 100 (should fail)
            success2, _ = self.run_test("Validation: Percentage > 100 (Should Fail)", "POST", 
                                      f"api/projects/{project_id}/substage/percentage", 400,
                                      data={
                                          "substage_id": "non_modular_dependency",
                                          "percentage": 150
                                      },
                                      auth_token=self.admin_token)
            
            # Test 3: Invalid percentage < 0 (should fail)
            success3, _ = self.run_test("Validation: Percentage < 0 (Should Fail)", "POST", 
                                      f"api/projects/{project_id}/substage/percentage", 400,
                                      data={
                                          "substage_id": "non_modular_dependency",
                                          "percentage": -10
                                      },
                                      auth_token=self.admin_token)
            
            print(f"   Missing substage_id validation: {success1}")
            print(f"   Percentage > 100 validation: {success2}")
            print(f"   Percentage < 0 validation: {success3}")
            
            return success1 and success2 and success3, {}
        else:
            print("⚠️  No test project available for validation test")
            return False, {}

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("🏁 PRODUCTION MILESTONE TEST SUMMARY")
        print("="*60)
        print(f"Total Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {len(self.failed_tests)}")
        
        if self.tests_run > 0:
            success_rate = (self.tests_passed / self.tests_run) * 100
            print(f"Success Rate: {success_rate:.1f}%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for i, failed in enumerate(self.failed_tests, 1):
                print(f"{i}. {failed['test']}")
                if 'expected' in failed and 'actual' in failed:
                    print(f"   Expected: {failed['expected']}, Got: {failed['actual']}")
                if 'response' in failed:
                    print(f"   Response: {failed['response']}")
                if 'error' in failed:
                    print(f"   Error: {failed['error']}")
        
        print("="*60)

def main():
    print("🚀 Starting Production Milestone + Percentage System Tests")
    print("=" * 60)
    
    tester = ProductionMilestoneAPITester()
    
    # Setup test users
    if not tester.setup_test_users():
        print("❌ Failed to setup test users, stopping tests")
        return 1

    try:
        # Seed projects first
        print("\n📋 Seeding projects...")
        tester.run_test("Seed Projects", "POST", "api/projects/seed", 200, auth_token=tester.admin_token)
        
        # Run Production milestone tests
        print("\n🏭 Testing Production Milestone + Percentage System...")
        
        tester.test_production_milestone_structure()
        tester.test_complete_design_finalization_substages()
        tester.test_complete_production_substages_sequence()
        tester.test_percentage_endpoint_basic_functionality()
        tester.test_percentage_endpoint_forward_only_validation()
        tester.test_percentage_endpoint_designer_forward_only_validation()
        tester.test_percentage_endpoint_auto_completion()
        tester.test_percentage_endpoint_validation()
        
    except Exception as e:
        print(f"❌ Test execution error: {str(e)}")
        return 1

    # Print results
    tester.print_summary()
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())