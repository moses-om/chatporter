/**
 * ChatPorter — In-Memory ChatGPT Share Link Extractor
 */

// Application State
let currentConversation = null;
let activeFilter = 'all';
let searchQuery = '';

// DOM Elements
const extractForm = document.getElementById('extractForm');
const urlInput = document.getElementById('urlInput');
const pasteBtn = document.getElementById('pasteBtn');
const extractBtn = document.getElementById('extractBtn');

const loadingSection = document.getElementById('loadingSection');
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const loadingStatusText = document.getElementById('loadingStatusText');

const errorSection = document.getElementById('errorSection');
const errorMessage = document.getElementById('errorMessage');
const dismissErrorBtn = document.getElementById('dismissErrorBtn');

const resultsSection = document.getElementById('resultsSection');
const platformBadge = document.getElementById('platformBadge');
const convTitle = document.getElementById('convTitle');
const convDate = document.getElementById('convDate');
const convTurnsCount = document.getElementById('convTurnsCount');
const convWordsCount = document.getElementById('convWordsCount');
const convOriginalLink = document.getElementById('convOriginalLink');

const exportTxtBtn = document.getElementById('exportTxtBtn');
const exportMdBtn = document.getElementById('exportMdBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const copyMdBtn = document.getElementById('copyMdBtn');
const copyBtnText = document.getElementById('copyBtnText');

const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const filterTabs = document.querySelectorAll('.filter-tab');
const allCount = document.getElementById('allCount');
const userCount = document.getElementById('userCount');
const assistantCount = document.getElementById('assistantCount');

const turnsFeed = document.getElementById('turnsFeed');
const toast = document.getElementById('toast');

// Initialize Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Form submission
  extractForm.addEventListener('submit', handleExtractSubmit);

  // Paste clipboard
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        urlInput.value = text.trim();
        urlInput.focus();
        showToast('Pasted link from clipboard');
      }
    } catch (e) {
      urlInput.focus();
    }
  });

  // Error dismiss
  dismissErrorBtn.addEventListener('click', () => {
    errorSection.classList.add('hidden');
  });

  // Export Buttons
  exportTxtBtn.addEventListener('click', () => downloadConversation('txt'));
  exportMdBtn.addEventListener('click', () => downloadConversation('md'));
  exportJsonBtn.addEventListener('click', () => downloadConversation('json'));
  copyMdBtn.addEventListener('click', copyMarkdownToClipboard);

  // Search & Filter
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    clearSearchBtn.classList.toggle('hidden', searchQuery.length === 0);
    renderTurns();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    renderTurns();
  });

  filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      filterTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilter = tab.getAttribute('data-filter');
      renderTurns();
    });
  });
});

/**
 * Handle form submit
 */
async function handleExtractSubmit(e) {
  e.preventDefault();
  const url = urlInput.value.trim();
  if (!url) return;
  await handleExtract(url);
}

/**
 * Main Extraction Trigger
 */
async function handleExtract(url) {
  hideError();
  resultsSection.classList.add('hidden');
  showLoading();

  try {
    setLoadingStep(1, 'Connecting to in-memory HTTP stream...');
    await new Promise((r) => setTimeout(r, 150));

    setLoadingStep(2, 'Decoding TurboStream pointer-graph array...');

    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to extract conversation.');
    }

    setLoadingStep(3, 'Formatting dialogue turns & code blocks...');
    await new Promise((r) => setTimeout(r, 200));

    currentConversation = data;
    displayResults(data);
    hideLoading();
    showToast(`Extracted ${data.total_turns} turns successfully!`);
  } catch (err) {
    hideLoading();
    showError(err.message);
  }
}

/**
 * Display Results
 */
