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

const DESC_THRESHOLD = 120;

// ── Sparkline SVG Generator ───────────────────────────────────────

function renderSparkline(weeks) {
  const w = 200, h = 40, pad = 2;

  // If no data or all zeros, render a flatline
  if (!weeks || weeks.length === 0 || !weeks.some(v => v > 0)) {
    const y = h - pad;
    return `
      <svg class="sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        <line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" stroke="currentColor" stroke-width="1" class="sparkline__flat"/>
      </svg>
    `;
  }

  const max = Math.max(...weeks, 1);
  const pts = weeks.map((v, i) => ({
    x: pad + (i / (weeks.length - 1)) * (w - pad * 2),
    y: h - pad - (v / max) * (h - pad * 2)
  }));

  // Build smooth cubic bezier path (monotone spline)
  const d = smoothPath(pts);

  // Area fill: path → bottom-right → bottom-left → close
  const last = pts[pts.length - 1];
  const first = pts[0];
  const areaD = `${d} L ${last.x.toFixed(1)},${(h - pad).toFixed(1)} L ${first.x.toFixed(1)},${(h - pad).toFixed(1)} Z`;

  return `
    <svg class="sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <path class="sparkline__area" d="${areaD}" fill="currentColor"/>
      <path class="sparkline__line" d="${d}" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

// Monotone cubic Hermite spline for smooth, overshoot-free curves
function smoothPath(pts) {
  if (pts.length < 2) return `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;

  // Compute tangent slopes (monotone method)
  const n = pts.length;
  const dx = [], dy = [], m = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    dy.push(pts[i + 1].y - pts[i].y);
    m.push(dy[i] / dx[i]);
  }

  const tangents = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) tangents.push(0);
    else tangents.push(2 / (1 / m[i - 1] + 1 / m[i]));
  }
  tangents.push(m[n - 2]);

  // Build cubic segments
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const seg = dx[i] / 3;
    const cp1x = pts[i].x + seg;
    const cp1y = pts[i].y + tangents[i] * seg;
    const cp2x = pts[i + 1].x - seg;
    const cp2y = pts[i + 1].y - tangents[i + 1] * seg;
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${pts[i + 1].x.toFixed(1)},${pts[i + 1].y.toFixed(1)}`;
  }
  return d;
}

// ── Main Application ──────────────────────────────────────────────

class GitHubShowcase {
  constructor() {
    this.gridEl = document.getElementById('repos-grid');
    this.loadingEl = document.getElementById('loading');
    this.errorEl = document.getElementById('error');
    this.updatedEl = document.getElementById('last-updated');
    this.toolbarEl = document.getElementById('toolbar');
    this.allRepos = [];
    this.currentSort = 'stars';
    this.activeLanguages = new Set();
    this.expandedCard = null;
    this.init();
  }

  async init() {
    try {
      const data = await this.loadData();
      if (data) {
        this.allRepos = data.repos;
        this.hideLoading();
        this.buildToolbar();
        this.renderCards();
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
        allLanguages: repo.allLanguages || [],
        weeklyCommits: [],
        readmeHtml: ''
      };
    }));

    return { fetchedAt: new Date().toISOString(), username: GITHUB_USERNAME, repos: enriched };
  }

  // ── Toolbar: Sort + Filter ────────────────────────────────────

  buildToolbar() {
    // Collect all unique languages across all repos
    const langSet = new Set();
    this.allRepos.forEach(r => {
      (r.allLanguages || []).forEach(l => langSet.add(l.name));
      if (r.language && !langSet.size) langSet.add(r.language);
    });
    const languages = [...langSet].sort();

    this.toolbarEl.innerHTML = `
      <div class="toolbar__sort">
        <button class="sort-btn sort-btn--active" data-sort="stars">Most starred</button>
        <button class="sort-btn" data-sort="updated">Recently updated</button>
        <button class="sort-btn" data-sort="alpha">A — Z</button>
      </div>
      <div class="toolbar__filter">
        <button class="filter-toggle" id="filter-toggle">
          <span class="filter-toggle__icon">⚙</span> Language
          <span class="filter-toggle__count" id="filter-count"></span>
        </button>
        <div class="filter-dropdown" id="filter-dropdown">
          ${languages.map(lang => `
            <label class="filter-option">
              <input type="checkbox" value="${lang}" class="filter-checkbox" />
              <span class="filter-dot" style="background: ${getLanguageColor(lang)}"></span>
              ${lang}
            </label>
          `).join('')}
          <button class="filter-clear" id="filter-clear">Clear all</button>
        </div>
      </div>
    `;
    this.toolbarEl.style.display = '';

    // Sort buttons
    this.toolbarEl.querySelectorAll('.sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.toolbarEl.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('sort-btn--active'));
        btn.classList.add('sort-btn--active');
        this.currentSort = btn.dataset.sort;
        this.renderCards();
      });
    });

    // Filter dropdown toggle
    const toggle = document.getElementById('filter-toggle');
    const dropdown = document.getElementById('filter-dropdown');
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('filter-dropdown--open');
    });
    document.addEventListener('click', () => dropdown.classList.remove('filter-dropdown--open'));
    dropdown.addEventListener('click', (e) => e.stopPropagation());

    // Filter checkboxes
    this.toolbarEl.querySelectorAll('.filter-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) this.activeLanguages.add(cb.value);
        else this.activeLanguages.delete(cb.value);
        this.updateFilterCount();
        this.renderCards();
      });
    });

    // Clear all filters
    document.getElementById('filter-clear').addEventListener('click', () => {
      this.activeLanguages.clear();
      this.toolbarEl.querySelectorAll('.filter-checkbox').forEach(c => c.checked = false);
      this.updateFilterCount();
      this.renderCards();
    });
  }

  updateFilterCount() {
    const el = document.getElementById('filter-count');
    if (this.activeLanguages.size > 0) {
      el.textContent = this.activeLanguages.size;
      el.style.display = 'inline-flex';
    } else {
      el.style.display = 'none';
    }
  }

  // ── Sort + Filter + Render ────────────────────────────────────

  getFilteredSortedRepos() {
    let repos = [...this.allRepos];

    // Filter by language
    if (this.activeLanguages.size > 0) {
      repos = repos.filter(r => {
        const repoLangs = (r.allLanguages || []).map(l => l.name);
        if (r.language) repoLangs.push(r.language);
        return repoLangs.some(l => this.activeLanguages.has(l));
      });
    }

    // Sort
    switch (this.currentSort) {
      case 'stars':
        repos.sort((a, b) => b.stargazers_count - a.stargazers_count || new Date(b.updated_at) - new Date(a.updated_at));
        break;
      case 'updated':
        repos.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        break;
      case 'alpha':
        repos.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return repos;
  }

  renderCards() {
    const repos = this.getFilteredSortedRepos();

    if (!repos.length) {
      this.gridEl.innerHTML = '<p class="no-results">No repos match the current filters.</p>';
      return;
    }

    this.gridEl.innerHTML = repos.map((repo, i) => {
      const neon = NEON_COLORS[i % NEON_COLORS.length];
      return this.createCard(repo, neon, i);
    }).join('');

    // Inject each README HTML separately via DOM to prevent
    // unclosed tags from leaking between cards
    for (const repo of repos) {
      if (repo.readmeHtml) {
        const el = this.gridEl.querySelector(`[data-readme-for="${repo.name}"]`);
        if (el) el.innerHTML = repo.readmeHtml;
      }
    }

    this.observeCards();
    this.bindCardClicks();
  }

  createCard(repo, neonColor, index) {
    const langs = (repo.allLanguages || []).slice(0, 6);
    const weeks = repo.weeklyCommits || [];
    const readmeHtml = repo.readmeHtml || '';
    const hasReadme = readmeHtml.length > 0;

    // Build language bar segments
    const langBar = langs.length > 0 ? `
      <div class="card__lang-bar">
        ${langs.map(l => `<div class="lang-bar__seg" style="width: ${l.percentage}%; background: ${l.color}" title="${l.name} ${l.percentage}%"></div>`).join('')}
      </div>
    ` : '';

    // Language bullets
    const langBullets = langs.length > 0 ? `
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
    ` : '';

    return `
      <article
        class="card${hasReadme ? ' card--expandable' : ''}"
        style="--neon: ${neonColor}; --delay: ${index * 0.08}s"
        data-animate
        data-repo="${repo.name}"
      >
        <div class="card__row">
          <div class="card__left">
            <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer" class="card__name" onclick="event.stopPropagation()">
              ${repo.name} <span class="card__arrow">↗</span>
            </a>
            <p class="card__desc">${repo.description}</p>
            ${langBar}
            ${langBullets}
          </div>
          <div class="card__right">
            <div class="card__sparkline">
              ${renderSparkline(weeks)}
            </div>
          </div>
        </div>

        ${hasReadme ? `
          <div class="card__readme">
            <div class="readme__label">README</div>
            <div class="readme__body markdown-body" data-readme-for="${repo.name}"></div>
            <a href="${repo.html_url}#readme" target="_blank" rel="noopener noreferrer" class="readme__more" onclick="event.stopPropagation()">Read more on GitHub &rarr;</a>
          </div>
        ` : ''}
      </article>
    `;
  }

  // ── Card click → expand README ────────────────────────────────

  bindCardClicks() {
    this.gridEl.querySelectorAll('.card--expandable').forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't expand if they clicked a link
        if (e.target.closest('a')) return;
        const name = card.dataset.repo;

        if (this.expandedCard === name) {
          card.classList.remove('card--expanded');
          this.expandedCard = null;
        } else {
          // Collapse previous
          this.gridEl.querySelectorAll('.card--expanded').forEach(c => c.classList.remove('card--expanded'));
          card.classList.add('card--expanded');
          this.expandedCard = name;
        }
      });
    });
  }

  // ── Observers + Helpers ───────────────────────────────────────

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
