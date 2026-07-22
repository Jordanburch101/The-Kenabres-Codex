import { Fragment, useEffect, useState } from 'react';
import { groupBuilds, featuredBuilds, forYouSections, shortName, type RailBuild } from '../lib/rail';
import { favorites, type RailView } from '../lib/favorites';

interface Props {
  builds: RailBuild[];
  activeSlug?: string;
}

function Row({ b, activeSlug, starred, onToggle }: {
  b: RailBuild; activeSlug?: string; starred: boolean; onToggle: (slug: string) => void;
}) {
  const name = shortName(b.name);
  return (
    <div className={`nav nav--build${b.slug === activeSlug ? ' active' : ''}`}>
      <a className="nav-txt" href={`/builds/${b.slug}`}>
        <span className="nav-name">{name}</span>
        <span className="nav-role">{b.class} · {b.role}</span>
      </a>
      <button
        type="button"
        className={`rail-star${starred ? ' filled' : ''}`}
        aria-pressed={starred}
        aria-label={starred ? `Unstar ${name}` : `Star ${name}`}
        onClick={() => onToggle(b.slug)}
      >{starred ? '★' : '☆'}</button>
    </div>
  );
}

export default function RailNav({ builds, activeSlug }: Props) {
  const [view, setView] = useState<RailView>('directory');
  const [starred, setStarred] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => {
      setView(favorites.getView());
      setStarred(favorites.getStarred());
      setRecent(favorites.getRecent());
    };
    if (activeSlug) favorites.recordView(activeSlug);
    sync();
    return favorites.subscribe(sync);
  }, [activeSlug]);

  const isStarred = (slug: string) => starred.includes(slug);
  const toggle = (slug: string) => favorites.toggleStar(slug);

  const featured = featuredBuilds(builds);
  const groups = groupBuilds(builds);
  const foryou = forYouSections(builds, starred, recent);

  return (
    <>
      <div className="rail-toggle" role="tablist" aria-label="Rail view">
        <button type="button" role="tab" aria-selected={view === 'directory'}
          className={view === 'directory' ? 'on' : ''}
          onClick={() => favorites.setView('directory')}>Directory</button>
        <button type="button" role="tab" aria-selected={view === 'foryou'}
          className={view === 'foryou' ? 'on' : ''}
          onClick={() => favorites.setView('foryou')}>For You</button>
      </div>

      <nav className="rail-list">
        {view === 'directory' ? (
          <>
            {featured.length > 0 && (
              <>
                <div className="rail-div">★ Featured</div>
                {featured.map((b) => (
                  <Row key={`f-${b.slug}`} b={b} activeSlug={activeSlug} starred={isStarred(b.slug)} onToggle={toggle} />
                ))}
              </>
            )}
            {groups.map((g) => (
              <Fragment key={g.kind}>
                <div className="rail-div">{g.label}</div>
                {g.builds.map((b) => (
                  <Row key={`${g.kind}-${b.slug}`} b={b} activeSlug={activeSlug} starred={isStarred(b.slug)} onToggle={toggle} />
                ))}
              </Fragment>
            ))}
          </>
        ) : (
          <>
            {foryou.starred.length === 0 && foryou.recent.length === 0 && (
              <div className="rail-empty">
                <span className="rail-empty-star">☆</span>
                Star a build to pin it here. Builds you open will show up under Recently Viewed.
              </div>
            )}
            {foryou.starred.length > 0 && (
              <>
                <div className="rail-div">Starred</div>
                {foryou.starred.map((b) => (
                  <Row key={`s-${b.slug}`} b={b} activeSlug={activeSlug} starred={true} onToggle={toggle} />
                ))}
              </>
            )}
            {foryou.recent.length > 0 && (
              <>
                <div className="rail-div">Recently Viewed</div>
                {foryou.recent.map((b) => (
                  <Row key={`r-${b.slug}`} b={b} activeSlug={activeSlug} starred={isStarred(b.slug)} onToggle={toggle} />
                ))}
              </>
            )}
          </>
        )}
      </nav>
    </>
  );
}
