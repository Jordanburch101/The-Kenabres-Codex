import { useEffect, useState } from 'react';
import { favorites } from '../lib/favorites';

export default function StarButton({ slug }: { slug: string }) {
  const [starred, setStarred] = useState(false);

  useEffect(() => {
    const sync = () => setStarred(favorites.isStarred(slug));
    sync();
    return favorites.subscribe(sync);
  }, [slug]);

  return (
    <button
      type="button"
      className={`star-btn${starred ? ' on' : ''}`}
      aria-pressed={starred}
      onClick={() => favorites.toggleStar(slug)}
    >
      <span aria-hidden="true">{starred ? '★' : '☆'}</span>
      {starred ? 'Starred' : 'Star'}
    </button>
  );
}
