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

async function fetchWithRetry(url, retries = 3, raw = false) {
  for (let i = 0; i < retries; i++) {
    try {
      const headers = { 'User-Agent': 'github-pages-builder' };
      if (raw) headers['Accept'] = 'application/vnd.github.v3.raw';
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
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      if (raw) return await response.text();
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
        allLanguages,
        ...(await fetchExtras(repo.name, repo.created_at))
      };
    })
  );

  return reposWithData;
}

// Fetch full-lifetime commit sparkline and README excerpt per repo
async function fetchExtras(repoName, createdAt) {
  const extras = { weeklyCommits: [], readmeExcerpt: '' };

  // Contributors stats — full repo lifetime weekly commits for the owner
  // Note: GitHub returns 202 Accepted on first request while computing stats.
  // We must retry after a delay to get the actual data.
  try {
    let contributors = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const headers = { 'User-Agent': 'github-pages-builder' };
      if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
      }
      const res = await fetch(
        `${API_BASE}/repos/${GITHUB_USERNAME}/${repoName}/stats/contributors`,
        { headers }
      );
      if (res.status === 200) {
        contributors = await res.json();
        break;
      } else if (res.status === 202) {
        console.log(`  Stats computing for ${repoName}, retrying in 5s... (${attempt + 1}/8)`);
        await new Promise(r => setTimeout(r, 5000));
      } else {
        break;
      }
    }
    if (Array.isArray(contributors) && contributors.length > 0) {
      // Try to find the owner first
      const owner = contributors.find(
        c => c.author && c.author.login.toLowerCase() === GITHUB_USERNAME.toLowerCase()
      );
      if (owner && owner.weeks) {
        extras.weeklyCommits = owner.weeks.map(w => w.c);
      } else {
        // Owner not linked — sum all contributors' weekly commits
        const weekCount = contributors[0].weeks.length;
        const summed = new Array(weekCount).fill(0);
        for (const c of contributors) {
          if (c.weeks) {
            c.weeks.forEach((w, i) => { summed[i] += w.c; });
          }
        }
        extras.weeklyCommits = summed;
      }
    }
  } catch (err) {
    console.warn(`  Sparkline data unavailable for ${repoName}: ${err.message}`);
  }

  // Fallback: if /stats/contributors didn't yield data, use /commits API
  if (extras.weeklyCommits.length === 0 || extras.weeklyCommits.every(c => c === 0)) {
    try {
      console.log(`  Using /commits fallback for ${repoName}...`);
      const allCommits = await fetchAllCommits(repoName);
      if (allCommits.length > 0) {
        extras.weeklyCommits = bucketCommitsByWeek(allCommits, createdAt);
        console.log(`  Fallback: ${allCommits.length} commits → ${extras.weeklyCommits.length} weeks`);
      }
    } catch (err) {
      console.warn(`  /commits fallback failed for ${repoName}: ${err.message}`);
    }
  }

  // README raw text — grab first ~300 chars
  try {
    const raw = await fetchWithRetry(
      `${API_BASE}/repos/${GITHUB_USERNAME}/${repoName}/readme`,
      2,
      true
    );
    if (raw) {
      // Strip markdown formatting to plain text
      const cleaned = raw
        .replace(/\[!\[.*?\]\(.*?\)\]\(.*?\)/g, '') // badge links (before images)
        .replace(/!\[.*?\]\(.*?\)/g, '')       // images
        .replace(/<[^>]+>/g, '')               // HTML tags
        .replace(/#{1,6}\s*/g, '')             // headings
        .replace(/\*\*|__|~~|`{1,3}/g, '')     // bold/italic/code
        .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1') // links → text (incl. empty [])
        .replace(/https?:\/\/\S+/g, '')        // bare URLs
        .replace(/\n{2,}/g, '\n')             // collapse blank lines
        .trim();
      extras.readmeExcerpt = cleaned.slice(0, 300);
    }
  } catch (err) {
    console.warn(`  README unavailable for ${repoName}: ${err.message}`);
  }

  return extras;
}

// Fetch all commits via paginated /commits API (up to 500)
async function fetchAllCommits(repoName) {
  const commits = [];
  let page = 1;
  const perPage = 100;
  const maxPages = 5; // cap at 500 commits
  while (page <= maxPages) {
    const url = `${API_BASE}/repos/${GITHUB_USERNAME}/${repoName}/commits?per_page=${perPage}&page=${page}`;
    const batch = await fetchWithRetry(url);
    if (!Array.isArray(batch) || batch.length === 0) break;
    commits.push(...batch);
    if (batch.length < perPage) break;
    page++;
  }
  return commits;
}

// Bucket commits by ISO week → array of weekly counts (oldest first)
// Spans from repo creation date to now (like /stats/contributors does)
function bucketCommitsByWeek(commits, createdAt) {
  if (commits.length === 0) return [];
  // Extract dates (author date preferred, fall back to committer date)
  const dates = commits.map(c => {
    const d = c.commit?.author?.date || c.commit?.committer?.date;
    return d ? new Date(d) : null;
  }).filter(Boolean);
  if (dates.length === 0) return [];

  // Span from repo creation (or earliest commit) to now
  const earliestCommit = new Date(Math.min(...dates));
  const minDate = createdAt ? new Date(Math.min(new Date(createdAt), earliestCommit)) : earliestCommit;
  const maxDate = new Date(); // now, not last commit

  // Align minDate to start of its week (Sunday)
  const startOfWeek = new Date(minDate);
  startOfWeek.setUTCHours(0, 0, 0, 0);
  startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfWeek.getUTCDay());

  // Calculate total weeks
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const totalWeeks = Math.ceil((maxDate - startOfWeek) / msPerWeek) + 1;
  const weeks = new Array(totalWeeks).fill(0);

  for (const d of dates) {
    const weekIdx = Math.floor((d - startOfWeek) / msPerWeek);
    if (weekIdx >= 0 && weekIdx < totalWeeks) {
      weeks[weekIdx]++;
    }
  }
  return weeks;
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
