const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVIEWS_BASE_URL = 'https://mybusiness.googleapis.com/v4';

let cachedToken = null;

function hasReviewConfig() {
  return Boolean(
    (process.env.GOOGLE_BUSINESS_ACCESS_TOKEN || (
      process.env.GOOGLE_BUSINESS_CLIENT_ID
      && process.env.GOOGLE_BUSINESS_CLIENT_SECRET
      && process.env.GOOGLE_BUSINESS_REFRESH_TOKEN
    ))
    && process.env.GOOGLE_BUSINESS_ACCOUNT_ID
    && process.env.GOOGLE_BUSINESS_LOCATION_ID
  );
}

async function getAccessToken() {
  if (process.env.GOOGLE_BUSINESS_ACCESS_TOKEN) {
    return process.env.GOOGLE_BUSINESS_ACCESS_TOKEN;
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.accessToken;
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_BUSINESS_CLIENT_ID,
    client_secret: process.env.GOOGLE_BUSINESS_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_BUSINESS_REFRESH_TOKEN,
    grant_type: 'refresh_token'
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || 'Unable to refresh Google access token.');
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3300) * 1000
  };
  return cachedToken.accessToken;
}

function normalizeReview(review) {
  const reviewer = review.reviewer || {};
  return {
    id: review.reviewId || review.name,
    name: reviewer.displayName || 'Google user',
    profilePhotoUrl: reviewer.profilePhotoUrl || '',
    starRating: review.starRating || '',
    comment: review.comment || '',
    createTime: review.createTime || '',
    updateTime: review.updateTime || '',
    reply: review.reviewReply?.comment || ''
  };
}

export async function listGoogleReviews() {
  if (!hasReviewConfig()) {
    return {
      configured: false,
      reviews: [],
      averageRating: null,
      totalReviewCount: 0
    };
  }

  const accessToken = await getAccessToken();
  const accountId = encodeURIComponent(process.env.GOOGLE_BUSINESS_ACCOUNT_ID);
  const locationId = encodeURIComponent(process.env.GOOGLE_BUSINESS_LOCATION_ID);
  const pageSize = Math.min(Number(process.env.GOOGLE_BUSINESS_REVIEW_PAGE_SIZE || 8), 50);
  const url = new URL(`${GOOGLE_REVIEWS_BASE_URL}/accounts/${accountId}/locations/${locationId}/reviews`);
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.set('orderBy', 'updateTime desc');

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Unable to fetch Google reviews.');
  }

  return {
    configured: true,
    reviews: (data.reviews || []).map(normalizeReview),
    averageRating: data.averageRating ?? null,
    totalReviewCount: data.totalReviewCount || 0,
    nextPageToken: data.nextPageToken || null
  };
}