function displayResults(data) {
  convTitle.textContent = data.title || 'ChatGPT Conversation';

  // Format date
  if (data.create_time) {
    const d = new Date(data.create_time);
    convDate.textContent = `📅 ${d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })}`;
  } else {
    convDate.textContent = '📅 Shared Chat';
  }

  convTurnsCount.textContent = `💬 ${data.total_turns} Turns`;

  // Calculate word counts
  let wordCount = 0;
  let uCount = 0;
  let aCount = 0;

  data.turns.forEach((t) => {
    wordCount += t.content.split(/\s+/).filter(Boolean).length;
    if (t.role === 'user') uCount++;
    else aCount++;
  });

  convWordsCount.textContent = `📝 ${wordCount.toLocaleString()} Words`;
  allCount.textContent = data.total_turns;
  userCount.textContent = uCount;
  assistantCount.textContent = aCount;

  if (data.share_url) {
    convOriginalLink.href = data.share_url;
    convOriginalLink.style.display = 'inline';
  } else {
    convOriginalLink.style.display = 'none';
  }

  // Reset filters
  searchInput.value = '';
  searchQuery = '';
  clearSearchBtn.classList.add('hidden');
  activeFilter = 'all';
  filterTabs.forEach((t) => {
    t.classList.toggle('active', t.getAttribute('data-filter') === 'all');
  });

  renderTurns();
  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Render turns feed based on search and active filter
 */
function renderTurns() {
  if (!currentConversation || !currentConversation.turns) return;

  turnsFeed.innerHTML = '';

  const filteredTurns = currentConversation.turns.filter((turn) => {
    if (activeFilter === 'user' && turn.role !== 'user') return false;
    if (activeFilter === 'assistant' && turn.role === 'user') return false;

    if (searchQuery) {
      const matchContent = turn.content.toLowerCase().includes(searchQuery);
      const matchRole = (turn.role_label || '').toLowerCase().includes(searchQuery);
      if (!matchContent && !matchRole) return false;
    }

    return true;
  });

  if (filteredTurns.length === 0) {
    turnsFeed.innerHTML = `
      <div class="turn-card" style="text-align: center; color: var(--text-muted); padding: 3rem 1rem;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
        <p>No messages match your search or filter.</p>
      </div>
    `;
    return;
  }

  filteredTurns.forEach((turn) => {
    const isUser = turn.role === 'user';
    const card = document.createElement('div');
    card.className = `turn-card ${isUser ? 'user-turn' : 'assistant-turn'}`;

    const turnIndex = currentConversation.turns.indexOf(turn) + 1;
    const timeFormatted = turn.time
      ? new Date(turn.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    const authorDisplay = isUser ? 'User' : 'ChatGPT';
    const avatarEmoji = isUser ? '👤' : '🤖';

    card.innerHTML = `
      <div class="turn-header">
        <div class="turn-author">
          <div class="author-avatar">${avatarEmoji}</div>
          <div>
            <span class="author-name">${authorDisplay}</span>
            <span class="turn-badge">Turn ${turnIndex}</span>
          </div>
        </div>
        <div class="turn-actions">
          ${timeFormatted ? `<span class="turn-time">${timeFormatted}</span>` : ''}
          <button class="btn-icon-sm copy-turn-btn" title="Copy message text">📋 Copy</button>
        </div>
      </div>
      <div class="turn-body">${formatMarkdown(turn.content)}</div>
    `;

    // Copy turn handler
    const copyTurnBtn = card.querySelector('.copy-turn-btn');
    copyTurnBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(turn.content);
      showToast(`Copied Turn ${turnIndex} to clipboard!`);
    });

    // Attach code copy listeners
    card.querySelectorAll('.btn-copy-code').forEach((btn) => {
      btn.addEventListener('click', () => {
        const codeText = btn.getAttribute('data-code');
        if (codeText) {
          navigator.clipboard.writeText(decodeURIComponent(codeText));
          showToast('Code snippet copied!');
        }
      });
    });

    turnsFeed.appendChild(card);
  });
}

/**
 * Lightweight Markdown Parser for rich bubbles
 */
function formatMarkdown(rawText) {
  if (!rawText) return '';

  let text = escapeHtml(rawText);

  // Extract Code Blocks first to protect them
  const codeBlocks = [];
  text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    const langDisplay = lang || 'code';
    const encodedCode = encodeURIComponent(unescapeHtml(code.trim()));
    const blockHtml = `
      <div class="code-block-wrapper">
        <div class="code-header">
          <span>${langDisplay}</span>
          <button class="btn-copy-code" data-code="${encodedCode}">📋 Copy Code</button>
        </div>
        <pre class="code-content"><code>${code.trim()}</code></pre>
      </div>
    `;
    codeBlocks.push(blockHtml);
    return placeholder;
  });

  // Headers
  text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Blockquotes
  text = text.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

  // Bold & Italic
  text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Unordered list items
  text = text.replace(/^\s*[-*+]\s+(.*$)/gim, '<li>$1</li>');
  text = text.replace(/(<li>.*<\/li>)/gms, '<ul>$1</ul>');

  // Paragraphs
  const paragraphs = text.split(/\n{2,}/);
  text = paragraphs
    .map((p) => {
      p = p.trim();
      if (!p) return '';
      if (
        p.startsWith('<h1>') ||
        p.startsWith('<h2>') ||
        p.startsWith('<h3>') ||
        p.startsWith('<ul>') ||
        p.startsWith('<blockquote>') ||
        p.startsWith('__CODE_BLOCK_')
      ) {
        return p;
      }
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    })
    .join('');

  // Restore Code Blocks
  codeBlocks.forEach((block, idx) => {
    text = text.replace(`__CODE_BLOCK_${idx}__`, block);
  });

  return text;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function unescapeHtml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

