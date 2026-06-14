import { apiGet } from './apiRequest.js';

// Ported from the monolith (backend/src/services/LinkedInEnrichmentService.js).
const HOST = 'api.linkedin.com';
const HEADERS = (token) => ({
  Authorization: `Bearer ${token}`,
  'X-Restli-Protocol-Version': '2.0.0',
});

export class LinkedInEnrichmentService {
  constructor(accessToken) {
    this._token = accessToken;
  }

  async fetchProfile() {
    const data = await apiGet(
      HOST,
      '/v2/me?projection=(id,localizedFirstName,localizedLastName,headline,profilePicture(displayImage~:playableStreams),vanityName)',
      HEADERS(this._token),
    );

    const headline = data.headline?.localized
      ? Object.values(data.headline.localized)[0] || null
      : typeof data.headline === 'string'
        ? data.headline
        : null;

    const vanityName = data.vanityName || null;
    const profileUrl = vanityName ? `https://www.linkedin.com/in/${vanityName}` : null;

    return { headline: headline || null, profileUrl: profileUrl || null };
  }

  async fetchCurrentPosition() {
    try {
      const data = await apiGet(
        HOST,
        '/v2/positions?q=members&projection=(elements*(title,companyName,timePeriod(startDate,endDate)))',
        HEADERS(this._token),
      );

      const elements = data.elements || [];
      const current = elements.find((e) => !e.timePeriod?.endDate);
      if (!current) return { jobTitle: null, company: null };

      return { jobTitle: current.title || null, company: current.companyName || null };
    } catch {
      return { jobTitle: null, company: null };
    }
  }

  async sync() {
    const [profile, position] = await Promise.all([this.fetchProfile(), this.fetchCurrentPosition()]);

    return {
      headline: profile.headline || null,
      company: position.company || null,
      jobTitle: position.jobTitle || null,
      profileUrl: profile.profileUrl || null,
      syncedAt: new Date(),
    };
  }
}
