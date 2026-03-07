import './style.css'

// Configuration
const GITHUB_USERNAME = 'lejrn';
const API_BASE = 'https://api.github.com';
const STATIC_DATA_URL = '/data/repos.json';

// Neon color palette — each card gets a neon accent from this set
const NEON_COLORS = [
  '#00ffff', // cyan
  '#ff00ff', // magenta
  '#39ff14', // neon green
  '#ff6ec7', // hot pink
  '#ffff00', // yellow
  '#ff4500', // neon orange
  '#7b68ee', // medium slate blue
  '#00ff7f', // spring green
  '#ff1493', // deep pink
  '#1e90ff', // dodger blue
  '#ffa500', // orange
  '#da70d6', // orchid
];

// Language colors for dots
const LANGUAGE_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#2b7489', Python: '#3572A5',
  Java: '#b07219', 'C++': '#f34b7d', C: '#555555', 'C#': '#239120',
  Go: '#00ADD8', Rust: '#dea584', Swift: '#ffac45', Kotlin: '#F18E33',
  HTML: '#e34c26', CSS: '#1572B6', Shell: '#89e051', Dockerfile: '#384d54',
  Ruby: '#701516', PHP: '#4F5D95', Dart: '#00B4AB', Vue: '#4FC08D',
  SCSS: '#c6538c', R: '#198ce7', Lua: '#000080', Haskell: '#5e5086',
  Scala: '#c22d40', PowerShell: '#012456', Makefile: '#427819',
  default: '#586069'
};

const getLanguageColor = (lang) => LANGUAGE_COLORS[lang] || LANGUAGE_COLORS.default;

// ── Main Application ──────────────────────────────────────────────

class GitHubShowcase {
  constructor() {
    this.gridEl = document.getElementById('repos-grid');
    this.loadingEl = document.getElementById('loading');
    this.errorEl = document.getElementById('error');
    this.updatedEl = document.getElementById('last-updated');
    this.init();
  }

  async init() {
    try {
      const data = await this.loadData();
      if (data) {
        this.hideLoading();
        this.renderRepositories(data.repos);
        this.showLastUpdated(data.fetchedAt);
      }
    } catch (err) {
      console.error('Failed to load:', err);
      this.showError();
    }
  }

  // Try static JSON first, fall back to live API
  async loadData() {
    try {
      const res = await fetch(STATIC_DATA_URL);
      if (res.ok) {
        console.log('Loaded pre-built static data');
        return await res.json();
      }
    } catch (_) { /* static file not available */ }

    console.log('Static data unavailable — falling back to GitHub API');
    return await this.fetchFromAPI();
  }

  async fetchFromAPI() {
    const res = await fetch(
      `${API_BASE}/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=100`
    );
    if (res.status === 403) {
      this.showError('GitHub API rate limit exceeded. Data will refresh soon.');
      return null;
    }
    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const repos = await res.json();
    const filtered = repos
      .filter(r => !r.fork && !r.archived && r.name !== `${GITHUB_USERNAME}.github.io`)
      .sort((a, b) => b.stargazers_count - a.stargazers_count || new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 12);

    // Attempt language fetch (best-effort)
    const enriched = await Promise.all(filtered.map(async (repo) => {
      try {
        const lr = await fetch(`${API_BASE}/repos/${GITHUB_USERNAME}/${repo.name}/languages`);
        if (lr.ok) {
          const langs = await lr.json();
          const total = Object.values(langs).reduce((a, b) => a + b, 0);
          repo.allLanguages = Object.entries(langs)
            .map(([name, bytes]) => ({
              name, bytes,
              percentage: total > 0 ? ((bytes / total) * 100).toFixed(1) : 0,
              color: getLanguageColor(name)
            }))
            .sort((a, b) => b.bytes - a.bytes);
        }
      } catch (_) { /* skip */ }
      return {
        name: repo.name,
        description: repo.description || 'No description available',
        html_url: repo.html_url,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        topics: repo.topics || [],
        updated_at: repo.updated_at,
        allLanguages: repo.allLanguages || []
      };
    }));

    return { fetchedAt: new Date().toISOString(), username: GITHUB_USERNAME, repos: enriched };
  }

  // ── Rendering ─────────────────────────────────────────────────

  renderRepositories(repos) {
    if (!repos.length) { this.showError('No repositories found'); return; }

    // Cards with long descriptions get the wider "featured" size
    // ~120 chars is roughly what fits in 3 lines at default card width
    const DESC_THRESHOLD = 120;
    this.gridEl.innerHTML = repos.map((repo, i) => {
      const featured = (repo.description || '').length > DESC_THRESHOLD;
      const neon = NEON_COLORS[i % NEON_COLORS.length];
      return this.createCard(repo, featured, neon, i);
    }).join('');

    // Intersection Observer for staggered fade-in
    this.observeCards();
  }

  createCard(repo, featured, neonColor, index) {
    const langs = (repo.allLanguages || []).slice(0, 4);
    const topics = (repo.topics || []).slice(0, 4);

    return `
      <article
        class="card${featured ? ' card--featured' : ''}"
        style="--neon: ${neonColor}; --delay: ${index * 0.08}s"
        data-animate
      >
        <div class="card__inner">
          <div class="card__header">
            <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer" class="card__name">
              ${repo.name}
            </a>
            ${repo.stargazers_count > 0 ? `<span class="card__stars">★ ${repo.stargazers_count}</span>` : ''}
          </div>

          <p class="card__desc">${repo.description}</p>

          ${langs.length > 0 ? `
            <div class="card__langs">
              ${langs.map(l => `
                <span class="lang" style="--lang-color: ${l.color}">
                  <span class="lang__dot" style="background: ${l.color}"></span>
                  ${l.name} <span class="lang__pct">${l.percentage}%</span>
                </span>
              `).join('')}
            </div>
          ` : repo.language ? `
            <div class="card__langs">
              <span class="lang" style="--lang-color: ${getLanguageColor(repo.language)}">
                <span class="lang__dot" style="background: ${getLanguageColor(repo.language)}"></span>
                ${repo.language}
              </span>
            </div>
          ` : ''}

          ${topics.length > 0 ? `
            <div class="card__topics">
              ${topics.map(t => `<span class="topic">${t}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      </article>
    `;
  }

  observeCards() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('card--visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));
  }

  showLastUpdated(isoDate) {
    if (!this.updatedEl || !isoDate) return;
    const d = new Date(isoDate);
    this.updatedEl.textContent = `Last updated ${d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    })}`;
  }

  hideLoading() { this.loadingEl.style.display = 'none'; }

  showError(msg = 'Unable to load repositories') {
    this.loadingEl.style.display = 'none';
    this.errorEl.style.display = 'block';
    this.errorEl.querySelector('p').textContent = msg;
  }
}

// ── Boot ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  new GitHubShowcase();
});
