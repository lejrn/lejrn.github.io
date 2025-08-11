import './style.css'

// Configuration - Update this with your GitHub username
const GITHUB_USERNAME = 'lejrn'; // Replace with your actual GitHub username
const API_BASE = 'https://api.github.com';

// Language colors mapping (popular languages)
const LANGUAGE_COLORS = {
  JavaScript: '#f1e05a',
  TypeScript: '#2b7489',
  Python: '#3572A5',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#239120',
  PHP: '#4F5D95',
  Ruby: '#701516',
  Go: '#00ADD8',
  Rust: '#dea584',
  Swift: '#ffac45',
  Kotlin: '#F18E33',
  Dart: '#00B4AB',
  HTML: '#e34c26',
  CSS: '#1572B6',
  Vue: '#4FC08D',
  React: '#61DAFB',
  Shell: '#89e051',
  Dockerfile: '#384d54',
  SCSS: '#c6538c',
  Less: '#1d365d',
  Sass: '#a53b70',
  JSON: '#292929',
  YAML: '#cb171e',
  XML: '#0060ac',
  Markdown: '#083fa1',
  R: '#198ce7',
  Perl: '#0298c3',
  Lua: '#000080',
  Elixir: '#6e4a7e',
  Erlang: '#B83998',
  Haskell: '#5e5086',
  Scala: '#c22d40',
  Clojure: '#db5855',
  Objective: '#438eff',
  PowerShell: '#012456',
  Vim: '#199f4b',
  Assembly: '#6E4C13',
  Makefile: '#427819',
  CMake: '#DA3434',
  default: '#586069'
};

// Simple language icon (colored dot)
const getLanguageIcon = (language) => {
  const color = LANGUAGE_COLORS[language] || LANGUAGE_COLORS.default;
  return `<span class="language-dot" style="background-color: ${color}"></span>`;
};

// Utility functions
const formatNumber = (num) => {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
};

// Main application class
class GitHubRepoShowcase {
  constructor() {
    this.loadingEl = document.getElementById('loading');
    this.errorEl = document.getElementById('error');
    this.gridEl = document.getElementById('repos-grid');
    this.init();
  }

  async init() {
    try {
      await this.loadRepositories();
    } catch (error) {
      console.error('Failed to load repositories:', error);
      this.showError();
    }
  }

  async loadRepositories() {
    console.log('Loading repositories for:', GITHUB_USERNAME);
    
    try {
      const response = await fetch(`${API_BASE}/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=50`);
      console.log('API response status:', response.status);
      
      if (response.status === 403) {
        // Rate limit exceeded
        this.showError('GitHub API rate limit exceeded. Please try again in about an hour.');
        return;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        
        if (response.status === 404) {
          this.showError(`GitHub user "${GITHUB_USERNAME}" not found. Please check the username in main.js`);
          return;
        }
        
        throw new Error(`GitHub API responded with status: ${response.status}`);
      }

      const repos = await response.json();
      console.log('Fetched repositories:', repos.length);
      
      // Filter and sort repositories
      const filteredRepos = repos
        .filter(repo => !repo.fork && !repo.archived) // Only original, non-archived repos
        .sort((a, b) => {
          // Sort by stars, then by last updated
          if (b.stargazers_count !== a.stargazers_count) {
            return b.stargazers_count - a.stargazers_count;
          }
          return new Date(b.updated_at) - new Date(a.updated_at);
        })
        .slice(0, 12); // Show top 12 repositories

      console.log('Filtered repositories:', filteredRepos.length);

      if (filteredRepos.length === 0) {
        this.showError('No public repositories found for this user.');
        return;
      }

      // Try to fetch languages, but don't fail if we can't
      const reposWithLanguages = await this.fetchLanguagesForRepos(filteredRepos);

      this.hideLoading();
      this.renderRepositories(reposWithLanguages);
    } catch (error) {
      console.error('Error loading repositories:', error);
      this.showError('Unable to load repositories. Please check your internet connection and try again.');
    }
  }