/**
 * Multi-Format Exporters
 */
function downloadConversation(format) {
  if (!currentConversation) return;

  const title = currentConversation.title || 'ChatGPT_Conversation';
  const cleanTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
  let content = '';
  let filename = '';
  let mimeType = '';

  if (format === 'txt') {
    content = generatePlainText(currentConversation);
    filename = `${cleanTitle}_conversation.txt`;
    mimeType = 'text/plain;charset=utf-8';
  } else if (format === 'md') {
    content = generateMarkdown(currentConversation);
    filename = `${cleanTitle}_conversation.md`;
    mimeType = 'text/markdown;charset=utf-8';
  } else if (format === 'json') {
    content = JSON.stringify(currentConversation, null, 2);
    filename = `${cleanTitle}_conversation.json`;
    mimeType = 'application/json;charset=utf-8';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`Downloaded ${filename}`);
}

function generatePlainText(data) {
  const lines = [];
  lines.push('='.repeat(80));
  lines.push(`CHATGPT CONVERSATION EXPORT: ${data.title}`);
  if (data.share_url) lines.push(`Source URL: ${data.share_url}`);
  if (data.create_time) lines.push(`Date: ${data.create_time}`);
  lines.push(`Total Turns: ${data.total_turns}`);
  lines.push('='.repeat(80));
  lines.push('');

  data.turns.forEach((t, i) => {
    lines.push('-'.repeat(80));
    lines.push(`Turn ${i + 1} of ${data.total_turns}: [${t.role_label || (t.role === 'user' ? 'USER' : 'CHATGPT')}]${t.time ? ` (${t.time})` : ''}`);
    lines.push('-'.repeat(80));
    lines.push('');
    lines.push(t.content);
    lines.push('');
    lines.push('');
  });

  return lines.join('\n');
}

function generateMarkdown(data) {
  const lines = [];
  lines.push(`# ${data.title}`);
  lines.push(`**Platform**: ChatGPT`);
  if (data.share_url) lines.push(`**Source URL**: [${data.share_url}](${data.share_url})`);
  if (data.create_time) lines.push(`**Date**: ${data.create_time}`);
  lines.push(`**Total Turns**: ${data.total_turns}`);
  lines.push('\n---\n');

  data.turns.forEach((t, i) => {
    const isUser = t.role === 'user';
    const badge = isUser ? '👤 **User**' : '🤖 **ChatGPT**';
    const timeBadge = t.time ? ` *(${t.time})*` : '';
    lines.push(`### ${badge}${timeBadge} — Turn ${i + 1}`);
    lines.push('');
    lines.push(t.content);
    lines.push('\n---\n');
  });

  return lines.join('\n');
}

async function copyMarkdownToClipboard() {
  if (!currentConversation) return;
  const md = generateMarkdown(currentConversation);
  await navigator.clipboard.writeText(md);
  copyBtnText.textContent = 'Copied!';
  setTimeout(() => {
    copyBtnText.textContent = 'Copy Markdown';
  }, 2000);
  showToast('Full Markdown copied to clipboard!');
}

/**
 * UI State Helpers
 */
function showLoading() {
  loadingSection.classList.remove('hidden');
  setLoadingStep(1, 'Connecting to in-memory streaming engine...');
}

function hideLoading() {
  loadingSection.classList.add('hidden');
}

function setLoadingStep(stepNum, statusText) {
  step1.className = `step ${stepNum >= 1 ? (stepNum > 1 ? 'step-done' : 'step-active') : ''}`;
  step2.className = `step ${stepNum >= 2 ? (stepNum > 2 ? 'step-done' : 'step-active') : ''}`;
  step3.className = `step ${stepNum >= 3 ? (stepNum > 3 ? 'step-done' : 'step-active') : ''}`;
  loadingStatusText.textContent = statusText;
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorSection.classList.remove('hidden');
}

function hideError() {
  errorSection.classList.add('hidden');
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2500);
}
