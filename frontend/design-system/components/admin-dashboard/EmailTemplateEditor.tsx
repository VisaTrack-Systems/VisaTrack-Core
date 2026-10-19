/**
 * EmailTemplateEditor: the inline rich-text editor used on the admin Communication settings.
 *
 * It is a contentEditable box driven by the browser's built-in editing commands, so no editor
 * library is needed. The HTML it produces is cleaned again by the server before it is saved
 * and before every email is sent (see sanitize_template_html in backend/app/services/email.py).
 */

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code,
  Info,
  Italic,
  Link,
  List,
  ListOrdered,
  Palette,
  Underline,
  type LucideIcon,
} from 'lucide-react';
import {
  type ClipboardEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

// ── Variables ────────────────────────────────────────────────────────────────

/** What each {placeholder} becomes when an email is sent. Names match backend/app/services/email.py. */
export const TEMPLATE_VARIABLE_DESCRIPTIONS: Record<string, string> = {
  '{client_name}': 'Full name of the client',
  '{client_given_name}': "Client's first name",
  '{recipient_name}': 'Full name of the person receiving the email',
  '{case_number}': 'Unique case reference ID (keep it out of subject lines)',
  '{redacted_case_number}': 'Case number with all but the last 4 characters hidden, safe for subject lines',
  '{case_status}': 'Current status stage of the case',
  '{lawyer_name}': "Assigned lawyer's name (in invitations, the person who sent it)",
  '{lawyer_phone_number}': "Assigned lawyer's phone number",
  '{document_name}': 'Requested document name(s)',
  '{organization_name}': 'Firm or business name',
  '{organization_phone_number}': 'Firm or business phone number',
  '{invitation_url}': 'Secure account setup link',
  '{inviter_name}': 'Person who sent the invitation',
  '{expiration_time_hours}': 'Hours until the invitation link expires',
  '{organization_main_email}': "Firm's main contact email",
  '{organization_support_email}': "Firm's support email (the main contact email if none is set)",
  '{license_number}': "Firm's RCIC / Law Society license number",
  '{portal_url}': 'Link to the VisaTrack sign-in page',
  '{reminder_title}': 'Title of the reminder',
  '{reminder_body}': 'Message of the reminder',
};

function describeVariable(variable: string): string {
  return TEMPLATE_VARIABLE_DESCRIPTIONS[variable] ?? 'Filled in when the email is sent';
}

/** Hover, focus, or click the icon to see a table of the variables this template can use. */
export function VariableReference({ variables }: { variables: string[] }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const tooltipId = useId();
  const visible = open || pinned;

  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label="Show template variables"
        aria-expanded={visible}
        aria-describedby={visible ? tooltipId : undefined}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setPinned((value) => !value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setPinned(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            setPinned(false);
          }
        }}
        className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
      {visible ? (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute right-0 top-full z-30 mt-1 w-80 rounded-md border border-gray-200 bg-white p-3 shadow-popover"
        >
          <p className="mb-2 text-xs font-semibold text-gray-900">Template variables</p>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th scope="col" className="py-1 pr-2 font-medium">Variable</th>
                <th scope="col" className="py-1 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {variables.map((variable) => (
                <tr key={variable} className="border-b border-gray-100 last:border-0">
                  <td className="py-1 pr-2 align-top">
                    <code className="font-mono text-primary-700">{variable}</code>
                  </td>
                  <td className="py-1 text-gray-700">{describeVariable(variable)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-gray-500">Type a variable into the email, or use Insert Variable.</p>
        </div>
      ) : null}
    </span>
  );
}

// ── HTML helpers ─────────────────────────────────────────────────────────────

const HTML_TAG = /<\/?[a-z][^>]*>/i;
const SAFE_LINK = /^(https?:\/\/|mailto:|\{\w+\}$)/i;

