import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useRef } from 'react';
import api from '@/utils/api';
import { useRouter } from 'next/router';

export default function OnChangePlugin({ onChange }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ prevEditorState, editorState }) => {
      if (!prevEditorState || !editorState) return;
      const prevMap = prevEditorState._nodeMap;
      const currentMap = editorState._nodeMap;
      let check = false;

      prevMap.forEach((node, key) => {
        if (prevMap.get(key) !== currentMap.get(key)) {
          check = true;
        }
      });



      if (check) {
        onChange(editorState);
      }
    });
  }, [editor, onChange]);
  return null;
}
