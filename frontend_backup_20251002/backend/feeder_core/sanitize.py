"""
Sanitization logic for NC programs.

Provides functionality to validate and clean NC files before sending to CNC machines.
"""

import re
from dataclasses import dataclass, field
from typing import List, Dict, Any


@dataclass
class SanitizeChange:
    """Represents a single change made during sanitization."""
    line_number: int  # 0-based line index
    before: str
    after: str
    reason: str = ""


@dataclass
class SanitizeResult:
    """Result of sanitization process."""
    changes: List[SanitizeChange] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    
    @property
    def has_changes(self) -> bool:
        """Check if any changes were made."""
        return len(self.changes) > 0
    
    @property
    def has_issues(self) -> bool:
        """Check if there are warnings or errors."""
        return len(self.warnings) > 0 or len(self.errors) > 0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "changes": [
                {
                    "line_number": c.line_number,
                    "before": c.before,
                    "after": c.after,
                    "reason": c.reason
                }
                for c in self.changes
            ],
            "warnings": self.warnings,
            "errors": self.errors,
            "has_changes": self.has_changes,
            "has_issues": self.has_issues
        }
    
    def as_html(self) -> str:
        """Generate HTML preview of changes."""
        if not self.changes:
            return "<p>No changes needed.</p>"
        
        style = """
        <style>
            .sanitize-preview { font-family: monospace; }
            .change { margin: 8px 0; padding: 8px; background: #1f1f1f; border-radius: 6px; }
            .line-before { color: #e57373; }
            .line-after { color: #81c784; }
            .line-number { color: #9e9e9e; font-weight: bold; }
            .reason { color: #ffb74d; font-style: italic; font-size: 0.9em; }
        </style>
        """
        
        parts = [style, '<div class="sanitize-preview">']
        
        for change in self.changes:
            parts.append(f'<div class="change">')
            parts.append(f'<div class="line-number">Line {change.line_number + 1}:</div>')
            if change.reason:
                parts.append(f'<div class="reason">{change.reason}</div>')
            parts.append(f'<div class="line-before">- {change.before}</div>')
            parts.append(f'<div class="line-after">+ {change.after}</div>')
            parts.append('</div>')
        
        parts.append('</div>')
        return '\n'.join(parts)


# Regular expressions for Heidenhain program structure
BEGIN_RE = re.compile(r"^(\s*\d*\s*)BEGIN\s+PGM\s+(\S+)(.*)$", re.IGNORECASE)
END_RE = re.compile(r"^(\s*\d*\s*)END\s+PGM\s+(\S+)(.*)$", re.IGNORECASE)

# Control characters to strip (except CR, LF, TAB)
CONTROL_CHARS_RE = re.compile(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')


def sanitize_program_preview(text: str, rules: Dict[str, Any] = None) -> SanitizeResult:
    """
    Preview sanitization changes for an NC program.
    
    Args:
        text: The program text to sanitize
        rules: Optional sanitization rules (future extensibility)
        
    Returns:
        SanitizeResult with proposed changes and issues
    """
    lines = text.splitlines()
    result = SanitizeResult()
    begin_name = None
    
    for i, line in enumerate(lines):
        original_line = line
        
        # Check for control characters
        if CONTROL_CHARS_RE.search(line):
            clean_line = CONTROL_CHARS_RE.sub('', line)
            if clean_line != line:
                result.changes.append(SanitizeChange(
                    line_number=i,
                    before=line,
                    after=clean_line,
                    reason="Removed control characters"
                ))
                line = clean_line
        
        # Handle BEGIN PGM statements
        begin_match = BEGIN_RE.match(line)
        if begin_match:
            prefix, name, suffix = begin_match.groups()
            normalized_name = name.upper()
            normalized_line = f"{prefix}BEGIN PGM {normalized_name}{suffix}"
            
            if normalized_line != original_line:
                result.changes.append(SanitizeChange(
                    line_number=i,
                    before=original_line,
                    after=normalized_line,
                    reason="Normalized BEGIN PGM statement"
                ))
            
            begin_name = normalized_name
            continue
        
        # Handle END PGM statements
        end_match = END_RE.match(line)
        if end_match:
            prefix, name, suffix = end_match.groups()
            # Use the name from BEGIN if available, otherwise normalize current
            normalized_name = begin_name if begin_name else name.upper()
            normalized_line = f"{prefix}END PGM {normalized_name}{suffix}"
            
            if normalized_line != original_line:
                result.changes.append(SanitizeChange(
                    line_number=i,
                    before=original_line,
                    after=normalized_line,
                    reason="Normalized END PGM statement"
                ))
            continue
        
        # Check for non-ASCII characters (warning only)
        try:
            line.encode('ascii')
        except UnicodeEncodeError:
            result.warnings.append(f"Line {i + 1}: Contains non-ASCII characters")
        
        # Check for very long lines
        if len(line) > 132:  # Traditional limit for many CNC systems
            result.warnings.append(f"Line {i + 1}: Exceeds 132 character limit ({len(line)} chars)")
    
    # Check for mismatched BEGIN/END
    begin_count = len([line for line in lines if BEGIN_RE.match(line)])
    end_count = len([line for line in lines if END_RE.match(line)])
    
    if begin_count != end_count:
        result.errors.append(f"Mismatched BEGIN/END statements: {begin_count} BEGIN, {end_count} END")
    
    return result


def apply_sanitize_in_text(text: str, result: SanitizeResult) -> str:
    """
    Apply sanitization changes to text.
    
    Args:
        text: Original text
        result: SanitizeResult with changes to apply
        
    Returns:
        Sanitized text
    """
    if not result.has_changes:
        return text
    
    lines = text.splitlines()
    
    # Apply changes in reverse order to maintain line indices
    for change in reversed(result.changes):
        if 0 <= change.line_number < len(lines):
            lines[change.line_number] = change.after
    
    return '\n'.join(lines)


def sanitize_program(text: str, rules: Dict[str, Any] = None) -> tuple[str, SanitizeResult]:
    """
    Sanitize NC program text and return both the cleaned text and the result.
    
    Args:
        text: Program text to sanitize
        rules: Optional sanitization rules
        
    Returns:
        Tuple of (sanitized_text, SanitizeResult)
    """
    result = sanitize_program_preview(text, rules)
    sanitized_text = apply_sanitize_in_text(text, result)
    return sanitized_text, result
