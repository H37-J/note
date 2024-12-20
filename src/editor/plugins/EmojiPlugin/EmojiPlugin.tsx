import { MenuOption } from '@lexical/react/LexicalNodeMenuPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LexicalTypeaheadMenuPlugin, useBasicTypeaheadTriggerMatch } from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { $createTextNode, $getSelection, $isRangeSelection, TextNode } from 'lexical';
import { createPortal } from 'react-dom';


class EmojiOption extends MenuOption {
  title: string;
  emoji: string;
  keywords: Array<string>;

  constructor(
    title: string,
    emoji: string,
    options: {
      keywords?: Array<string>;
    },
  ) {
    super(title);
    this.title = title;
    this.emoji = emoji;
    this.keywords = options.keywords || [];
  }
}

const EmojiMenuItem =({
  index,
  isSelected,
  onClick,
  onMouseEnter,
  option,
}: {
  index: number;
  isSelected: boolean;
  onClick : () => void;
  onMouseEnter: () => void;
  option: EmojiOption;
}) => {
  let className = 'item';
  if (isSelected) {
    className += ' selected';
  }

  return (
    <li
      key={option.key}
      tabIndex={-1}
      className={className}
      ref={option.setRefElement}
      role="option"
      aria-selected={isSelected}
      id={'typeahead-item-' + index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}>
      <span className="text">
        {option.emoji} {option.title}
      </span>
    </li>
  );
}

type Emoji = {
  emoji: string;
  description: string;
  category: string;
  aliases: Array<string>;
  tags: Array<string>;
  unicode_version: string;
  ios_version: string;
  skin_tones?: boolean;
};

const MAX_EMOJI_SUGGESTION_COUNT = 100;

const EmojiPickerPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);
  const [emojis, setEmojis] = useState<Array<Emoji>>([]);

  useEffect(() => {
    import('./emoji-list').then((file) => setEmojis(file.default));
  }, []);

  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch(':', {
    minLength: 0,
  });

  const emojiOptions = useMemo(
    () =>
      emojis != null
        ? emojis.map(
          ({emoji, aliases, tags}) =>
            new EmojiOption(aliases[0] ?? '', emoji, {
              keywords: [...aliases, ...tags],
            }),
        )
        : [],
    [emojis],
  );

  const options: Array<EmojiOption> = useMemo(() => {
    return emojiOptions
      .filter((option) => {
        return queryString !== null
          ? new RegExp(queryString, 'gi').exec(option.title) || option.keywords !== null
            ? option.keywords.some((keyword: string) =>
              new RegExp(queryString, 'gi').exec(keyword))
            : false
          : emojiOptions;
      }).slice(0, MAX_EMOJI_SUGGESTION_COUNT);
  }, [emojiOptions, queryString]);

  const onSelectOption = useCallback(
    (
      selectedOption: EmojiOption,
      nodeToRemove: TextNode | null,
      closeMenu: () => void,
    ) => {
      editor.update(() => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection) || selection === null) {
          return;
        }

        if (nodeToRemove) {
          nodeToRemove.remove();
        }

        selection.insertNodes([$createTextNode(selectedOption.emoji)]);
        closeMenu();
      });
    }, [editor],
  );

  return (
    <LexicalTypeaheadMenuPlugin
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={checkForTriggerMatch}
      options={options}
      menuRenderFn={(
        anchorElementRef,
        {selectedIndex, selectOptionAndCleanUp, setHighlightedIndex},
      ) => {
        if (anchorElementRef.current == null || options.length === 0) {
          return null;
        }

        return anchorElementRef.current && options.length
          ? createPortal(
            <div className="typeahead-popover emoji-menu">
              <ul>
                {options.map((option: EmojiOption, index) => (
                  <EmojiMenuItem
                    key={option.key}
                    index={index}
                    isSelected={selectedIndex === index}
                    onClick={() => {
                      setHighlightedIndex(index);
                      selectOptionAndCleanUp(option);
                    }}
                    onMouseEnter={() => {
                      setHighlightedIndex(index);
                    }}
                    option={option}
                  />
                ))}
              </ul>
            </div>,
            anchorElementRef.current,
          )
          : null;
      }}
    />
  );
}

export default EmojiPickerPlugin;