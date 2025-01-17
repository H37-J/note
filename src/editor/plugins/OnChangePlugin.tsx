import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/store/zustand/editorStore';

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
        useEditorStore.getState().setEditorState(editorState)
      }
    });
  }, [editor, onChange]);
  return null;
}
