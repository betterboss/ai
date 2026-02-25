// Better Boss Lead Capture Content Script
// Runs on lead source pages to detect and extract lead data.
// Each parser targets a specific platform and extracts customer info.
// NOTE: These parsers depend on third-party DOM structures and will need
// periodic updates as those sites change their markup.

(function () {
  'use strict';

  const BB_LEAD_BUTTON_ID = 'bb-lead-capture-btn';
  const BB_NOTIFICATION_ID = 'bb-lead-notification';

  // ═══════════════════════════════════════════════════════════
  // UTILITY HELPERS
  // ═══════════════════════════════════════════════════════════

  function safeText(selector, root) {
    try {
      const el = (root || document).querySelector(selector);
      return el ? el.textContent.trim() : '';
    } catch (e) {
      return '';
    }
  }

  function safeAttr(selector, attr, root) {
    try {
      const el = (root || document).querySelector(selector);
      return el ? (el.getAttribute(attr) || '').trim() : '';
    } catch (e) {
      return '';
    }
  }

  function safeAllText(selector, root) {
    try {
      const els = (root || document).querySelectorAll(selector);
      return Array.from(els).map(el => el.textContent.trim()).filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  // Extract phone numbers using regex from a text block
  function extractPhone(text) {
    if (!text) return '';
    const phoneRegex = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
    const matches = text.match(phoneRegex);
    return matches ? matches[0].trim() : '';
  }

  // Extract email using regex from a text block
  function extractEmail(text) {
    if (!text) return '';
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex);
    return matches ? matches[0].trim() : '';
  }

  // Extract address-like patterns from text
  function extractAddress(text) {
    if (!text) return '';
    // Look for patterns like "123 Main St, City, ST 12345"
    const addressRegex = /\d{1,5}\s+[\w\s.]+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Ln|Lane|Rd|Road|Way|Ct|Court|Pl|Place|Cir|Circle)[.,]?\s*[\w\s]*,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?/gi;
    const matches = text.match(addressRegex);
    return matches ? matches[0].trim() : '';
  }

  // ═══════════════════════════════════════════════════════════
  // PARSERS
  // ═══════════════════════════════════════════════════════════

  const AngiParser = {
    source: 'angi',

    canParse() {
      return window.location.hostname === 'www.angi.com' ||
             window.location.hostname === 'angi.com';
    },

    parse() {
      const data = { name: '', email: '', phone: '', address: '', description: '' };

      try {
        // Lead detail page: look for customer name in headings or profile sections
        data.name = safeText('[data-testid="customer-name"]') ||
                    safeText('.lead-detail-header h1') ||
                    safeText('.customer-name') ||
                    safeText('.lead-card__name') ||
                    safeText('h1.name') ||
                    safeText('[class*="customerName"]') ||
                    safeText('[class*="customer-name"]');

        // Phone number
        data.phone = safeText('[data-testid="customer-phone"]') ||
                     safeText('.customer-phone') ||
                     safeText('[class*="phoneNumber"]') ||
                     safeText('a[href^="tel:"]') ||
                     safeAttr('a[href^="tel:"]', 'href').replace('tel:', '');

        // Email
        data.email = safeText('[data-testid="customer-email"]') ||
                     safeText('.customer-email') ||
                     safeAttr('a[href^="mailto:"]', 'href').replace('mailto:', '') ||
                     safeText('[class*="email"]');

        // Project/job description
        data.description = safeText('[data-testid="project-description"]') ||
                           safeText('.lead-description') ||
                           safeText('.project-description') ||
                           safeText('[class*="projectDescription"]') ||
                           safeText('[class*="jobDescription"]');

        // Address
        data.address = safeText('[data-testid="customer-address"]') ||
                       safeText('.lead-location') ||
                       safeText('.customer-address') ||
                       safeText('[class*="address"]') ||
                       safeText('[class*="location"]');

        // Fallback: scan visible page text for phone/email/address
        if (!data.phone || !data.email) {
          const bodyText = document.body.innerText || '';
          if (!data.phone) data.phone = extractPhone(bodyText);
          if (!data.email) data.email = extractEmail(bodyText);
          if (!data.address) data.address = extractAddress(bodyText);
        }
      } catch (e) {
        console.warn('[BetterBoss] AngiParser error:', e);
      }

      return data;
    },
  };

  const ThumbTackParser = {
    source: 'thumbtack',

    canParse() {
      return window.location.hostname === 'pro.thumbtack.com' ||
             window.location.hostname === 'www.thumbtack.com';
    },

    parse() {
      const data = { name: '', email: '', phone: '', address: '', description: '' };

      try {
        // Lead card / lead detail view
        data.name = safeText('[data-testid="customer-name"]') ||
                    safeText('[class*="CustomerName"]') ||
                    safeText('.lead-card-name') ||
                    safeText('[class*="leadName"]') ||
                    safeText('h1[class*="name"]') ||
                    safeText('[data-testid="lead-detail-name"]');

        data.phone = safeText('[data-testid="customer-phone"]') ||
                     safeText('[class*="CustomerPhone"]') ||
                     safeText('a[href^="tel:"]') ||
                     safeAttr('a[href^="tel:"]', 'href').replace('tel:', '');

        data.email = safeText('[data-testid="customer-email"]') ||
                     safeAttr('a[href^="mailto:"]', 'href').replace('mailto:', '') ||
                     safeText('[class*="CustomerEmail"]');

        // Project details
        data.description = safeText('[data-testid="project-details"]') ||
                           safeText('[class*="ProjectDetails"]') ||
                           safeText('[class*="requestDescription"]') ||
                           safeText('.lead-details-description');

        data.address = safeText('[data-testid="customer-location"]') ||
                       safeText('[class*="CustomerLocation"]') ||
                       safeText('[class*="location"]') ||
                       safeText('[class*="address"]');

        // Fallback
        if (!data.phone || !data.email) {
          const bodyText = document.body.innerText || '';
          if (!data.phone) data.phone = extractPhone(bodyText);
          if (!data.email) data.email = extractEmail(bodyText);
          if (!data.address) data.address = extractAddress(bodyText);
        }
      } catch (e) {
        console.warn('[BetterBoss] ThumbTackParser error:', e);
      }

      return data;
    },
  };

  const HomeAdvisorParser = {
    source: 'homeadvisor',

    canParse() {
      return window.location.hostname === 'pro.homeadvisor.com' ||
             window.location.hostname === 'www.homeadvisor.com';
    },

    parse() {
      const data = { name: '', email: '', phone: '', address: '', description: '' };

      try {
        // Lead detail sections
        data.name = safeText('.lead-detail__name') ||
                    safeText('[class*="customerName"]') ||
                    safeText('[data-testid="lead-name"]') ||
                    safeText('.customer-info h2') ||
                    safeText('h1[class*="name"]');

        data.phone = safeText('.lead-detail__phone') ||
                     safeText('[class*="customerPhone"]') ||
                     safeText('a[href^="tel:"]') ||
                     safeAttr('a[href^="tel:"]', 'href').replace('tel:', '');

        data.email = safeText('.lead-detail__email') ||
                     safeAttr('a[href^="mailto:"]', 'href').replace('mailto:', '') ||
                     safeText('[class*="customerEmail"]');

        data.description = safeText('.lead-detail__description') ||
                           safeText('[class*="taskDescription"]') ||
                           safeText('[class*="projectDescription"]') ||
                           safeText('.task-name');

        data.address = safeText('.lead-detail__address') ||
                       safeText('[class*="customerAddress"]') ||
                       safeText('[class*="location"]');

        // Fallback
        if (!data.phone || !data.email) {
          const bodyText = document.body.innerText || '';
          if (!data.phone) data.phone = extractPhone(bodyText);
          if (!data.email) data.email = extractEmail(bodyText);
          if (!data.address) data.address = extractAddress(bodyText);
        }
      } catch (e) {
        console.warn('[BetterBoss] HomeAdvisorParser error:', e);
      }

      return data;
    },
  };

  const GmailParser = {
    source: 'gmail',

    canParse() {
      return window.location.hostname === 'mail.google.com';
    },

    parse() {
      const data = { name: '', email: '', phone: '', address: '', description: '' };

      try {
        // Detect email view — look for the sender info in the message header
        // Gmail uses deeply nested, obfuscated class names. Target stable attributes.

        // Sender name from the message header
        const senderEl = document.querySelector('[email]') ||
                         document.querySelector('[data-hovercard-id]') ||
                         document.querySelector('.gD');
        if (senderEl) {
          data.name = senderEl.getAttribute('name') ||
                      senderEl.textContent.trim() ||
                      '';
          data.email = senderEl.getAttribute('email') ||
                       senderEl.getAttribute('data-hovercard-id') ||
                       '';
        }

        // Fallback for sender email from header spans
        if (!data.email) {
          const headerEls = document.querySelectorAll('span[email]');
          for (const el of headerEls) {
            const email = el.getAttribute('email');
            if (email && !email.includes('noreply') && !email.includes('no-reply')) {
              data.email = email;
              if (!data.name) data.name = el.getAttribute('name') || el.textContent.trim();
              break;
            }
          }
        }

        // Email body text — search for phone numbers, addresses
        // Gmail message body is typically within div.a3s or div[data-message-id]
        const bodyEl = document.querySelector('.a3s.aiL') ||
                       document.querySelector('.a3s') ||
                       document.querySelector('[data-message-id] .ii');
        const bodyText = bodyEl ? bodyEl.innerText : '';

        if (bodyText) {
          if (!data.phone) data.phone = extractPhone(bodyText);
          if (!data.address) data.address = extractAddress(bodyText);

          // Use first ~200 chars of body as description
          data.description = bodyText.slice(0, 200).replace(/\n+/g, ' ').trim();
          if (bodyText.length > 200) data.description += '...';
        }

        // Also grab subject line as part of description
        const subjectEl = document.querySelector('h2.hP') ||
                          document.querySelector('[data-thread-perm-id] h2') ||
                          document.querySelector('.ha h2');
        if (subjectEl) {
          const subject = subjectEl.textContent.trim();
          if (subject) {
            data.description = subject + (data.description ? ' | ' + data.description : '');
          }
        }
      } catch (e) {
        console.warn('[BetterBoss] GmailParser error:', e);
      }

      return data;
    },
  };

  const GoogleMapsParser = {
    source: 'google_maps',

    canParse() {
      return (window.location.hostname === 'www.google.com' ||
              window.location.hostname === 'google.com') &&
             window.location.pathname.startsWith('/maps');
    },

    parse() {
      const data = { name: '', email: '', phone: '', address: '', description: '' };

      try {
        // Business name from the info panel
        data.name = safeText('[data-attrid="title"]') ||
                    safeText('h1.DUwDvf') ||
                    safeText('h1[class*="header"]') ||
                    safeText('.qBF1Pd') ||
                    safeText('[jsan*="title"]');

        // Address
        data.address = safeText('[data-item-id="address"] .rogA2c') ||
                       safeText('[data-item-id="address"]') ||
                       safeText('button[data-item-id="address"]') ||
                       safeText('[aria-label*="Address"]') ||
                       safeText('.Io6YTe.fontBodyMedium');

        // Phone
        data.phone = safeText('[data-item-id^="phone:"] .rogA2c') ||
                     safeText('[data-item-id^="phone:"]') ||
                     safeText('button[data-item-id^="phone:"]') ||
                     safeText('[aria-label*="Phone"]');

        // Clean phone (might have labels like "Phone: ")
        if (data.phone) {
          data.phone = data.phone.replace(/^Phone:\s*/i, '').trim();
        }

        // Website as description
        const website = safeText('[data-item-id="authority"] .rogA2c') ||
                        safeText('[data-item-id="authority"]') ||
                        safeAttr('a[data-item-id="authority"]', 'href');
        if (website) {
          data.description = 'Website: ' + website;
        }

        // Category / type
        const category = safeText('button[jsaction*="category"]') ||
                         safeText('.DkEaL');
        if (category) {
          data.description = (data.description ? data.description + ' | ' : '') + category;
        }
      } catch (e) {
        console.warn('[BetterBoss] GoogleMapsParser error:', e);
      }

      return data;
    },
  };

  const FacebookParser = {
    source: 'facebook',

    canParse() {
      return window.location.hostname === 'www.facebook.com' ||
             window.location.hostname === 'facebook.com' ||
             window.location.hostname === 'm.facebook.com';
    },

    parse() {
      const data = { name: '', email: '', phone: '', address: '', description: '' };

      try {
        // Facebook Marketplace listing or Messages view
        const isMarketplace = window.location.pathname.includes('/marketplace');
        const isMessages = window.location.pathname.includes('/messages');

        if (isMarketplace) {
          // Marketplace listing
          data.name = safeText('[class*="seller"] span') ||
                      safeText('span[class*="SellerName"]') ||
                      safeText('.marketplace-seller-name');

          data.description = safeText('span[class*="title"]') ||
                             safeText('[class*="ListingTitle"]') ||
                             safeText('h1');

          // Price as part of description
          const price = safeText('[class*="Price"]') ||
                        safeText('span[class*="price"]');
          if (price) {
            data.description = (data.description ? data.description + ' - ' : '') + price;
          }

          data.address = safeText('[class*="Location"]') ||
                         safeText('[class*="location"]');
        } else if (isMessages) {
          // Messages view — extract conversation partner name
          // Facebook Messenger uses complex React-rendered DOM
          data.name = safeText('[data-testid="mwthreadlist-item-open"] span') ||
                      safeText('._3q23 span') ||
                      safeText('[class*="threadName"]') ||
                      safeText('[aria-label*="Conversation"] span');

          // Try to get message content
          const messageEls = document.querySelectorAll('[class*="message"] [dir="auto"]');
          if (messageEls.length > 0) {
            const lastMessage = messageEls[messageEls.length - 1].textContent.trim();
            data.description = lastMessage.slice(0, 200);
          }
        } else {
          // Generic Facebook page / profile
          data.name = safeText('h1') || safeText('[role="heading"]');
        }

        // Scan visible text for contact info
        const bodyText = document.body.innerText || '';
        if (!data.phone) data.phone = extractPhone(bodyText.slice(0, 5000));
        if (!data.email) data.email = extractEmail(bodyText.slice(0, 5000));
        if (!data.address) data.address = extractAddress(bodyText.slice(0, 5000));
      } catch (e) {
        console.warn('[BetterBoss] FacebookParser error:', e);
      }

      return data;
    },
  };

  // ═══════════════════════════════════════════════════════════
  // PARSER REGISTRY
  // ═══════════════════════════════════════════════════════════

  const PARSERS = [
    AngiParser,
    ThumbTackParser,
    HomeAdvisorParser,
    GmailParser,
    GoogleMapsParser,
    FacebookParser,
  ];

  // ═══════════════════════════════════════════════════════════
  // UI: FLOATING BUTTON & NOTIFICATION
  // ═══════════════════════════════════════════════════════════

  function injectStyles() {
    if (document.getElementById('bb-lead-capture-styles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'bb-lead-capture-styles';
    styleEl.textContent = `
      #${BB_LEAD_BUTTON_ID} {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        background: linear-gradient(135deg, #5d47fa 0%, #7c3aed 100%);
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 600;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(93, 71, 250, 0.5), 0 2px 8px rgba(0,0,0,0.3);
        transition: transform 0.2s, box-shadow 0.2s;
        line-height: 1;
      }
      #${BB_LEAD_BUTTON_ID}:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 28px rgba(93, 71, 250, 0.6), 0 4px 12px rgba(0,0,0,0.3);
      }
      #${BB_LEAD_BUTTON_ID}:active {
        transform: translateY(0);
      }
      #${BB_LEAD_BUTTON_ID} .bb-bolt {
        font-size: 16px;
        line-height: 1;
      }
      #${BB_LEAD_BUTTON_ID}.bb-sending {
        opacity: 0.7;
        pointer-events: none;
      }
      #${BB_LEAD_BUTTON_ID} .bb-spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: #fff;
        border-radius: 50%;
        animation: bb-spin 0.8s linear infinite;
      }
      @keyframes bb-spin {
        to { transform: rotate(360deg); }
      }

      #${BB_NOTIFICATION_ID} {
        position: fixed;
        bottom: 80px;
        right: 24px;
        z-index: 2147483647;
        padding: 14px 20px;
        background: #12131a;
        color: #e5e7eb;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        border: 1px solid rgba(93, 71, 250, 0.3);
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        max-width: 320px;
        opacity: 0;
        transform: translateY(10px);
        transition: opacity 0.3s, transform 0.3s;
      }
      #${BB_NOTIFICATION_ID}.bb-show {
        opacity: 1;
        transform: translateY(0);
      }
      #${BB_NOTIFICATION_ID}.bb-success {
        border-color: rgba(34, 197, 94, 0.4);
      }
      #${BB_NOTIFICATION_ID}.bb-error {
        border-color: rgba(239, 68, 68, 0.4);
      }
      #${BB_NOTIFICATION_ID} .bb-notif-title {
        font-weight: 600;
        margin-bottom: 4px;
        font-size: 14px;
      }
      #${BB_NOTIFICATION_ID} .bb-notif-title.bb-success-text {
        color: #22c55e;
      }
      #${BB_NOTIFICATION_ID} .bb-notif-title.bb-error-text {
        color: #ef4444;
      }
    `;
    document.head.appendChild(styleEl);
  }

  function showButton(leadData, source) {
    // Remove existing button
    const existing = document.getElementById(BB_LEAD_BUTTON_ID);
    if (existing) existing.remove();

    const btn = document.createElement('button');
    btn.id = BB_LEAD_BUTTON_ID;
    btn.innerHTML = '<span class="bb-bolt">&#9889;</span> Send to JobTread';
    btn.title = 'Capture lead: ' + (leadData.name || 'Unknown');

    btn.addEventListener('click', function () {
      sendLead(leadData, source, btn);
    });

    document.body.appendChild(btn);
  }

  function hideButton() {
    const btn = document.getElementById(BB_LEAD_BUTTON_ID);
    if (btn) btn.remove();
  }

  function showNotification(title, message, type) {
    let notif = document.getElementById(BB_NOTIFICATION_ID);
    if (!notif) {
      notif = document.createElement('div');
      notif.id = BB_NOTIFICATION_ID;
      document.body.appendChild(notif);
    }

    const titleClass = type === 'success' ? 'bb-success-text' : 'bb-error-text';
    notif.className = type === 'success' ? 'bb-success' : 'bb-error';
    notif.innerHTML = `<div class="bb-notif-title ${titleClass}">${title}</div><div>${message}</div>`;

    // Trigger show
    requestAnimationFrame(function () {
      notif.classList.add('bb-show');
    });

    // Auto-hide after 4 seconds
    setTimeout(function () {
      notif.classList.remove('bb-show');
      setTimeout(function () {
        if (notif.parentNode) notif.remove();
      }, 300);
    }, 4000);
  }

  // ═══════════════════════════════════════════════════════════
  // SEND LEAD TO BACKGROUND
  // ═══════════════════════════════════════════════════════════

  function sendLead(leadData, source, btn) {
    if (btn) {
      btn.classList.add('bb-sending');
      btn.innerHTML = '<span class="bb-spinner"></span> Sending...';
    }

    chrome.runtime.sendMessage(
      {
        action: 'LEAD_CAPTURED',
        data: {
          source: source,
          name: leadData.name || '',
          email: leadData.email || '',
          phone: leadData.phone || '',
          address: leadData.address || '',
          description: leadData.description || '',
          pageUrl: window.location.href,
          capturedAt: Date.now(),
        },
      },
      function (response) {
        if (btn) {
          btn.classList.remove('bb-sending');
          btn.innerHTML = '<span class="bb-bolt">&#9889;</span> Send to JobTread';
        }

        if (chrome.runtime.lastError) {
          console.error('[BetterBoss] Send lead error:', chrome.runtime.lastError);
          showNotification('Error', 'Could not reach extension. Try reloading the page.', 'error');
          return;
        }

        if (response && response.success) {
          showNotification(
            'Lead Captured!',
            (leadData.name || 'Lead') + ' saved successfully.',
            'success'
          );
        } else if (response && response.error) {
          showNotification('Error', response.error, 'error');
        } else {
          showNotification('Saved', 'Lead stored locally.', 'success');
        }
      }
    );
  }

  // ═══════════════════════════════════════════════════════════
  // DETECTION LOOP
  // ═══════════════════════════════════════════════════════════

  let lastDetectedData = null;
  let lastDetectedUrl = '';

  function hasUsableData(data) {
    // Need at least a name or an email to be useful
    return !!(data.name || data.email);
  }

  function detectAndShow() {
    // Avoid re-running for same URL if we already detected
    const currentUrl = window.location.href;

    for (let i = 0; i < PARSERS.length; i++) {
      const parser = PARSERS[i];

      if (!parser.canParse()) continue;

      try {
        const data = parser.parse();

        if (hasUsableData(data)) {
          // Only update button if data changed
          const dataKey = JSON.stringify(data);
          if (dataKey !== JSON.stringify(lastDetectedData) || currentUrl !== lastDetectedUrl) {
            lastDetectedData = data;
            lastDetectedUrl = currentUrl;
            showButton(data, parser.source);
          }
          return;
        }
      } catch (e) {
        console.warn('[BetterBoss] Parser error for', parser.source, ':', e);
      }
    }

    // No lead data found — hide button if it was showing
    if (lastDetectedData) {
      lastDetectedData = null;
      lastDetectedUrl = '';
      hideButton();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════

  function init() {
    injectStyles();

    // Initial detection (after a short delay to let page render)
    setTimeout(detectAndShow, 1500);

    // Re-check periodically for SPAs that change content without full navigation
    setInterval(detectAndShow, 3000);

    // Also watch for URL changes (pushState/popState)
    let currentHref = window.location.href;
    const urlObserver = new MutationObserver(function () {
      if (window.location.href !== currentHref) {
        currentHref = window.location.href;
        // Reset detection on URL change
        lastDetectedData = null;
        lastDetectedUrl = '';
        setTimeout(detectAndShow, 1000);
      }
    });
    urlObserver.observe(document.body, { childList: true, subtree: true });

    console.log('[BetterBoss] Lead capture content script loaded on', window.location.hostname);
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
