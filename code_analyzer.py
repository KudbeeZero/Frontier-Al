#!/usr/bin/env python3
"""
CODE STRUCTURE ANALYZER & DEBUGGER
Analyzes Python project structure, identifies files, explains purposes, and recommends fixes.
"""

import os
import ast
import json
from pathlib import Path
from typing import Dict, List, Tuple

class CodeAnalyzer:
    def __init__(self, root_path: str):
        self.root_path = Path(root_path)
        self.files_analysis = []
        self.issues_found = []
        
    def get_python_files(self) -> List[Path]:
        """Get all Python files in the project."""
        return list(self.root_path.rglob("*.py"))
    
    def get_file_size(self, filepath: Path) -> str:
        """Get human-readable file size."""
        size = filepath.stat().st_size
        for unit in ['B', 'KB', 'MB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} GB"
    
    def analyze_file(self, filepath: Path) -> Dict:
        """Analyze a single Python file."""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            analysis = {
                "name": filepath.name,
                "path": str(filepath.relative_to(self.root_path)),
                "size": self.get_file_size(filepath),
                "lines": len(content.splitlines()),
                "functions": [],
                "classes": [],
                "imports": [],
                "issues": [],
                "purpose": self._detect_purpose(filepath.name, content),
            }
            
            # Parse AST
            try:
                tree = ast.parse(content)
                
                for node in ast.walk(tree):
                    if isinstance(node, ast.FunctionDef):
                        analysis["functions"].append(node.name)
                    elif isinstance(node, ast.ClassDef):
                        analysis["classes"].append(node.name)
                    elif isinstance(node, ast.Import):
                        for alias in node.names:
                            analysis["imports"].append(alias.name)
                    elif isinstance(node, ast.ImportFrom):
                        if node.module:
                            analysis["imports"].append(node.module)
            except SyntaxError as e:
                analysis["issues"].append(f"❌ Syntax Error: {e.msg} (Line {e.lineno})")
            
            # Check for common issues
            analysis["issues"].extend(self._check_common_issues(content, filepath.name))
            
            return analysis
            
        except Exception as e:
            return {
                "name": filepath.name,
                "path": str(filepath.relative_to(self.root_path)),
                "error": str(e),
                "issues": [f"❌ Error reading file: {e}"]
            }
    
    def _detect_purpose(self, filename: str, content: str) -> str:
        """Detect the purpose of a file based on name and content."""
        filename_lower = filename.lower()
        
        if "main" in filename_lower or filename_lower == "__main__.py":
            return "Entry point / Main application"
        elif "config" in filename_lower:
            return "Configuration settings"
        elif "test" in filename_lower or "test_" in filename_lower:
            return "Unit tests"
        elif "util" in filename_lower or "helper" in filename_lower:
            return "Utility / Helper functions"
        elif "model" in filename_lower or "ai" in filename_lower:
            return "AI/ML Model"
        elif "api" in filename_lower or "server" in filename_lower:
            return "API / Server"
        elif "db" in filename_lower or "data" in filename_lower:
            return "Database / Data handling"
        elif "__init__" in filename_lower:
            return "Package initialization"
        else:
            # Try to infer from content
            if "class" in content and "def __init__" in content:
                return "Class definitions"
            elif "def " in content:
                return "Functions / Utilities"
            else:
                return "General module"
    
    def _check_common_issues(self, content: str, filename: str) -> List[str]:
        """Check for common Python issues."""
        issues = []
        lines = content.splitlines()
        
        # Check for TODO/FIXME comments
        for i, line in enumerate(lines, 1):
            if "TODO" in line or "FIXME" in line:
                issues.append(f"⚠️  TODO/FIXME found at line {i}: {line.strip()[:60]}")
        
        # Check for bare except
        if "except:" in content and "except Exception" not in content:
            issues.append("⚠️  Bare 'except:' clause found - should catch specific exceptions")
        
        # Check for print debugging
        debug_prints = sum(1 for line in lines if "print(" in line and "logger" not in line.lower())
        if debug_prints > 5:
            issues.append(f"⚠️  Found {debug_prints} print statements - consider using logging instead")
        
        # Check for hardcoded paths
        if ("/" in content or "\\" in content) and any(x in content for x in ["C:\\", "/home/", "/Users/"]):
            issues.append("⚠️  Hardcoded file paths detected - should use os.path or pathlib")
        
        # Check for unused imports (basic check)
        if "import" in content:
            issues.append("ℹ️  Review imports for unused modules")
        
        return issues
    
    def generate_report(self) -> str:
        """Generate a comprehensive analysis report."""
        python_files = self.get_python_files()
        
        if not python_files:
            return "❌ No Python files found in the project!"
        
        report = []
        report.append("=" * 80)
        report.append("📊 CODE STRUCTURE ANALYSIS REPORT")
        report.append("=" * 80)
        report.append(f"\n📁 Project: {self.root_path.name}")
        report.append(f"📈 Total Python Files: {len(python_files)}\n")
        
        # Analyze each file
        all_analyses = []
        for filepath in sorted(python_files):
            analysis = self.analyze_file(filepath)
            all_analyses.append(analysis)
        
        # Generate file summaries
        report.append("=" * 80)
        report.append("📄 FILE BREAKDOWN")
        report.append("=" * 80)
        
        for analysis in all_analyses:
            report.append(f"\n📌 {analysis['path']}")
            report.append(f"   Purpose: {analysis['purpose']}")
            report.append(f"   Size: {analysis['size']} | Lines: {analysis.get('lines', 'N/A')}")
            
            if analysis.get('classes'):
                report.append(f"   Classes: {', '.join(analysis['classes'])}")
            if analysis.get('functions'):
                report.append(f"   Functions: {', '.join(analysis['functions'][:5])}" + 
                            (f" +{len(analysis['functions']) - 5} more" if len(analysis['functions']) > 5 else ""))
            if analysis.get('imports'):
                deps = list(set(analysis['imports']))[:5]
                report.append(f"   Dependencies: {', '.join(deps)}")
        
        # Issues and recommendations
        report.append("\n" + "=" * 80)
        report.append("🐛 ISSUES & RECOMMENDATIONS")
        report.append("=" * 80)
        
        has_issues = False
        for analysis in all_analyses:
            if analysis.get('issues'):
                has_issues = True
                report.append(f"\n{analysis['path']}:")
                for issue in analysis['issues']:
                    report.append(f"  {issue}")
        
        if not has_issues:
            report.append("\n✅ No major issues detected!")
        
        # Summary and next steps
        report.append("\n" + "=" * 80)
        report.append("💡 NEXT STEPS")
        report.append("=" * 80)
        report.append("""
1. Review each file's purpose above
2. Check for any ⚠️  warnings and 🐛 issues
3. Look for circular imports or unused code
4. Add type hints for better code quality
5. Consider adding unit tests
6. Document complex functions with docstrings
        """)
        
        return "\n".join(report)

if __name__ == "__main__":
    import sys
    
    # Get project path from command line or use current directory
    project_path = sys.argv[1] if len(sys.argv) > 1 else "."
    
    if not os.path.exists(project_path):
        print(f"❌ Path not found: {project_path}")
        sys.exit(1)
    
    analyzer = CodeAnalyzer(project_path)
    report = analyzer.generate_report()
    print(report)
    
    # Optionally save report to file
    output_file = os.path.join(project_path, "CODE_ANALYSIS_REPORT.txt")
    with open(output_file, 'w') as f:
        f.write(report)
    print(f"\n📄 Report saved to: {output_file}")
