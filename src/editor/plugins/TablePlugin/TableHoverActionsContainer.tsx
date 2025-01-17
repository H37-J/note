import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ReactPortal, useEffect, useMemo, useRef, useState } from 'react';
import { $getNearestNodeFromDOMNode, NodeKey } from 'lexical';
import { useDebounce } from '@/editor/utils/utils';
import {
  $getTableColumnIndexFromTableCellNode,
  $getTableRowIndexFromTableCellNode,
  $insertTableColumn__EXPERIMENTAL,
  $insertTableRow__EXPERIMENTAL,
  $isTableCellNode,
  $isTableNode,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import { $findMatchingParent, mergeRegister } from '@lexical/utils';
import { createPortal } from 'react-dom';

const BUTTON_WIDTH_PX = 20;

const TableHoverActionsContainer = ({
  anchorElem,
}: {
  anchorElem: HTMLElement;
}) => {
  const [editor] = useLexicalComposerContext();
  const [isShownRow, setShownRow] = useState<boolean>(false);
  const [isShownColumn, setShownColumn] = useState<boolean>(false);
  const [shouldListenMouseMove, setShouldListenMouseMove] =
    useState<boolean>(false);
  const [position, setPosition] = useState({});
  const tableSetRef = useRef<Set<NodeKey>>(new Set());
  const tableCellDOMNodeRef = useRef<HTMLElement | null>(null);

  const debouncedOnMouseMove = useDebounce(
    (event: MouseEvent) => {
      const { isOutside, tableDOMNode } = getMouseInfo(event);

      if (isOutside) {
        setShownRow(false);
        setShownColumn(false);
        return;
      }

      if (!tableDOMNode) {
        return;
      }

      tableCellDOMNodeRef.current = tableDOMNode;

      let hoveredRowNode: TableCellNode | null = null;
      let hoveredColumnNode: TableCellNode | null = null;
      let tableDOMElement: HTMLElement | null = null;

      editor.update(() => {
        const maybeTableCell = $getNearestNodeFromDOMNode(tableDOMNode);

        if ($isTableCellNode(maybeTableCell)) {
          const table = $findMatchingParent(maybeTableCell, (node) =>
            $isTableNode(node)
          );
          if (!$isTableNode(table)) {
            return;
          }

          tableDOMElement = editor.getElementByKey(table?.getKey());

          if (tableDOMElement) {
            const rowCount = table.getChildrenSize();
            const colCount = (
              (table as TableNode).getChildAtIndex(0) as TableRowNode
            )?.getChildrenSize();

            const rowIndex = $getTableRowIndexFromTableCellNode(maybeTableCell);
            const colIndex =
              $getTableColumnIndexFromTableCellNode(maybeTableCell);

            if (rowIndex === rowCount - 1) {
              hoveredRowNode = maybeTableCell;
            } else if (colIndex === colCount - 1) {
              hoveredColumnNode = maybeTableCell;
            }
          }
        }
      });

      if (tableDOMElement) {
        const {
          width: tableElemWidth,
          y: tableElemY,
          right: tableElemRight,
          left: tableElemLeft,
          bottom: tableElemBottom,
          height: tableElemHeight,
        } = (tableDOMElement as HTMLTableElement).getBoundingClientRect();

        const { y: editorElemY, left: editorElemLeft } =
          anchorElem.getBoundingClientRect();

        if (hoveredRowNode) {
          setShownColumn(false);
          setShownRow(true);
          setPosition({
            height: BUTTON_WIDTH_PX,
            left: tableElemLeft - editorElemLeft,
            top: tableElemBottom - editorElemY + 5,
            width: tableElemWidth,
          });
        } else if (hoveredColumnNode) {
          setShownColumn(true);
          setShownRow(false);
          setPosition({
            height: tableElemHeight,
            left: tableElemRight - editorElemLeft + 5,
            top: tableElemY - editorElemY,
            width: BUTTON_WIDTH_PX,
          });
        }
      }
    },
    200,
    250
  );

  const tableResizeObserver = useMemo(() => {
    return new ResizeObserver(() => {
      setShownRow(false);
      setShownColumn(false);
    });
  }, []);

  useEffect(() => {
    if (!shouldListenMouseMove) {
      return;
    }

    document.addEventListener('mousemove', debouncedOnMouseMove);

    return () => {
      setShownRow(false);
      setShownColumn(false);
      document.removeEventListener('mousemove', debouncedOnMouseMove);
    };
  }, [shouldListenMouseMove, debouncedOnMouseMove]);

  useEffect(() => {
    return mergeRegister(
      editor.registerMutationListener(
        TableNode,
        (mutations) => {
          editor.getEditorState().read(() => {
            for (const [key, type] of mutations) {
              const tableDOMElement = editor.getElementByKey(key);
              switch (type) {
                case 'created':
                  tableSetRef.current.add(key);
                  setShouldListenMouseMove(tableSetRef.current.size > 0);
                  if (tableDOMElement) {
                    tableResizeObserver.observe(tableDOMElement);
                  }
                  break;

                case 'destroyed':
                  tableSetRef.current.delete(key);
                  setShouldListenMouseMove(tableSetRef.current.size > 0);
                  // Reset resize observers
                  tableResizeObserver.disconnect();
                  tableSetRef.current.forEach((tableKey: NodeKey) => {
                    const tableElement = editor.getElementByKey(tableKey);
                    if (tableElement) {
                      tableResizeObserver.observe(tableElement);
                    }
                  });
                  break;

                default:
                  break;
              }
            }
          });
        },
        { skipInitialization: false }
      )
    );
  }, [editor, tableResizeObserver]);

  const insertAction = (insertRow: boolean) => {
    editor.update(() => {
      if (tableCellDOMNodeRef.current) {
        const maybeTableNode = $getNearestNodeFromDOMNode(
          tableCellDOMNodeRef.current
        );
        maybeTableNode?.selectEnd();
        if (insertRow) {
          $insertTableRow__EXPERIMENTAL();
          setShownRow(false);
        } else {
          $insertTableColumn__EXPERIMENTAL();
          setShownColumn(false);
        }
      }
    });
  };

  return (
    <>
      {isShownRow && (
        <button
          className={'PlaygroundEditorTheme__tableAddRows'}
          style={{ ...position }}
          onClick={() => insertAction(true)}
        />
      )}
      {isShownColumn && (
        <button
          className={'PlaygroundEditorTheme__tableAddColumns'}
          style={{ ...position }}
          onClick={() => insertAction(false)}
        />
      )}
    </>
  );
};

const getMouseInfo = (
  event: MouseEvent
): {
  tableDOMNode: HTMLElement | null;
  isOutside: boolean;
} => {
  const target = event.target;

  if (target && target instanceof HTMLElement) {
    const tableDOMNode = target.closest<HTMLElement>(
      'td.PlaygroundEditorTheme__tableCell, th.PlaygroundEditorTheme__tableCell'
    );

    const isOutside = !(
      tableDOMNode ||
      target.closest<HTMLElement>(
        'button.PlaygroundEditorTheme__tableAddRows'
      ) ||
      target.closest<HTMLElement>(
        'button.PlaygroundEditorTheme__tableAddColumns'
      ) ||
      target.closest<HTMLElement>('div.TableCellResizer__resizer')
    );

    return { isOutside, tableDOMNode };
  } else {
    return { isOutside: true, tableDOMNode: null };
  }
};

const TableHoverActionsPlugin = ({
  anchorElem = document.body,
}: {
  anchorElem?: HTMLElement;
}): ReactPortal | null => {
  return createPortal(
    <TableHoverActionsContainer anchorElem={anchorElem} />,
    anchorElem
  );
};

export default TableHoverActionsPlugin;
