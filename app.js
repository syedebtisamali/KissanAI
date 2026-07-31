// ==========================================================================
// 1. HARDCODED API KEYS & ENDPOINTS
// ==========================================================================
const PLANT_ID_API_KEY = "KlNn3iIkK7nVz0Qi4jSGH4KIUvOaRjg9Kby2YXI2smdytSRMGJ";
const COHERE_API_KEY = "dzxNv1JwQPevMVBDbI0KqT8ZnHVTS6mky4cU4CeC";
const COHERE_API_URL = "https://api.cohere.ai/v2/chat";

// ==========================================================================
// 2. NAVIGATION & PWA SETUP
// ==========================================================================
function switchPage(pageId, btnElement) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  
  document.getElementById(`page-${pageId}`).classList.add('active');
  btnElement.classList.add('active');
}

// Standard Production Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('Service Worker registered successfully:', reg.scope))
      .catch((err) => console.error('Service Worker registration failed:', err));
  });
}

// ==========================================================================
// 3. WEED CLASSIFIER & DYNAMIC URDU TRANSLATOR
// ==========================================================================
const COMMON_WEED_SPECIES = [
  'taraxacum officinale', 'cynodon dactylon', 'amaranthus retroflexus',
  'chenopodium album', 'portulaca oleracea', 'convolvulus arvensis',
  'digitaria sanguinalis', 'sorghum halepense', 'cirsium arvense', 'echinochloa crus-galli'
];

function guessIsWeed(speciesName) {
  if (!speciesName) return false;
  return COMMON_WEED_SPECIES.includes(speciesName.toLowerCase());
}

async function translateToUrdu(text) {
  if (!text || text.trim() === '') return '';
  try {
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ur&dt=t&q=${encodeURIComponent(text)}`);
    const data = await res.json();
    if (data && data[0]) {
      return data[0].map(item => item[0]).join('');
    }
    return text;
  } catch (err) {
    return text; // Fallback to original text if offline
  }
}

// ==========================================================================
// 4. PLANT ANALYZER ENGINE (PLANT.ID V3 API)
// ==========================================================================
const imageInput = document.getElementById('imageInput');
const preview = document.getElementById('preview');
const submitBtn = document.getElementById('submitBtn');
const resultsDiv = document.getElementById('results');
const uploadText = document.getElementById('uploadText');

if (imageInput) {
  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      preview.src = URL.createObjectURL(file);
      preview.style.display = 'block';
      uploadText.innerText = `Selected: ${file.name}`;
    }
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

async function analyzeLeaf() {
  const file = imageInput.files[0];

  if (!PLANT_ID_API_KEY || PLANT_ID_API_KEY === "YOUR_PLANT_ID_API_KEY_HERE") {
    alert("Please set your hardcoded Plant.id API key in app.js.");
    return;
  }

  if (!file) {
    alert("Please select or capture an image first / برائے مہربانی پہلے تصویر منتخب کریں۔");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerText = "Analyzing Leaf / تجزیہ جاری ہے...";
  resultsDiv.style.display = "none";

  try {
    const base64Data = await fileToBase64(file);

    const response = await fetch('https://api.plant.id/v3/identification?details=common_names,description,treatment,url,local_name,taxonomy', {
      method: 'POST',
      headers: {
        'Api-Key': PLANT_ID_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        images: [base64Data],
        health: 'all',
        similar_images: true
      })
    });

    const resData = await response.json();

    if (!response.ok) {
      throw new Error(resData.message || resData.error || `HTTP ${response.status}`);
    }

    const rawResult = resData.result || {};
    const isPlant = rawResult.is_plant || {};
    const suggestions = (rawResult.classification && rawResult.classification.suggestions) || [];
    
    const identification = suggestions.map((s) => ({
      name: s.name,
      probability: s.probability,
      common_names: (s.details && s.details.common_names) || [],
      description: (s.details && s.details.description) || null,
      likely_weed: guessIsWeed(s.name),
    }));

    const isHealthy = rawResult.is_healthy || {};
    const diseaseSuggestions = (rawResult.disease && rawResult.disease.suggestions) || [];

    const diseases = diseaseSuggestions.map((d) => ({
      name: d.name,
      probability: d.probability,
      is_harmful: d.details ? d.details.is_harmful : null,
      description: (d.details && d.details.description) || null,
      treatment: (d.details && d.details.treatment) || null,
      more_info_url: (d.details && d.details.url) || null,
    }));

    await renderResults({
      is_plant: { binary: isPlant.binary ?? null, probability: isPlant.probability ?? null },
      identification,
      is_healthy: { binary: isHealthy.binary ?? null, probability: isHealthy.probability ?? null },
      diseases
    });

  } catch (err) {
    alert(`Analysis Error: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = "Analyze Leaf / پتے کا تجزیہ کریں";
  }
}

