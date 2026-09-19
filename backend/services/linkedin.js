// LinkedIn client. Sign in uses OpenID Connect. Sharing uses the Share on LinkedIn product.
// Every function returns plain data or throws an error with an http status.
const authorizeUrl = 'https://www.linkedin.com/oauth/v2/authorization';
const tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';
const userInfoUrl = 'https://api.linkedin.com/v2/userinfo';
const postsUrl = 'https://api.linkedin.com/v2/ugcPosts';

function config() {
  return {
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    redirectUri: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3000/auth/linkedin/callback'
  };
}

function isConfigured() {
  const { clientId, clientSecret } = config();
  return Boolean(clientId && clientSecret);
}

function apiError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Professors also ask for posting rights so they can share an opening later.
function scopesFor(role) {
  const scopes = ['openid', 'profile', 'email'];
  if (role === 'professor') scopes.push('w_member_social');
  return scopes;
}

function authorizationUrl(state, role) {
  const { clientId, redirectUri } = config();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: scopesFor(role).join(' ')
  });
  return `${authorizeUrl}?${params}`;
}

async function exchangeCode(code) {
  const { clientId, clientSecret, redirectUri } = config();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri
  });
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response.ok) throw apiError(502, `LinkedIn token exchange failed with status ${response.status}`);
  const data = await response.json();
  return { accessToken: data.access_token, expiresIn: Number(data.expires_in || 0), scope: data.scope || '' };
}

async function getUserInfo(accessToken) {
  const response = await fetch(userInfoUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw apiError(502, `LinkedIn userinfo failed with status ${response.status}`);
  const data = await response.json();
  return { id: data.sub, name: data.name, email: data.email };
}

// Posts a text share with a link back to the opening. Returns the LinkedIn post id.
async function shareOpening(accessToken, linkedinId, text, url) {
  const body = {
    author: `urn:li:person:${linkedinId}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'ARTICLE',
        media: [{ status: 'READY', originalUrl: url }]
      }
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
  };
  const response = await fetch(postsUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw apiError(502, `LinkedIn share failed with status ${response.status}`);
  return response.headers.get('x-restli-id');
}

module.exports = { isConfigured, authorizationUrl, exchangeCode, getUserInfo, shareOpening };
