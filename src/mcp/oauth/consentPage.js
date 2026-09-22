const { TRACKWEAVING_LOGO_SVG } = require('./brandAssets');

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderConsentPage({
    authRequestId,
    clientName,
    scopes,
    actionUrl,
    errorMessage = '',
    userNamePrefill = '',
}) {
    const scopeText = (scopes || []).map(escapeHtml).join(', ');
    const errorBlock = errorMessage
        ? `<div class="alert alert-danger" role="alert"><small>${escapeHtml(errorMessage)}</small></div>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>TrackWeaving — Sign In</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --tw-primary: #043a54;
      --tw-primary-hover: #032d42;
      --tw-accent: #5d8f4a;
      --tw-danger: #dc3545;
      --tw-muted: #6c757d;
      --tw-border: #dee2e6;
      --tw-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
    }
    * { box-sizing: border-box; }
    html, body {
      height: 100%;
      margin: 0;
      color-scheme: only light;
      background-color: #fff;
      font-family: 'Poppins', 'Helvetica Neue', Arial, sans-serif;
      color: #212529;
    }
    .page {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 100%;
      padding: 1rem;
    }
    .card {
      width: 100%;
      max-width: 420px;
      padding: 1rem 1rem 1.25rem;
      border-radius: 0.375rem;
      background: #fff;
      box-shadow: var(--tw-shadow);
    }
    .auth-header {
      text-align: center;
      margin-bottom: 0.5rem;
    }
    .brand-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
      margin-bottom: 0.5rem;
      svg {
        width: 60px;
        height: 60px;
      }
    }
    .brand-name {
      color: var(--tw-primary);
      font-size: 1.7rem;
      font-weight: 700;
      line-height: 1.2;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0.75rem 0 0.25rem;
    }
    .subtitle {
      font-size: 0.875rem;
      color: var(--tw-muted);
      margin: 0 0 1rem;
      line-height: 1.5;
    }
    .client-pill {
      display: inline-block;
      margin-top: 0.35rem;
      padding: 0.2rem 0.55rem;
      border-radius: 999px;
      background: rgba(4, 58, 84, 0.08);
      color: var(--tw-primary);
      font-size: 0.75rem;
      font-weight: 500;
    }
    .scopes {
      font-size: 0.75rem;
      color: var(--tw-muted);
      margin-bottom: 1rem;
    }
    .form-label {
      display: block;
      margin-bottom: 0.35rem;
      font-size: 0.875rem;
      font-weight: 400;
    }
    .text-danger { color: var(--tw-danger); }
    .mb-3 { margin-bottom: 1rem; }
    .form-control {
      display: block;
      width: 100%;
      padding: 0.375rem 0.75rem;
      font-size: 1rem;
      font-family: inherit;
      line-height: 1.5;
      color: #212529;
      background-color: #fff;
      border: 1px solid var(--tw-border);
      border-radius: 0.375rem;
      transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
    }
    .form-control::placeholder { color: #adb5bd; opacity: 1; }
    .form-control:focus {
      outline: 0;
      border-color: var(--tw-primary);
      box-shadow: 0 0 0 0.25rem rgba(4, 58, 84, 0.25);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 0.5rem 1rem;
      font-size: 1rem;
      font-weight: 500;
      font-family: inherit;
      line-height: 1.5;
      border: 1px solid transparent;
      border-radius: 0.375rem;
      cursor: pointer;
    }
    .btn-primary {
      background-color: var(--tw-primary);
      border-color: var(--tw-primary);
      color: #fff;
      margin-top: 0.5rem;
    }
    .btn-primary:hover { background-color: var(--tw-primary-hover); border-color: var(--tw-primary-hover); }
    .alert {
      padding: 0.65rem 0.85rem;
      margin-bottom: 1rem;
      border-radius: 0.375rem;
      border: 1px solid #f5c2c7;
      background-color: #f8d7da;
      color: #842029;
    }
  </style>
</head>
<body>
  <div class="page">
    <form class="card" method="POST" action="${escapeHtml(actionUrl)}" novalidate>
      <div class="auth-header">
        <div class="brand-row">
          ${TRACKWEAVING_LOGO_SVG}
          <span class="brand-name">TrackWeaving</span>
        </div>
        <h1>Sign In</h1>
        <p class="subtitle">
          Authorize <strong>${escapeHtml(clientName)}</strong> for read-only MCP access to your workspace.
          <span class="client-pill">AI assistant</span>
        </p>
      </div>
      ${errorBlock}
      <div class="scopes"><strong>Access scope:</strong> ${scopeText || 'mcp:read'}</div>
      <input type="hidden" name="authRequestId" value="${escapeHtml(authRequestId)}" />
      <div class="mb-3">
        <label class="form-label"><small>Username <span class="text-danger">*</span></small></label>
        <input type="text" class="form-control" name="userName" autocomplete="username" required
          placeholder="Enter username" value="${escapeHtml(userNamePrefill)}" />
      </div>
      <div class="mb-3">
        <label class="form-label"><small>Password <span class="text-danger">*</span></small></label>
        <input type="password" class="form-control" name="password" autocomplete="current-password" required
          placeholder="Enter your password" />
      </div>
      <button type="submit" class="btn btn-primary">Login</button>
    </form>
  </div>
</body>
</html>`;
}

module.exports = {
    renderConsentPage,
};