async function renderResults(data) {
  resultsDiv.style.display = "block";

  const isHealthy = data.is_healthy?.binary ?? false;
  const healthProb = Math.round((data.is_healthy?.probability ?? 0) * 100);
  const isPlant = data.is_plant?.binary ?? false;
  const plantProb = Math.round((data.is_plant?.probability ?? 0) * 100);

  // Status Section
  document.getElementById('statusSection').innerHTML = `
    <div>
      <p style="color: var(--muted);"><strong>Is Plant:</strong> ${isPlant ? 'Yes' : 'No'} (${plantProb}% confidence)</p>
      <p style="margin-top: 0.2rem;"><strong>Condition:</strong> 
        <span class="badge ${isHealthy ? 'badge-healthy' : 'badge-sick'}">
          ${isHealthy ? 'Healthy' : 'Diseased / Infected'} (${healthProb}% health index)
        </span>
      </p>
    </div>
    <div class="urdu-block">
      <p style="color: var(--muted);"><strong>پودا ہے یا نہیں:</strong> ${isPlant ? 'جی ہاں' : 'نہیں'} (${plantProb}% یقین دہانی)</p>
      <p style="margin-top: 0.2rem;"><strong>حالت:</strong> 
        <span class="badge ${isHealthy ? 'badge-healthy' : 'badge-sick'}">
          ${isHealthy ? 'صحت مند' : 'متاثرہ / بیمار'}
        </span>
      </p>
    </div>
  `;

  // Species List Section
  const speciesList = document.getElementById('speciesList');
  speciesList.innerHTML = '';
  (data.identification || []).slice(0, 3).forEach(item => {
    const li = document.createElement('li');
    const prob = Math.round(item.probability * 100);
    const weedBadgeEn = item.likely_weed ? `<span class="badge badge-weed">Likely Weed</span>` : '';
    const weedBadgeUr = item.likely_weed ? `<span class="badge badge-weed">جڑی بوٹی</span>` : '';
    const commonNames = item.common_names?.length ? ` (${item.common_names.join(', ')})` : '';
    
    li.innerHTML = `
      <div>
        <strong style="color:var(--text);">${item.name}</strong>${commonNames} — <em>${prob}% match</em> ${weedBadgeEn}
      </div>
      <div class="urdu-block" style="font-size: 0.9rem; margin-top: 0.3rem; padding-top: 0.3rem;">
        نام: <strong>${item.name}</strong> — <em>${prob}% مطابقت</em> ${weedBadgeUr}
      </div>
    `;
    speciesList.appendChild(li);
  });

  // Diagnostics & Care Section
  const diseaseSection = document.getElementById('diseaseSection');
  diseaseSection.innerHTML = '';

  if (data.diseases && data.diseases.length > 0) {
    for (const d of data.diseases) {
      const prob = Math.round(d.probability * 100);
      const descText = typeof d.description === 'object' ? d.description?.value : d.description;

      const urduName = await translateToUrdu(d.name);
      const urduDesc = await translateToUrdu(descText);

      let html = `
        <div class="disease-box">
          <h4>${d.name} (${prob}% match)</h4>
          <p style="font-size: 0.88rem; color: var(--muted); margin-bottom: 0.5rem;">${descText || 'No detailed description available.'}</p>
      `;

      if (d.treatment) {
        if (d.treatment.biological?.length) {
          html += `<strong style="font-size:0.85rem; color:var(--text);">Biological Controls:</strong><ul>`;
          d.treatment.biological.forEach(t => html += `<li style="font-size:0.85rem;">${t}</li>`);
          html += `</ul>`;
        }
        if (d.treatment.chemical?.length) {
          html += `<strong style="font-size:0.85rem; color:var(--text); margin-top:0.4rem; display:block;">Chemical Controls:</strong><ul>`;
          d.treatment.chemical.forEach(t => html += `<li style="font-size:0.85rem;">${t}</li>`);
          html += `</ul>`;
        }
      }

      if (d.more_info_url) {
        html += `<p style="margin-top:0.4rem;"><a href="${d.more_info_url}" target="_blank" style="font-size:0.8rem; color:var(--primary);">Read Wikipedia entry &rarr;</a></p>`;
      }

      html += `
        <div class="urdu-block">
          <h4 style="font-size: 0.95rem;">تشخیص: ${urduName} (${prob}% مطابقت)</h4>
          <p style="font-size: 0.85rem; color: var(--muted); margin-top: 0.3rem;">${urduDesc}</p>
      `;

      if (d.treatment) {
        if (d.treatment.biological?.length) {
          html += `<strong style="font-size:0.85rem; color:var(--text); margin-top:0.4rem; display:block;">حیاتیاتی علاج:</strong><ul>`;
          for (const t of d.treatment.biological) {
            const translatedBio = await translateToUrdu(t);
            html += `<li style="font-size:0.85rem;">${translatedBio}</li>`;
          }
          html += `</ul>`;
        }
        if (d.treatment.chemical?.length) {
          html += `<strong style="font-size:0.85rem; color:var(--text); margin-top:0.4rem; display:block;">کیمیائی علاج:</strong><ul>`;
          for (const t of d.treatment.chemical) {
            const translatedChem = await translateToUrdu(t);
            html += `<li style="font-size:0.85rem;">${translatedChem}</li>`;
          }
          html += `</ul>`;
        }
      }

      html += `</div></div>`;
      diseaseSection.innerHTML += html;
    }
  } else {
    diseaseSection.innerHTML = `
      <p style="color: var(--primary);">No plant diseases detected!</p>
      <div class="urdu-block" style="border:none; margin-top:0.2rem; padding-top:0;">
        <p style="color: var(--primary);">پودے میں کوئی بیماری نہیں پائی گئی!</p>
      </div>
    `;
  }
}

