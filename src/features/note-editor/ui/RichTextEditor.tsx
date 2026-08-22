import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import type { JSONContent } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useState, type CSSProperties } from 'react';
import styles from './RichTextEditor.module.css';

type Props = {
  content: string;
  onChange: (content: string) => void;
};

type TiptapDocument = JSONContent & {
  type: 'doc';
};

const textColors = [
  '#e4ebfb',
  '#ff9cab',
  '#ffbb83',
  '#f4d56f',
  '#8fe0bd',
  '#8fc6ff',
  '#ba9dff',
];
const headingLevels = [1, 2, 3, 4, 5, 6] as const;

function toDocument(content: string): TiptapDocument {
  try {
    const document = JSON.parse(content) as TiptapDocument;
    if (document.type === 'doc') return document;
  } catch {
    // Existing notes are plain text and are converted to paragraphs on open.
  }

  return {
    type: 'doc',
    content: content
      .split('\n')
      .filter(Boolean)
      .map((text) => ({
        type: 'paragraph',
        content: [{ type: 'text', text }],
      })),
  };
}

export function RichTextEditor({ content, onChange }: Props) {
  const [, setVersion] = useState(0);
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const [isHeadingMenuOpen, setIsHeadingMenuOpen] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
      }),
      Placeholder.configure({
        placeholder: "Type '/' for commands, or start writing...",
      }),
    ],
    content: toDocument(content),
    editorProps: { attributes: { class: styles.richTextContent } },
    onUpdate: ({ editor: nextEditor }) =>
      onChange(JSON.stringify(nextEditor.getJSON())),
    onSelectionUpdate: () => setVersion((version) => version + 1),
  });

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt('Paste a URL');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };
  const selectedColor =
    (editor.getAttributes('textStyle').color as string | undefined) ??
    '#e4ebfb';
  const applyColor = (color: string) => {
    editor.chain().focus().setColor(color).run();
    setIsColorMenuOpen(false);
  };
  const activeHeadingLevel = headingLevels.find((level) =>
    editor.isActive('heading', { level }),
  );
  const toggleTextAlign = (alignment: 'left' | 'center' | 'right') => {
    const chain = editor.chain().focus();
    if (editor.isActive({ textAlign: alignment })) {
      chain.unsetTextAlign().run();
      return;
    }
    chain.setTextAlign(alignment).run();
  };

  return (
    <div className={styles.richTextEditor}>
      <div className={styles.editorToolbar} aria-label="Formatting tools">
        <button
          type="button"
          className={editor.isActive('bold') ? styles.isActive : ''}
          title="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          Bold
        </button>
        <button
          type="button"
          className={editor.isActive('italic') ? styles.isActive : ''}
          title="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          Italic
        </button>
        <div className={styles.editorColorControl}>
          <button
            type="button"
            className={`${styles.editorColorButton}${isColorMenuOpen ? ` ${styles.isActive}` : ''}`}
            aria-label="Text color"
            title="Text color"
            aria-expanded={isColorMenuOpen}
            onClick={() => setIsColorMenuOpen((isOpen) => !isOpen)}
          >
            <span style={{ color: selectedColor }}>T</span>
          </button>
          {isColorMenuOpen && (
            <div className={styles.editorColorPalette} aria-label="Text colors">
              {textColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={selectedColor === color ? styles.isSelected : ''}
                  aria-label={`Set text color ${color}`}
                  style={{ '--editor-color': color } as CSSProperties}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyColor(color)}
                />
              ))}
              <button
                type="button"
                className={styles.editorColorReset}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  editor.chain().focus().unsetColor().run();
                  setIsColorMenuOpen(false);
                }}
              >
                Reset
              </button>
            </div>
          )}
        </div>
        <div className={styles.editorHeadingControl}>
          <button
            type="button"
            className={
              isHeadingMenuOpen || activeHeadingLevel ? styles.isActive : ''
            }
            title="Heading level"
            aria-label="Heading level"
            aria-expanded={isHeadingMenuOpen}
            onClick={() => setIsHeadingMenuOpen((isOpen) => !isOpen)}
          >
            H{activeHeadingLevel ?? 1}
          </button>
          {isHeadingMenuOpen && (
            <div
              className={styles.editorHeadingPalette}
              aria-label="Heading levels"
            >
              {headingLevels.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={
                    activeHeadingLevel === level ? styles.isSelected : ''
                  }
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().toggleHeading({ level }).run();
                    setIsHeadingMenuOpen(false);
                  }}
                >
                  <span
                    className={`${styles.headingPreview} ${styles[`headingPreview${level}`]}`}
                  >
                    Heading {level}
                  </span>
                  <span className={styles.headingLevelLabel}>H{level}</span>
                </button>
              ))}
              <button
                type="button"
                className={styles.editorHeadingReset}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  editor.chain().focus().setParagraph().run();
                  setIsHeadingMenuOpen(false);
                }}
              >
                Normal
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          className={
            editor.isActive({ textAlign: 'left' }) ? styles.isActive : ''
          }
          title="Align left"
          aria-label="Align left"
          onClick={() => toggleTextAlign('left')}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 3h12M2 6h8M2 9h12M2 12h9" />
          </svg>
        </button>
        <button
          type="button"
          className={
            editor.isActive({ textAlign: 'center' }) ? styles.isActive : ''
          }
          title="Align center"
          aria-label="Align center"
          onClick={() => toggleTextAlign('center')}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 3h12M4 6h8M2 9h12M3 12h10" />
          </svg>
        </button>
        <button
          type="button"
          className={
            editor.isActive({ textAlign: 'right' }) ? styles.isActive : ''
          }
          title="Align right"
          aria-label="Align right"
          onClick={() => toggleTextAlign('right')}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 3h12M6 6h8M2 9h12M5 12h9" />
          </svg>
        </button>
        <button
          type="button"
          className={editor.isActive('bulletList') ? styles.isActive : ''}
          title="Bullet list"
          aria-label="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="3" cy="4" r="1.25" />
            <circle cx="3" cy="8" r="1.25" />
            <circle cx="3" cy="12" r="1.25" />
            <path d="M6 4h7M6 8h7M6 12h7" />
          </svg>
        </button>
        <button
          type="button"
          className={editor.isActive('orderedList') ? styles.isActive : ''}
          title="Numbered list"
          aria-label="Numbered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <svg viewBox="0 0 20 16" aria-hidden="true">
            <text x="1" y="5.2">
              1
            </text>
            <text x="1" y="10.2">
              2
            </text>
            <text x="1" y="15.2">
              3
            </text>
            <path d="M7 4h11M7 9h11M7 14h11" />
          </svg>
        </button>
        <button
          type="button"
          className={editor.isActive('taskList') ? styles.isActive : ''}
          title="To-do list"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          To-do
        </button>
        <button
          type="button"
          className={editor.isActive('blockquote') ? styles.isActive : ''}
          title="Quote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          Quote
        </button>
        <button
          type="button"
          className={editor.isActive('codeBlock') ? styles.isActive : ''}
          title="Code block"
          aria-label="Code block"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <span className={styles.codeBlockIcon} aria-hidden="true">
            &lt;/&gt;
          </span>
        </button>
        <button
          type="button"
          className={editor.isActive('link') ? styles.isActive : ''}
          title="Link"
          onClick={addLink}
        >
          Link
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
