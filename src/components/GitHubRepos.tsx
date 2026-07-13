import React, { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { $authState } from '../stores/authStore';

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  topics: string[];
}

export default function GitHubRepos() {
  const { profile } = useStore($authState);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const username = profile?.githubUsername;
    if (!username) {
      setLoading(false);
      return;
    }

    fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=12`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch repos');
        return res.json();
      })
      .then(data => {
        setRepos(data.filter((r: any) => !r.fork).slice(0, 12));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [profile?.githubUsername]);

  if (!profile?.githubUsername) return null;

  if (loading) {
    return (
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontFamily: 'var(--display)', fontSize: '1rem', fontWeight: 700, color: 'var(--ink)', marginBottom: '1rem' }}>
          GitHub Repositories
        </h3>
        <div style={{ fontFamily: 'var(--mono)', fontSize: '0.875rem', color: 'var(--muted)', padding: '1rem' }}>
          Loading repos...
        </div>
      </div>
    );
  }

  if (error) return null;
  if (repos.length === 0) return null;

  return (
    <div style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--display)', fontSize: '1rem', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
          GitHub Repositories
        </h3>
        <a
          href={`https://github.com/${profile.githubUsername}?tab=repositories`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--accent)', textDecoration: 'none' }}
        >
          View All →
        </a>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {repos.map(repo => (
          <a
            key={repo.id}
            href={repo.html_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '1.25rem',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              textDecoration: 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              display: 'flex',
              flexDirection: 'column',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--muted)"><path d="M3 3h18v18H3V3zm16.525 13.707c-.765 1.397-2.856 1.956-4.163 1.375-.043-.025-.087-.043-.131-.065.776-1.332 1.416-2.744 1.918-4.225.864 1.053 2.447 1.539 3.94 1.375-.476.835-1.098 1.595-1.858 2.235-.196.173-.394.335-.599.481-.356.272-.76.47-1.207.599zM9.837 17.675c-.89.588-2.065.639-3.007.255-.884-.387-1.465-1.234-1.535-2.171.777.166 1.603.127 2.34-.127.825-.293 1.562-.819 2.202-1.543v1.586zM16.175 16.132c-.216.293-.496.539-.826.726-.796.459-1.754.519-2.642.245-.78-.257-1.463-.745-1.998-1.395.824.217 1.682.16 2.459-.183.774-.322 1.464-.857 2.007-1.526v2.133zM4.348 12.694c-.043.365-.065.734-.065 1.106 0 3.126 2.536 5.662 5.662 5.662.372 0 .741-.022 1.106-.065-.514-.532-.929-1.156-1.224-1.844-1.175.36-2.29.382-3.374-.065-.595-.243-1.125-.626-1.565-1.125-.348-.397-.624-.849-.822-1.344-.125-.397-.194-.813-.21-1.238l.492-.087zM19.431 12.607c-.348.087-.696.13-1.043.13-1.48 0-2.832-.765-3.596-1.918.322.043.644.087.966.13 1.437.216 2.547 1.326 2.633 2.656v-.001c-.001 0 0 0 0 0v-.003z"/></svg>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink)' }}>
                {repo.name}
              </span>
            </div>
            {repo.description && (
              <p style={{ fontFamily: 'var(--body)', fontSize: '0.8125rem', color: 'var(--muted)', margin: '0 0 0.75rem', lineHeight: 1.5, flex: 1 }}>
                {repo.description.length > 100 ? repo.description.slice(0, 100) + '...' : repo.description}
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontFamily: 'var(--mono)', fontSize: '0.6875rem', color: 'var(--muted)' }}>
              {repo.language && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />
                  {repo.language}
                </span>
              )}
              {repo.stargazers_count > 0 && (
                <span>⭐ {repo.stargazers_count}</span>
              )}
              {repo.forks_count > 0 && (
                <span>🍴 {repo.forks_count}</span>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