// Same allowlist as the server; anything else is removed before it reaches the editor.
const ALLOWED_TAGS = new Set([
  'P', 'DIV', 'BR', 'SPAN', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'A',
  'UL', 'OL', 'LI', 'FONT', 'BLOCKQUOTE', 'H1', 'H2', 'H3',
]);
const ALLOWED_ATTRIBUTES = new Set(['style', 'href', 'color', 'face', 'size']);

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Turns a plain-text template into editor HTML: blank lines start a new paragraph. */
export function plainTextToHtml(text: string): string {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Removes tags and attributes outside the allowlist. Uses an inert document, so nothing runs. */
function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const clean = (element: Element) => {
    for (const child of Array.from(element.children)) {
      if (!ALLOWED_TAGS.has(child.tagName)) {
        // Keep the text of unknown tags (e.g. <section>) but drop scripts and styles entirely.
        if (['SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'OBJECT'].includes(child.tagName)) {
          child.remove();
        } else {
          clean(child);
          child.replaceWith(...Array.from(child.childNodes));
        }
        continue;
      }
      for (const attribute of Array.from(child.attributes)) {
        const unsafeLink = attribute.name === 'href' && !SAFE_LINK.test(attribute.value.trim());
        if (!ALLOWED_ATTRIBUTES.has(attribute.name) || unsafeLink) {
          child.removeAttribute(attribute.name);
        }
      }
      clean(child);
    }
  };
  clean(doc.body);
  return doc.body.innerHTML;
}

/** Editor HTML for a saved template, which may be HTML (from this editor) or older plain text. */
export function templateBodyToHtml(body: string): string {
  return HTML_TAG.test(body) ? sanitizeHtml(body) : plainTextToHtml(body);
}

/** The browser's own serialization of some HTML, so two versions can be compared fairly. */
export function normalizeHtml(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container.innerHTML;
}

/** True when the HTML shows no text (e.g. "<p><br></p>" left after deleting everything). */
export function isHtmlEmpty(html: string): boolean {
  const container = document.createElement('div');
  container.innerHTML = html;
  return (container.textContent ?? '').trim() === '';
}

// ── Editor ───────────────────────────────────────────────────────────────────

const FONT_FAMILIES = ['Inter', 'Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana'];
// Values are the browser's fontSize steps (1-7); 3 is the normal size.
const FONT_SIZES = [
  { label: 'Small', value: '2' },
  { label: 'Normal', value: '3' },
  { label: 'Large', value: '5' },
  { label: 'Huge', value: '6' },
];

/** Lets the parent insert text (e.g. a variable from its menu) at the editor's cursor. */
export type RichTextEditorHandle = { insertText: (text: string) => void };

type RichTextEditorProps = {
  /** Read once when the editor mounts. Give the editor a new `key` to load different content. */
  initialHtml: string;
  onChange: (html: string) => void;
  onFocus?: () => void;
  label: string;
  disabled?: boolean;
  ref?: Ref<RichTextEditorHandle>;
};

export function RichTextEditor({ initialHtml, onChange, onFocus, label, disabled = false, ref }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  // Kept as one object for the editor's lifetime: React rewrites innerHTML whenever this
  // object changes, which would wipe what the admin typed and move the cursor.
  const [startHtml] = useState(() => ({ __html: initialHtml }));
  const [fontFamily, setFontFamily] = useState('Inter');
  const [fontSize, setFontSize] = useState('3');
  const [linkError, setLinkError] = useState<string | null>(null);

  /** Remembers the cursor, because clicking a toolbar dropdown moves focus out of the editor. */
  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && editorRef.current?.contains(selection.anchorNode)) {
      savedRange.current = selection.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    editorRef.current?.focus();
    const selection = window.getSelection();
    if (selection && savedRange.current) {
      selection.removeAllRanges();
      selection.addRange(savedRange.current);
    }
  };

  const emitChange = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  /** Runs a browser editing command. Returns false where it is unsupported (e.g. test environments). */
  const runCommand = (command: string, value?: string): boolean => {
    restoreSelection();
    let applied = false;
    if (typeof document.execCommand === 'function') {
      // Write inline styles (<span style="...">) rather than old <font> tags.
      document.execCommand('styleWithCSS', false, 'true');
      applied = document.execCommand(command, false, value);
    }
    saveSelection();
    emitChange();
    return applied;
  };

  const insertText = (text: string) => {
    if (runCommand('insertText', text)) {
      return;
    }
    // Fallback: put the text at the saved cursor, or at the end of the editor.
    const editor = editorRef.current;
    if (!editor) return;
    let range = savedRange.current;
    if (!range || !editor.contains(range.startContainer)) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    savedRange.current = range;
    emitChange();
  };

  useImperativeHandle(ref, () => ({ insertText }));

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    // Paste as plain text: formatting copied from Word or web pages is long and rarely email-safe.
    event.preventDefault();
    insertText(event.clipboardData.getData('text/plain'));
  };

  const handleLink = () => {
    saveSelection();
    const href = window.prompt('Link address (https://… or a variable such as {portal_url})')?.trim();
    if (!href) return;
    if (!SAFE_LINK.test(href)) {
      setLinkError('Links must start with https://, http://, or mailto:, or be a single variable.');
      return;
    }
    setLinkError(null);
    runCommand('createLink', href);
  };

  return (
    <div className="rounded-md border border-gray-300 bg-white focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500">
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex flex-wrap items-center gap-1 rounded-t-md border-b border-gray-200 bg-gray-50 px-2 py-1.5"
      >
        <select
          aria-label="Font family"
          value={fontFamily}
          disabled={disabled}
          onChange={(event) => {
            setFontFamily(event.target.value);
            runCommand('fontName', event.target.value);
          }}
          className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-700"
        >
          {FONT_FAMILIES.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>
        <select
          aria-label="Text size"
          value={fontSize}
          disabled={disabled}
          onChange={(event) => {
            setFontSize(event.target.value);
            runCommand('fontSize', event.target.value);
          }}
          className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-700"
        >
          {FONT_SIZES.map((size) => (
            <option key={size.value} value={size.value}>
              {size.label}
            </option>
          ))}
        </select>
        <ToolbarDivider />
        <ToolbarButton icon={Bold} label="Bold" disabled={disabled} onClick={() => runCommand('bold')} />
        <ToolbarButton icon={Italic} label="Italic" disabled={disabled} onClick={() => runCommand('italic')} />
        <ToolbarButton icon={Underline} label="Underline" disabled={disabled} onClick={() => runCommand('underline')} />
        <ToolbarDivider />
        <ToolbarButton
          icon={Palette}
          label="Text color"
          disabled={disabled}
          onClick={() => {
            saveSelection();
            colorInputRef.current?.click();
          }}
        />
        <input
          ref={colorInputRef}
          type="color"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={(event) => runCommand('foreColor', event.target.value)}
        />
        <ToolbarDivider />
        <ToolbarButton icon={AlignLeft} label="Align left" disabled={disabled} onClick={() => runCommand('justifyLeft')} />
        <ToolbarButton icon={AlignCenter} label="Align center" disabled={disabled} onClick={() => runCommand('justifyCenter')} />
        <ToolbarButton icon={AlignRight} label="Align right" disabled={disabled} onClick={() => runCommand('justifyRight')} />
        <ToolbarDivider />
        <ToolbarButton icon={List} label="Bulleted list" disabled={disabled} onClick={() => runCommand('insertUnorderedList')} />
        <ToolbarButton icon={ListOrdered} label="Numbered list" disabled={disabled} onClick={() => runCommand('insertOrderedList')} />
        <ToolbarDivider />
        <ToolbarButton icon={Link} label="Insert link" disabled={disabled} onClick={handleLink} />
      </div>
      {linkError ? <p role="alert" className="px-3 pt-2 text-xs text-red-600">{linkError}</p> : null}

      <div
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        contentEditable={!disabled}
        tabIndex={0}
        onInput={emitChange}
        onFocus={onFocus}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onBlur={saveSelection}
        onPaste={handlePaste}
        dangerouslySetInnerHTML={startHtml}
        className="min-h-56 rounded-b-md px-4 py-3 text-sm leading-relaxed text-gray-900 focus:outline-none [&_a]:text-primary-700 [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-6"
      />
    </div>
  );
}

function ToolbarDivider() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px bg-gray-300" />;
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      // Keep focus (and the selection) in the editor.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="rounded-md p-1.5 text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900 disabled:opacity-50"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export function InsertVariableMenu({
  variables,
  disabled,
  onInsert,
}: {
  variables: string[];
  disabled: boolean;
  onInsert: (variable: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
        className="inline-flex items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-2.5 py-1.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100 disabled:opacity-50"
      >
        <Code className="h-3.5 w-3.5" aria-hidden="true" />
        Insert Variable
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Template variables"
          className="absolute right-0 top-full z-30 mt-1 max-h-72 w-72 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-popover"
        >
          {variables.map((variable) => (
            <MenuItem
              key={variable}
              onSelect={() => {
                onInsert(variable);
                setOpen(false);
              }}
            >
              <code className="block font-mono text-xs text-primary-700">{variable}</code>
              <span className="block text-[11px] text-gray-500">{describeVariable(variable)}</span>
            </MenuItem>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({ onSelect, children }: { onSelect: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      className="block w-full px-3 py-1.5 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
    >
      {children}
    </button>
  );
}
