// popup.js

// Change Openai key 

const OPENAI_KEY = "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";
// ----------------------------------------------------------------


const DEXSCREENER_API_BASE = 'https://api.dexscreener.com';
const knownEndpoints = [
  "/token-profiles/latest/v1",
  "/token-boosts/latest/v1",
  "/token-boosts/top/v1",
  "/orders/v1/",
  "/latest/dex/pairs/",
  "/latest/dex/search",
  "/token-pairs/v1/",
  "/tokens/v1/"
];

async function callOpenAI(prompt) {
  if (!OPENAI_KEY || OPENAI_KEY === 'sk-your-openai-api-key-here') {
    throw new Error("Replace with your actual OpenAI API key!");
  }
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }] })
  });
  if (!r.ok) {
    const e = await r.json();
    throw new Error(`OpenAI API error: ${e.error.message}`);
  }
  const d = await r.json();
  return d.choices[0].message.content.trim();
}

document.addEventListener('DOMContentLoaded', () => {
  // Hook up the Send button
  const sendButton = document.getElementById('send-button');
  sendButton.addEventListener('click', handleUserInput);

  // Hook up suggestion buttons
  const suggestionButtons = document.querySelectorAll('.suggestion-btn');
  suggestionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const suggestion = btn.getAttribute('data-suggestion');
      document.getElementById('user-input').value = suggestion;
    });
  });

   // Theme toggle setup
   const themeToggle = document.getElementById('theme-toggle');
   const savedTheme = localStorage.getItem('theme') || 'light';
   setTheme(savedTheme);
 
   themeToggle.addEventListener('click', () => {
     const currentTheme = document.documentElement.getAttribute('data-theme');
     setTheme(currentTheme === 'dark' ? 'light' : 'dark');
   });
});


async function handleGeneralQuery(query) {
  const prompt = `You are an assistant whose expertise is strictly limited to the Solana market.
For questions related to the Solana market, you are a Solana market expert and should provide clear and concise answers.
For questions NOT related to the Solana market.if questions related solana then response it otherwise not
User asked: "${query}".`;
  return await callOpenAI(prompt);
}