// ==========================================================================
// 5. BILINGUAL COHERE V2 CHATBOT ENGINE
// ==========================================================================
let chatHistory = [];

function addMessageUI(text, sender, urduText = null) {
  const chatBox = document.getElementById('chat-box');
  if (!chatBox) return;

  const wrapper = document.createElement('div');
  wrapper.className = `msg-wrapper ${sender}-wrapper`;

  const pfp = document.createElement('div');
  pfp.className = `pfp ${sender}-pfp`;
  pfp.innerText = sender === 'user' ? 'ME' : 'AI';

  const bubble = document.createElement('div');
  bubble.className = `bubble ${sender}-bubble`;

  if (sender === 'bot' && urduText) {
    bubble.innerHTML = `
      <div>${text}</div>
      <div class="urdu-block" style="margin-top: 0.4rem; padding-top: 0.4rem; border-top: 1px solid rgba(0,0,0,0.1); font-size: 0.88rem;">
        ${urduText}
      </div>
    `;
  } else {
    bubble.innerText = text;
  }

  wrapper.appendChild(pfp);
  wrapper.appendChild(bubble);
  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chatMessage');
  const btn = document.getElementById('sendChatBtn');
  const prompt = input.value.trim();

  if (!prompt || btn.disabled) return;

  addMessageUI(prompt, 'user');
  input.value = "";
  btn.disabled = true;

  const requestBody = {
    model: "command-a-03-2025",
    messages: [
      {
        role: "system",
        content: `You are Kissan Assistant, created by Syed Ebtisam Ali for the KissanAI app. 
You provide expert advice on plant care, farming, and botany.
CRITICAL INSTRUCTION: You MUST provide your response in English first, followed immediately by its accurate Urdu translation on a new line using the exact format:
ENGLISH_TEXT
---URDU---
URDU_TRANSLATION`
      },
      ...chatHistory,
      {
        role: "user",
        content: prompt
      }
    ]
  };

  try {
    const response = await fetch(COHERE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COHERE_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "API connection failed.");
    }

    const fullBotText = data.message.content[0].text;

    let enText = fullBotText;
    let urText = "";

    // Parse system response delimiter
    if (fullBotText.includes('---URDU---')) {
      const parts = fullBotText.split('---URDU---');
      enText = parts[0].trim();
      urText = parts[1].trim();
    } else {
      // Fallback live translation call if model didn't format delimiter
      urText = await translateToUrdu(fullBotText);
    }

    addMessageUI(enText, 'bot', urText);

    chatHistory.push({ role: "user", content: prompt });
    chatHistory.push({ role: "assistant", content: fullBotText });

    if (chatHistory.length > 10) chatHistory.splice(0, 2);

  } catch (err) {
    console.error("KissanAI Chat Debug Log:", err);
    const errUrdu = await translateToUrdu(err.message);
    addMessageUI("Error: " + err.message, 'bot', "خرابی: " + errUrdu);
  } finally {
    btn.disabled = false;
    input.focus();
  }
}

// Global Initialization
window.addEventListener('DOMContentLoaded', () => {
  addMessageUI(
    "Hello! I am Kissan Assistant. How can I help you with your plants today?",
    'bot',
    "السلام علیکم! میں کسان اسسٹنٹ ہوں۔ میں آج پودوں کے بارے میں آپ کی کیا مدد کر سکتا ہوں؟"
  );

  const chatInput = document.getElementById('chatMessage');
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendChatMessage();
    });
  }
});