  async fetchLanguagesForRepos(repos) {
    const repoPromises = repos.map(async (repo) => {
      try {
        const langResponse = await fetch(`${API_BASE}/repos/${GITHUB_USERNAME}/${repo.name}/languages`);
        
        if (langResponse.status === 403) {
          // Rate limit hit, just use the primary language
          console.warn(`Rate limit hit for languages of ${repo.name}, using primary language only`);
          return repo;
        }
        
        if (langResponse.ok) {
          const languages = await langResponse.json();
          // Convert to array and sort by bytes of code
          const languageArray = Object.entries(languages)
            .map(([name, bytes]) => ({ name, bytes }))
            .sort((a, b) => b.bytes - a.bytes);
          
          return {
            ...repo,
            allLanguages: languageArray
          };
        }
        return repo; // Return original repo if language fetch fails
      } catch (error) {
        console.warn(`Failed to fetch languages for ${repo.name}:`, error);
        return repo; // Return original repo if language fetch fails
      }
    });

    return Promise.all(repoPromises);
  }

  renderRepositories(repos) {
    if (repos.length === 0) {
      this.showError('No repositories found');
      return;
    }

    this.gridEl.innerHTML = repos.map(repo => this.createRepoCard(repo)).join('');
  }

  createRepoCard(repo) {
    const description = repo.description || 'No description available';
    const topics = repo.topics || [];
    const allLanguages = repo.allLanguages || [];
    
    // Calculate total bytes and percentages
    const totalBytes = allLanguages.reduce((sum, lang) => sum + lang.bytes, 0);
    const languagesWithPercentages = allLanguages.map(lang => ({
      ...lang,
      percentage: totalBytes > 0 ? ((lang.bytes / totalBytes) * 100).toFixed(1) : 0
    }));
    
    // Show top 5 languages by bytes of code
    const topLanguages = languagesWithPercentages.slice(0, 5);
    
    return `
      <article class="repo-card">
        <header class="repo-card__header">
          <div>
            <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer" class="repo-card__title">
              ${repo.name}
            </a>
          </div>
          <span class="repo-card__visibility">${repo.private ? 'Private' : 'Public'}</span>
        </header>
        
        <p class="repo-card__description">${description}</p>
        
        <div class="repo-card__meta">
          ${topLanguages.length > 0 ? `
            <div class="repo-card__languages">
              <div class="languages-label">Tech Stack</div>
              <div class="languages-list">
                ${topLanguages.map(lang => `
                  <div class="language-item">
                    <span class="language-icon">${getLanguageIcon(lang.name)}</span>
                    <span class="language-name">${lang.name}</span>
                    <span class="language-percentage">${lang.percentage}%</span>
                  </div>
                `).join('')}
                ${allLanguages.length > 5 ? `
                  <div class="language-item language-more">
                    <span class="language-name">+${allLanguages.length - 5} more</span>
                  </div>
                ` : ''}
              </div>
            </div>
          ` : repo.language ? `
            <div class="repo-card__languages">
              <div class="languages-label">Tech Stack</div>
              <div class="languages-list">
                <div class="language-item">
                  <span class="language-icon">${getLanguageIcon(repo.language)}</span>
                  <span class="language-name">${repo.language}</span>
                  <span class="language-percentage">100%</span>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
        
        ${topics.length > 0 ? `
          <div class="repo-card__topics">
            ${topics.slice(0, 5).map(topic => `<span class="topic">${topic}</span>`).join('')}
          </div>
        ` : ''}
      </article>
    `;
  }

  hideLoading() {
    this.loadingEl.style.display = 'none';
  }

  showError(message = 'Unable to load repositories') {
    this.loadingEl.style.display = 'none';
    this.errorEl.style.display = 'block';
    
    // Update error message if a custom one is provided
    const errorTitle = this.errorEl.querySelector('h2');
    const errorText = this.errorEl.querySelector('p');
    
    if (message.includes('rate limit')) {
      errorTitle.textContent = 'Rate Limit Exceeded';
      errorText.textContent = 'GitHub API rate limit exceeded. Please try again in about an hour.';
    } else if (message.includes('not found')) {
      errorTitle.textContent = 'User Not Found';
      errorText.textContent = message;
    } else if (message.includes('No public repositories')) {
      errorTitle.textContent = 'No Repositories';
      errorText.textContent = message;
    } else {
      errorTitle.textContent = 'Unable to Load Repositories';
      errorText.textContent = message || 'Please check your internet connection and try again.';
    }
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Check if GitHub username is set
  if (GITHUB_USERNAME === 'YOUR_USERNAME') {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    document.getElementById('error').innerHTML = `
      <h2>Configuration Required</h2>
      <p>Please update the GITHUB_USERNAME constant in main.js with your actual GitHub username.</p>
    `;
    return;
  }

  new GitHubRepoShowcase();
});