async function handleUserInput() {
  const inputField = document.getElementById('user-input');
  const userInput = inputField.value.trim();
  if (!userInput) return;
  addMessage(userInput, 'user');
  let numberRequested = null;
  const numMatch = userInput.match(/\b(\d+)\b/);
  if (numMatch) numberRequested = parseInt(numMatch[1]);

  if (userInput.toLowerCase().includes('summary') || userInput.toLowerCase().includes('how many endpoint')) {
    addMessage(`
      <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded border border-gray-300 dark:border-gray-600 shadow">
        <h2 class="text-lg font-bold mb-2 text-gray-900 dark:text-gray-100">API Endpoints Summary</h2>
        <ul class="list-disc list-inside text-sm text-gray-800 dark:text-gray-200">
          <li>/token-profiles/latest/v1</li>
          <li>/token-boosts/latest/v1</li>
          <li>/token-boosts/top/v1</li>
          <li>/orders/v1/{chainId}/{tokenAddress}</li>
          <li>/latest/dex/pairs/{chainId}/{pairId}</li>
          <li>/latest/dex/search?q=...</li>
          <li>/token-pairs/v1/{chainId}/{tokenAddress}</li>
          <li>/tokens/v1/{chainId}/{tokenAddresses}</li>
        </ul>
        <p class="text-gray-500 dark:text-gray-400 mt-2">Total: 8 endpoints</p>
      </div>`, 'bot', false, true);
    inputField.value = '';
    return;
  }

  inputField.value = '';
  inputField.disabled = true;
  document.getElementById('send-button').disabled = true;
  showProgressBar();
  
  try {
    updateProgress(0, 'in-progress');
    let apiEndpoint = await determineUserIntent(userInput);
    
    if (!apiEndpoint) {
      updateProgress(0, 'done');
      updateProgress(1, 'in-progress');
      const openAIResponse = await handleGeneralQuery(userInput);
      updateProgress(1, 'done');
      addMessage(`<div class="mt-2.5 p-3 bg-gray-100 dark:bg-gray-700 border-l-4 border-purple-600 dark:border-purple-500 rounded">
          <strong class="text-gray-900 dark:text-gray-100">Response:</strong>
          <div class="text-gray-900 dark:text-gray-100">${compileMarkdown(openAIResponse)}</div>
        </div>`, 'bot', false, true);
    } else {
      apiEndpoint = apiEndpoint.replace(/^["']|["']$/g, '').trim();
      if (!isEndpointRecognized(apiEndpoint)) {
        updateProgress(0, 'done');
        updateProgress(1, 'in-progress');
        const openAIResponse = await handleGeneralQuery(userInput);
        addMessage(`<div class="mt-2.5 p-3 bg-gray-100 dark:bg-gray-700 border-l-4 border-purple-600 dark:border-purple-500 rounded">
            <strong class="text-gray-900 dark:text-gray-100">Response:</strong>
            <div class="text-gray-900 dark:text-gray-100">${compileMarkdown(openAIResponse)}</div>
          </div>`, 'bot', false, true);
      } else {
        updateProgress(0, 'done');
        updateProgress(1, 'in-progress');
        const apiUrl = `${DEXSCREENER_API_BASE}${apiEndpoint}`;
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`API fetch failed: ${response.statusText}`);
        const data = await response.json();
        updateProgress(1, 'done');
        updateProgress(2, 'in-progress');

        let formattedResponse = '';
        const cardEndpoints = ['/token-profiles/latest/v1', '/token-boosts/latest/v1', '/token-boosts/top/v1'];
        if (cardEndpoints.includes(apiEndpoint)) {
          formattedResponse = formatDataToHtml(data, numberRequested);
        } else {
          const analysisPrompt = `You are a market expert. Based on the following market data: ${JSON.stringify(data)} and considering the user's request "${userInput}", provide a concise market analysis summary and trading suggestion in short form **using Markdown formatting**.`;
          const marketAnalysis = await callOpenAI(analysisPrompt);
          formattedResponse = `<div class="mt-2.5 p-3 bg-gray-100 dark:bg-gray-700 border-l-4 border-purple-600 dark:border-purple-500 rounded">
              <strong class="text-gray-900 dark:text-gray-100">Market Analysis & Suggestion:</strong>
              <div class="text-gray-900 dark:text-gray-100">${compileMarkdown(marketAnalysis)}</div>
            </div>`;
        }
        updateProgress(2, 'done');
        addMessage(formattedResponse, 'bot', false, true);
      }
    }
  } catch (e) {
    addMessage(`❌ Error: ${e.message}`, 'bot');
  } finally {
    // Always re-enable the input field and button, regardless of the outcome
    inputField.disabled = false;
    document.getElementById('send-button').disabled = false;
  }
}
function isEndpointRecognized(ep) {
  return knownEndpoints.some(base => ep.startsWith(base));
}

async function determineUserIntent(userInput) {
  const prompt = `Identify the correct API endpoint based on the user's request:

You are an API endpoint selector. Your task is to analyze the user's request and determine if they are asking for a specific API endpoint. If the request is directly related to obtaining an API endpoint, return ONLY the API path with complete details (including any required parameters) exactly as specified below. Do NOT include any additional explanation or text.

Important:
- If the user's request is phrased as a question asking "what", "how", or is seeking general information, then do NOT provide an endpoint.
- Only provide an endpoint if the user's intent clearly indicates a request for a specific API endpoint.

User Request: "${userInput}"

Analyze the request and if it explicitly asks for an API endpoint, return only the API endpoint (with complete details and any required parameters as shown above). Otherwise, return nothing.
 

Available API endpoints:
1. "/token-profiles/latest/v1" (Latest token profiles)
2. "/token-boosts/latest/v1" (Latest boosted tokens in the last 24 hours)
3. "/token-boosts/top/v1" (Tokens with the most active boosts)
4. "/orders/v1/{chainId}/{tokenAddress}" (Check orders paid for a token)
5. "/latest/dex/pairs/{chainId}/{pairId}" (Get one or multiple pairs by chain and pair address)
6. "/latest/dex/search?q=..." (Search for pairs matching a query)
7. "/token-pairs/v1/{chainId}/{tokenAddress}" (Get the pools of a given token address)
8. "/tokens/v1/{chainId}/{tokenAddresses}" (Get one or multiple pairs by token address, this is also used for analyzer if user asked analyzer then simply put the chain solana and token here just once 
and get the data and analyze)
Return only the API path (include any required parameters if necessary) with no extra text.`;
  return await callOpenAI(prompt);
}

function formatDataToHtml(data, numberRequested) {
  let tokens = [];
  if (Array.isArray(data)) {
    tokens = data;
  } else if (data && data.pairs && Array.isArray(data.pairs)) {
    tokens = data.pairs;
  } else if (data && (data.tokenAddress || data.chainId || data.header)) {
    tokens.push(data);
  }
  
  if (!tokens.length) {
    return `<p style="padding: 16px; text-align: center; font-size: 14px; color: var(--text-primary);">No data available.</p>`;
  }
  
  if (numberRequested && numberRequested > 0) {
    tokens = tokens.slice(0, numberRequested);
  }
  
  let html = `<div style="
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    padding: 6px;
    justify-items: center;
    margin-bottom: 30px;
  ">`;
  
  tokens.forEach(t => {
    html += `
      <div style="
        width: 200px;
        background: var(--card-bg);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 10px;
        box-sizing: border-box;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        transition: all 0.2s ease-in-out;
        overflow: hidden;
        color: var(--text-primary);
      " onmouseover="this.style.boxShadow='0 4px 6px rgba(0, 0, 0, 0.2)'" onmouseout="this.style.boxShadow='0 1px 3px rgba(0, 0, 0, 0.1)'">
        ${t.icon ? `
          <div style="text-align: center; margin-bottom: 6px;">
            <img src="${t.icon}" alt="Token Icon" style="width: 48px; height: 48px; border-radius: 50%;">
          </div>
        ` : ''}
        ${t.tokenAddress ? `
          <p style="
            font-size: 10px;
            color: var(--text-primary);
            text-align: center;
            font-family: monospace;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            margin: 0 0 4px 0;
          ">${t.tokenAddress}</p>
        ` : ''}
        ${t.description ? `
          <div style="margin-top: 4px; overflow: hidden;">
            <h3 style="
              font-size: 12px;
              font-weight: 600;
              color: var(--text-primary);
              margin: 0 0 2px 0;
            ">Description</h3>
            <p style="font-size: 10px; color: var(--text-primary); opacity: 0.8; margin: 0;">
              ${t.description.includes(' ')
                ? t.description.split(' ').slice(0, 10).join(' ') + (t.description.split(' ').length > 10 ? '...' : '')
                : t.description}
            </p>
          </div>
        ` : ''}
        ${t.amount ? `
          <p style="margin-top: 4px; font-size: 10px; color: var(--text-primary); margin: 4px 0 0 0;">
            <strong>Amt:</strong> ${t.amount}
          </p>
        ` : ''}
        ${t.totalAmount ? `
          <p style="margin-top: 2px; font-size: 10px; color: var(--text-primary); margin: 2px 0 0 0;">
            <strong>Total:</strong> ${t.totalAmount}
          </p>
        ` : ''}
        ${t.chainId ? `
          <p style="margin-top: 2px; font-size: 9px; color: var(--text-primary); opacity: 0.8; margin: 2px 0 0 0;">
            <strong>Chain:</strong> ${t.chainId}
          </p>
        ` : ''}
        ${t.links && Array.isArray(t.links) && t.links.length ? 
          `<div style="margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px; justify-content: center;">
          ` +
          t.links.map(l => `
            <a href="${l.url}" target="_blank" style="
              background: var(--theme-accent, #6b46c1);
              color: #fff;
              padding: 4px 6px;
              font-size: 8px;
              border-radius: 4px;
              text-decoration: none;
              transition: all 0.2s ease-in-out;
            " onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
              ${l.label || l.type}
            </a>
          `).join('') +
          `</div>` 
        : ''}
      </div>`;
  });
  
  html += `</div>`;
  return html;
}

function addMessage(content, sender, isLoading = false, isHTML = false) {
  const c = document.getElementById('chat-container');
  const m = document.createElement('div');
  if (sender === 'user') {
    m.className = 'bg-purple-100 text-gray-800 p-3 rounded-lg max-w-md ml-auto';
  } else {
    m.className = 'min-w-[100%] text-gray-800 p-3 rounded-lg max-w-md';
  }
  if (isLoading) {
    m.textContent = content;
  } else if (sender === 'bot') {
    if (isHTML) {
      m.innerHTML = content;
    } else {
      m.textContent = content;
    }
  } else {
    m.innerText = content;
  }
  c.appendChild(m);
  c.scrollTop = c.scrollHeight;
}

function showProgressBar() {
  // const p = document.getElementById('progress-status');
  // p.classList.remove('hidden');
  // for (let i = 0; i < 3; i++) {
  //   const icon = document.getElementById('progress-icon-' + i);
  //   if (icon) icon.textContent = '⏳';
  // }
}

function updateProgress(stepIndex, status) {
  const icon = document.getElementById('progress-icon-' + stepIndex);
  if (!icon) return;
  if (status === 'in-progress') {
    icon.innerHTML = '<span class="animate-spin inline-block">⏳</span>';
  } else if (status === 'done') {
    icon.innerHTML = '<span>✅</span>';
  }
}

// Updated compileMarkdown function using the marked library.
function compileMarkdown(mdText) {
  if (typeof marked === 'function') {
    // For older versions of marked.
    return marked(mdText);
  } else if (typeof marked === 'object' && typeof marked.parse === 'function') {
    // For newer versions (v4+).
    return marked.parse(mdText);
  } else {
    // Fallback: simple newline replacement.
    return mdText.replace(/\n/g, '<br>');
  }
}


// set desing 

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  
  // Update toggle icons
  const darkIcon = document.getElementById('theme-toggle-dark-icon');
  const lightIcon = document.getElementById('theme-toggle-light-icon');
  
  if (theme === 'dark') {
    darkIcon.classList.add('hidden');
    lightIcon.classList.remove('hidden');
  } else {
    lightIcon.classList.add('hidden');
    darkIcon.classList.remove('hidden');
  }
}