import { useLiveQuery } from 'dexie-react-hooks';
import { db, BOOK_ID } from '../db/schema';
import { useUi } from '../stores/ui';
import { IconBack, IconEye } from './icons';

export function Topbar() {
  const book = useLiveQuery(() => db.books.get(BOOK_ID));
  const { privacy, togglePrivacy } = useUi();

  return (
    <header className="topbar">
      <button className="back" onClick={() => location.hash = ''}><IconBack /></button>
      <div className="book-cover">{book?.cover ?? '📔'}</div>
      <span className="book-name">{book?.name ?? '轻账'}</span>
      <span className="tag">轻账本</span>
      <div className="spacer" />
      <button className="back" title="隐私模式" onClick={togglePrivacy}
        style={{ color: privacy ? 'var(--primary)' : undefined }}>
        <IconEye off={privacy} />
      </button>
    </header>
  );
}
