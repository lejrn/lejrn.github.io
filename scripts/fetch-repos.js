#!/usr/bin/env node

/**
 * Build-time script to fetch GitHub repositories and save as static JSON.
 * Runs once per build (weekly via GitHub Actions cron).
 * This way visitors never hit the GitHub API — they load pre-fetched data.
 */

const GITHUB_USERNAME = 'lejrn';
const API_BASE = 'https://api.github.com';
const OUTPUT_PATH = './public/data/repos.json';

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
  Sass: '#a53b70',
  R: '#198ce7',
  Perl: '#0298c3',
  Lua: '#000080',
  Elixir: '#6e4a7e',
  Haskell: '#5e5086',
  Scala: '#c22d40',
  PowerShell: '#012456',
  Makefile: '#427819',
  default: '#586069'
};

import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const headers = { 'User-Agent': 'github-pages-builder' };
      // Use GITHUB_TOKEN if available (higher rate limit: 5000/hr vs 60/hr)
      if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
      }
      const response = await fetch(url, { headers });
      if (response.status === 403) {
        console.error(`Rate limited on attempt ${i + 1}. Waiting 10s...`);
        await new Promise(r => setTimeout(r, 10000));
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return await response.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`Attempt ${i + 1} failed: ${err.message}. Retrying...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function fetchRepos() {
  console.log(`Fetching repositories for ${GITHUB_USERNAME}...`);

  const repos = await fetchWithRetry(
    `${API_BASE}/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=100`
  );

  // Filter: no forks, no archived, exclude the page repo itself
  const filtered = repos
    .filter(repo => !repo.fork && !repo.archived && repo.name !== `${GITHUB_USERNAME}.github.io`)
    .sort((a, b) => {
      if (b.stargazers_count !== a.stargazers_count) {
        return b.stargazers_count - a.stargazers_count;
      }
      return new Date(b.updated_at) - new Date(a.updated_at);
    })
    .slice(0, 12);

  console.log(`Found ${filtered.length} repositories (from ${repos.length} total)`);

  // Fetch languages for each repo
  const reposWithData = await Promise.all(
    filtered.map(async (repo) => {
      let allLanguages = [];
      try {
        const languages = await fetchWithRetry(
          `${API_BASE}/repos/${GITHUB_USERNAME}/${repo.name}/languages`
        );
        const totalBytes = Object.values(languages).reduce((a, b) => a + b, 0);
        allLanguages = Object.entries(languages)
          .map(([name, bytes]) => ({
            name,
            bytes,
            percentage: totalBytes > 0 ? ((bytes / totalBytes) * 100).toFixed(1) : 0,
            color: LANGUAGE_COLORS[name] || LANGUAGE_COLORS.default
          }))
          .sort((a, b) => b.bytes - a.bytes);
      } catch (err) {
        console.warn(`Could not fetch languages for ${repo.name}: ${err.message}`);
      }

      return {
        name: repo.name,
        description: repo.description || 'No description available',
        html_url: repo.html_url,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        topics: repo.topics || [],
        updated_at: repo.updated_at,
        private: repo.private,
        allLanguages
      };
    })
  );

  return reposWithData;
}

async function main() {
  try {
    const repos = await fetchRepos();

    const output = {
      fetchedAt: new Date().toISOString(),
      username: GITHUB_USERNAME,
      repos
    };

    // Ensure output directory exists
    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

    console.log(`Successfully wrote ${repos.length} repos to ${OUTPUT_PATH}`);
    console.log(`Data fetched at: ${output.fetchedAt}`);
  } catch (error) {
    console.error('Failed to fetch repositories:', error);
    process.exit(1);
  }
}

main();
