import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import { useDncStore } from '../../store/dncStore';
import type { SanitizeIssues, SanitizeChange } from '../../types/dnc';

const DEFAULT_SAMPLE = `0 BEGIN PGM EXAMPLE MM
1 L X+0 Y+0 F100
2 L X+10 Y+0
3 L X+10 Y+10
4 L X+0 Y+10
5 L X+0 Y+0
6 END PGM example MM`;

const NcEditor: React.FC = () => {
  const { sanitize, uploadFile } = useDncStore();
  const [value, setValue] = useState<string>(DEFAULT_SAMPLE);
  const [issues, setIssues] = useState<SanitizeIssues | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [autoApply, setAutoApply] = useState(false);
  const [appliedChangesCount, setAppliedChangesCount] = useState(0);
  const [lastSanitizeResult, setLastSanitizeResult] = useState<{ clean: string; issues: SanitizeIssues } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelRef = useRef<monaco.editor.ITextModel | null>(null);

  useEffect(() => {
    // Register language and theme once
    monaco.languages.register({ id: 'heidenhain' });
    monaco.languages.setLanguageConfiguration('heidenhain', {
      comments: { lineComment: ';' },
      brackets: [['{', '}'], ['[', ']'], ['(', ')']],
      autoClosingPairs: [{ open: '(', close: ')' }, { open: '[', close: ']' }],
    });
    monaco.languages.setMonarchTokensProvider('heidenhain', {
      keywords: ['BEGIN','END','PGM','L','CC','C','FN','TOOL','CALL','M','X','Y','Z','F','S'],
      tokenizer: {
        root: [
          [/;.*$/, 'comment'],
          [/\b(BEGIN|END)\b/, 'keyword'],
          [/\b(PGM|TOOL|CALL|FN|L|CC|C|M)\b/, 'keyword'],
          [/\b[XYZFSP][-+]?[0-9]+(\.[0-9]+)?\b/, 'number'],
          [/\b[0-9]+\b/, 'number'],
          [/"[^"]*"/, 'string'],
        ],
      },
    });
    monaco.editor.defineTheme('hh-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6a9955' },
        { token: 'keyword', foreground: 'c586c0' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'string', foreground: 'ce9178' },
      ],
      colors: {},
    });
  }, []);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!containerRef.current) return;
    // Create model and editor
    modelRef.current = monaco.editor.createModel(value, 'heidenhain');
    editorRef.current = monaco.editor.create(containerRef.current, {
      theme: 'hh-dark',
      model: modelRef.current,
      automaticLayout: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 14,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      renderWhitespace: 'none',
    });

    const sub = editorRef.current.onDidChangeModelContent(() => {
      const v = editorRef.current?.getValue() ?? '';
      setValue(v);
    });

    return () => {
      sub.dispose();
      editorRef.current?.dispose();
      modelRef.current?.dispose();
      editorRef.current = null;
      modelRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (modelRef.current && modelRef.current.getValue() !== value) {
      modelRef.current.setValue(value);
    }
  }, [value]);

  const onSanitize = useCallback(async () => {
    const res = await sanitize(value);
    setLastSanitizeResult(res);
    setIssues(res.issues);
    const changes: SanitizeChange[] = res.issues?.changes || [];
    const errors = res.issues?.errors || [];
    const warnings = res.issues?.warnings || [];
    
    if (changes.length > 0) {
      if (autoApply) {
        // Auto-apply changes without showing preview
        setValue(res.clean);
        setAppliedChangesCount(changes.length);
        setShowPreview(false);
        // Show brief success feedback
        setTimeout(() => setAppliedChangesCount(0), 3000);
      } else {
        // Show preview dialog
        const htmlParts: string[] = [
          `<style>
            .b{color:#e57373;background-color:rgba(229,115,115,0.1);padding:2px 4px;border-radius:3px}
            .a{color:#81c784;background-color:rgba(129,199,132,0.1);padding:2px 4px;border-radius:3px}
            .blk{background:#1f1f1f;padding:12px;border-radius:8px;margin-bottom:8px;border-left:3px solid #333}
            .hdr{color:#9e9e9e;font-size:11px;margin-bottom:4px}
            .reason{color:#bbb;font-style:italic;font-size:11px;margin-top:4px}
            .summary{background:#2a2a2a;padding:8px;border-radius:6px;margin-bottom:12px;color:#ccc}
          </style>`
        ];
        
        // Add summary
        htmlParts.push(
          `<div class='summary'>
            <strong>${changes.length} change${changes.length !== 1 ? 's' : ''} suggested</strong>
            ${errors.length > 0 ? `<span style="color:#e57373"> • ${errors.length} error${errors.length !== 1 ? 's' : ''}</span>` : ''}
            ${warnings.length > 0 ? `<span style="color:#ff9800"> • ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}</span>` : ''}
          </div>`
        );
        
        for (const ch of changes) {
          htmlParts.push(
            `<div class='blk'>
              <div class='hdr'>Line ${ch.line_number + 1}</div>
              <div class='b'>- ${escapeHtml(ch.before)}</div>
              <div class='a'>+ ${escapeHtml(ch.after)}</div>
              ${ch.reason ? `<div class='reason'>${escapeHtml(ch.reason)}</div>` : ''}
            </div>`
          );
        }
        
        setPreviewHtml(htmlParts.join('\n'));
        setShowPreview(true);
      }
    } else if (errors.length === 0 && warnings.length === 0) {
      // No issues, code is clean
      setValue(res.clean);
      setPreviewHtml('');
      setShowPreview(false);
    } else {
      // Only errors/warnings, no fixable changes
      setPreviewHtml('');
      setShowPreview(false);
    }
  }, [value, sanitize, autoApply]);

  const applySanitize = useCallback(async () => {
    if (lastSanitizeResult) {
      const changes = lastSanitizeResult.issues?.changes || [];
      setValue(lastSanitizeResult.clean);
      setIssues(lastSanitizeResult.issues);
      setAppliedChangesCount(changes.length);
      setShowPreview(false);
      // Show brief success feedback
      setTimeout(() => setAppliedChangesCount(0), 3000);
    }
  }, [lastSanitizeResult]);

  const onOpenFile = useCallback(async (file: File) => {
    const text = await file.text();
    setValue(text);
  }, []);

  const onUploadEditor = useCallback(async () => {
    const blob = new Blob([value], { type: 'text/plain' });
    const file = new File([blob], 'program.h', { type: 'text/plain' });
    await uploadFile(file);
  }, [value, uploadFile]);

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-dark-100 font-semibold">NC Editor</div>
          {appliedChangesCount > 0 && (
            <div className="text-xs px-2 py-1 rounded bg-accent-green-600/20 text-accent-green-400 border border-accent-green-600/30">
              ✓ Applied {appliedChangesCount} change{appliedChangesCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-2 text-dark-300 cursor-pointer">
              <input 
                type="checkbox" 
                checked={autoApply} 
                onChange={(e) => setAutoApply(e.target.checked)}
                className="form-checkbox h-4 w-4 text-accent-green-600 bg-dark-700 border-dark-600 rounded focus:ring-accent-green-500 focus:ring-2"
              />
              <span className="text-xs">Auto-apply</span>
            </label>
          </div>
          <label className="bg-dark-700 hover:bg-dark-600 px-3 py-2 rounded border border-dark-600 cursor-pointer">
            <input type="file" className="hidden" onChange={(e) => e.target.files && e.target.files[0] && onOpenFile(e.target.files[0])} />
            Open…
          </label>
          <button className="bg-dark-700 hover:bg-dark-600 px-3 py-2 rounded border border-dark-600" onClick={onUploadEditor}>Upload editor buffer</button>
          <button className="bg-dark-700 hover:bg-dark-600 px-3 py-2 rounded border border-dark-600" onClick={onSanitize}>Sanitize</button>
        </div>
      </div>

      <div className="border border-dark-700 rounded overflow-hidden" style={{ height: 420 }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {issues && (
        <div className="text-xs text-dark-300 flex gap-4 items-center flex-wrap">
          {issues.errors?.length ? (
            <div className="flex items-center gap-1 text-accent-red-400 bg-accent-red-600/10 px-2 py-1 rounded border border-accent-red-600/30">
              <span>⚠</span>
              <span>Errors: {issues.errors.length}</span>
            </div>
          ) : null}
          {issues.warnings?.length ? (
            <div className="flex items-center gap-1 text-accent-orange-400 bg-accent-orange-600/10 px-2 py-1 rounded border border-accent-orange-600/30">
              <span>⚠</span>
              <span>Warnings: {issues.warnings.length}</span>
            </div>
          ) : null}
          {issues.changes?.length ? (
            <div className="flex items-center gap-1 text-accent-green-400 bg-accent-green-600/10 px-2 py-1 rounded border border-accent-green-600/30">
              <span>✓</span>
              <span>Fixable: {issues.changes.length}</span>
            </div>
          ) : null}
          {issues.errors?.length === 0 && issues.warnings?.length === 0 && issues.changes?.length === 0 && (
            <div className="flex items-center gap-1 text-accent-green-400">
              <span>✓</span>
              <span>Code is clean</span>
            </div>
          )}
        </div>
      )}

      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-dark-900 border border-dark-700 rounded-xl w-[800px] max-w-[95vw] max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-dark-700">
              <div className="text-dark-100 font-semibold text-lg">Sanitize Preview</div>
              <button 
                className="text-dark-400 hover:text-dark-100 text-xl w-8 h-8 flex items-center justify-center rounded hover:bg-dark-800" 
                onClick={() => setShowPreview(false)}
                title="Close preview"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
            
            <div className="p-4 border-t border-dark-700 bg-dark-800/50 flex justify-between items-center">
              <div className="flex items-center gap-2 text-sm text-dark-300">
                <span>ℹ️</span>
                <span>Review the changes above and apply to update your code</span>
              </div>
              <div className="flex gap-2">
                <button 
                  className="bg-dark-700 hover:bg-dark-600 px-4 py-2 rounded border border-dark-600 text-dark-200" 
                  onClick={() => setShowPreview(false)}
                >
                  Cancel
                </button>
                <button 
                  className="bg-accent-green-600 hover:bg-accent-green-500 px-4 py-2 rounded text-white font-medium" 
                  onClick={applySanitize}
                >
                  Apply Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default NcEditor;

