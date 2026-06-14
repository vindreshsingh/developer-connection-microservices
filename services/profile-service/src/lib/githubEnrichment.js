import { apiGet } from './apiRequest.js';

// Ported from the monolith (backend/src/services/GitHubEnrichmentService.js).
const HOST = 'api.github.com';
const HEADERS = (token) => ({
  Authorization: `Bearer ${token}`,
  'User-Agent': 'developer-connection',
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

export class GitHubEnrichmentService {
  constructor(accessToken) {
    this._token = accessToken;
  }

  async fetchProfile() {
    const data = await apiGet(HOST, '/user', HEADERS(this._token));
    return {
      username: data.login,
      avatarUrl: data.avatar_url || null,
      profileUrl: data.html_url || null,
    };
  }

  async fetchContributions(username) {
    try {
      const events = await apiGet(HOST, `/users/${username}/events/public?per_page=100`, HEADERS(this._token));
      return Array.isArray(events) ? events.length : 0;
    } catch {
      return 0;
    }
  }

  async sync() {
    const profile = await this.fetchProfile();
    const allRepos = await apiGet(HOST, '/user/repos?sort=stars&per_page=20&type=owner', HEADERS(this._token));

    const topRepos = allRepos.slice(0, 6).map((r) => ({
      name: r.name,
      url: r.html_url,
      stars: r.stargazers_count ?? 0,
      language: r.language || null,
    }));

    const langCounts = {};
    for (const r of allRepos) {
      if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1;
    }
    const topLanguages = Object.entries(langCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([lang]) => lang);

    const contributionsLastYear = await this.fetchContributions(profile.username);

    return { ...profile, topRepos, topLanguages, contributionsLastYear, syncedAt: new Date() };
  }
}
