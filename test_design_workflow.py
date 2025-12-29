#!/usr/bin/env python3

import sys
import os
sys.path.append('/app')

from backend_test import ArkifloAPITester

def main():
    """Run Design Workflow Role-Based Access Control Tests"""
    print("🎯 Running Design Workflow Role-Based Access Control Tests...")
    
    tester = ArkifloAPITester()
    success = tester.run_design_workflow_tests()
    
    if success:
        print("\n✅ All Design Workflow tests passed!")
        return 0
    else:
        print("\n❌ Some Design Workflow tests failed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())