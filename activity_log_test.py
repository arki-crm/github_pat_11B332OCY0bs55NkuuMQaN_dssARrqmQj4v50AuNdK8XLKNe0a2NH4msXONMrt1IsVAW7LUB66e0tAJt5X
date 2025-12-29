#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timezone, timedelta
import uuid

class ActivityLogTester:
    def __init__(self, base_url="https://design-workflow-10.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
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

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
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

    def setup_admin_token(self):
        """Create admin user and session directly in MongoDB"""
        print("\n🔧 Setting up admin user...")
        
        admin_user_id = f"test-admin-{uuid.uuid4().hex[:8]}"
        admin_session_token = f"test_admin_session_{uuid.uuid4().hex[:16]}"
        
        mongo_commands = f'''
use('test_database');

db.users.insertOne({{
  user_id: "{admin_user_id}",
  email: "admin.test.{datetime.now().strftime('%Y%m%d%H%M%S')}@example.com",
  name: "Test Admin",
  picture: "https://via.placeholder.com/150",
  role: "Admin",
  created_at: new Date()
}});

db.user_sessions.insertOne({{
  user_id: "{admin_user_id}",
  session_token: "{admin_session_token}",
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});

print("Admin session token: {admin_session_token}");
'''
        
        try:
            import subprocess
            result = subprocess.run(['mongosh', '--eval', mongo_commands], 
                                  capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                print("✅ Admin user created successfully")
                self.admin_token = admin_session_token
                return True
            else:
                print(f"❌ Failed to create admin user: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"❌ Error setting up admin user: {str(e)}")
            return False

    def test_percentage_activity_logging(self):
        """Test that percentage updates create proper activity log entries"""
        # Get a project
        success, projects_data = self.run_test("Get Projects for Activity Log Test", "GET", "api/projects", 200,
                                              auth_token=self.admin_token)
        if success and projects_data and len(projects_data) > 0:
            project_id = projects_data[0]['project_id']
            
            # Get project details to check current comments
            success, project_data = self.run_test("Get Project Details Before Percentage Update", "GET", 
                                                 f"api/projects/{project_id}", 200,
                                                 auth_token=self.admin_token)
            if success:
                initial_comments = project_data.get('comments', [])
                initial_comment_count = len(initial_comments)
                
                print(f"   Initial comment count: {initial_comment_count}")
                
                # Update percentage to trigger activity log
                success, percentage_response = self.run_test("Update Percentage to Create Activity Log", "POST", 
                                                           f"api/projects/{project_id}/substage/percentage", 200,
                                                           data={
                                                               "substage_id": "non_modular_dependency",
                                                               "percentage": 25,
                                                               "comment": "Testing activity logging"
                                                           },
                                                           auth_token=self.admin_token)
                
                if success:
                    # Get project details again to check new comments
                    success2, updated_project_data = self.run_test("Get Project Details After Percentage Update", "GET", 
                                                                 f"api/projects/{project_id}", 200,
                                                                 auth_token=self.admin_token)
                    if success2:
                        updated_comments = updated_project_data.get('comments', [])
                        new_comment_count = len(updated_comments)
                        
                        print(f"   Updated comment count: {new_comment_count}")
                        print(f"   New comments added: {new_comment_count - initial_comment_count}")
                        
                        # Look for percentage-related activity logs
                        percentage_comments = [c for c in updated_comments if c.get('is_system', False) and 
                                             ('📊' in c.get('message', '') or 
                                              'Non-Modular Dependency Works' in c.get('message', '') or
                                              'progress updated' in c.get('message', '').lower())]
                        
                        print(f"   Percentage-related comments found: {len(percentage_comments)}")
                        
                        if percentage_comments:
                            latest_comment = percentage_comments[-1]  # Get the most recent
                            print(f"   Latest percentage comment: {latest_comment.get('message', '')}")
                            print(f"   Comment metadata: {latest_comment.get('metadata', {})}")
                            
                            # Check if comment contains expected elements
                            message = latest_comment.get('message', '')
                            has_emoji = '📊' in message
                            has_substage_name = 'Non-Modular Dependency Works' in message
                            has_percentage = '25%' in message
                            has_progress_text = 'progress updated' in message.lower()
                            has_custom_comment = 'Testing activity logging' in message
                            
                            print(f"   Has emoji (📊): {has_emoji}")
                            print(f"   Has substage name: {has_substage_name}")
                            print(f"   Has percentage (25%): {has_percentage}")
                            print(f"   Has progress text: {has_progress_text}")
                            print(f"   Has custom comment: {has_custom_comment}")
                            
                            return (success and success2 and len(percentage_comments) > 0 and 
                                   has_emoji and has_substage_name and has_percentage and 
                                   has_progress_text and has_custom_comment), updated_project_data
                        else:
                            print("   No percentage-related comments found")
                            return False, updated_project_data
                    return success2, {}
                return success, percentage_response
            return success, project_data
        else:
            print("⚠️  No projects found for activity log test")
            return False, {}

def main():
    print("🚀 Testing Production Milestone Activity Logging")
    print("=" * 50)
    
    tester = ActivityLogTester()
    
    # Setup admin user
    if not tester.setup_admin_token():
        print("❌ Failed to setup admin user, stopping tests")
        return 1

    try:
        # Test activity logging
        tester.test_percentage_activity_logging()
        
    except Exception as e:
        print(f"❌ Test execution error: {str(e)}")
        return 1

    # Print results
    print(f"\n🏁 Tests Run: {tester.tests_run}, Passed: {tester.tests_passed}, Failed: {len(tester.failed_tests)}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())