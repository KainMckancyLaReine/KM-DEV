/* KM.dev — shared EN/NL language toggle
   Convention:
   - Plain text elements: add data-en="English text" data-nl="Nederlandse tekst"
     -> textContent is swapped (safe, no nested HTML allowed)
   - Elements with nested tags (e.g. <h1>Foo <span class="muted">bar</span></h1>):
     add data-en-html="..." data-nl-html="..." on the element instead
     -> innerHTML is swapped
   - Attributes (alt / placeholder / title): add data-en-alt / data-nl-alt,
     data-en-placeholder / data-nl-placeholder, data-en-title / data-nl-title
   - Language persists via localStorage across all pages on the same origin.
*/
(function () {
  var STORAGE_KEY = 'km-dev-lang';
  var DEFAULT_LANG = 'en';
  var ATTRS = ['alt', 'placeholder', 'title'];

  function getLang() {
    var stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'en' || stored === 'nl' ? stored : DEFAULT_LANG;
  }

  function applyLang(lang) {
    document.documentElement.setAttribute('lang', lang);

    document.querySelectorAll('[data-en]').forEach(function (el) {
      var val = el.getAttribute('data-' + lang);
      if (val === null) val = el.getAttribute('data-en');
      el.textContent = val;
    });

    document.querySelectorAll('[data-en-html]').forEach(function (el) {
      var val = el.getAttribute('data-' + lang + '-html');
      if (val === null) val = el.getAttribute('data-en-html');
      el.innerHTML = val;
    });

    ATTRS.forEach(function (attr) {
      var sel = '[data-en-' + attr + ']';
      document.querySelectorAll(sel).forEach(function (el) {
        var val = el.getAttribute('data-' + lang + '-' + attr);
        if (val === null) val = el.getAttribute('data-en-' + attr);
        el.setAttribute(attr, val);
      });
    });
  }

  function updateToggleUI(lang) {
    document.querySelectorAll('.lang-toggle .lang-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
  }

  function setLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
    applyLang(lang);
    updateToggleUI(lang);
    document.dispatchEvent(new CustomEvent('km:langchange', { detail: { lang: lang } }));
  }

  function initToggle() {
    document.querySelectorAll('.lang-toggle .lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setLang(btn.getAttribute('data-lang'));
      });
    });
  }

  function init() {
    var lang = getLang();
    applyLang(lang);
    initToggle();
    updateToggleUI(lang);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.kmLang = { get: getLang, set: setLang };
})();
