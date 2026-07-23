import { useEffect, useMemo, useState } from 'react';
import { favorites } from '../lib/favorites';
import { filterBuilds, type DirBuild, type Facets } from '../lib/directory';

interface Props {
  builds: DirBuild[];
  facets: Facets;
}

function Card({ b, starred, onToggle }: { b: DirBuild; starred: boolean; onToggle: (slug: string) => void }) {
  return (
    <article className="dir-card">
      <a className="dc-link" href={`/builds/${b.slug}`}>
        <h3 className="dc-name">{b.name}</h3>
        <p className="dc-tagline">{b.tagline}</p>
        {b.badges.length > 0 && (
          <div className="dc-badges">
            {b.badges.map((bd, i) => (
              <span key={i} className={bd.style && bd.style !== 'plain' ? `badge ${bd.style}` : 'badge'}>
                {bd.label}
              </span>
            ))}
          </div>
        )}
        <p className="dc-summary">{b.summary}</p>
        <div className="dc-foot">
          <span className="role">{b.role}</span>
          <span className="sep">·</span>
          <span>{b.kindLabel}</span>
          {b.difficulty && (
            <>
              <span className="sep">·</span>
              <span>{b.difficulty}</span>
            </>
          )}
        </div>
      </a>
      <button
        type="button"
        className={`dc-star${starred ? ' filled' : ''}`}
        aria-pressed={starred}
        aria-label={starred ? `Unstar ${b.name}` : `Star ${b.name}`}
        onClick={() => onToggle(b.slug)}
      >
        {starred ? '★' : '☆'}
      </button>
    </article>
  );
}

export default function BuildDirectory({ builds, facets }: Props) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [role, setRole] = useState('');
  const [className, setClassName] = useState('');
  const [starred, setStarred] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setStarred(favorites.getStarred());
    sync();
    return favorites.subscribe(sync);
  }, []);

  const visible = useMemo(
    () => filterBuilds(builds, { query, kind, role, className }),
    [builds, query, kind, role, className],
  );

  const clear = () => {
    setQuery('');
    setKind('');
    setRole('');
    setClassName('');
  };

  const total = builds.length;
  const count = visible.length;

  return (
    <>
      <div className="dir-toolbar">
        <input
          className="dir-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search builds — name, class, tag…"
          aria-label="Search builds"
        />
        <div className="dir-filters">
          <label className="dir-field">
            <span className="label">Kind</span>
            <select className="dir-select" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">All kinds</option>
              {facets.kinds.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </label>
          <label className="dir-field">
            <span className="label">Role</span>
            <select className="dir-select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">All roles</option>
              {facets.roles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="dir-field">
            <span className="label">Class</span>
            <select className="dir-select" value={className} onChange={(e) => setClassName(e.target.value)}>
              <option value="">All classes</option>
              {facets.classes.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <button type="button" className="dir-reset" onClick={clear}>Clear filters</button>
        </div>
      </div>

      <p className="dir-count">
        {count === total ? `Showing all ${total} builds` : `Showing ${count} of ${total} builds`}
      </p>

      {count === 0 ? (
        <div className="dir-empty">
          <p>No builds match your filters.</p>
          <button type="button" className="dir-reset" onClick={clear}>Clear filters</button>
        </div>
      ) : (
        <div className="dir-grid">
          {visible.map((b) => (
            <Card key={b.slug} b={b} starred={starred.includes(b.slug)} onToggle={(s) => favorites.toggleStar(s)} />
          ))}
        </div>
      )}
    </>
  );
}
