/* ==========================================================
   TripMate - script.js (one file, used by every page)
   Each setup function checks that its page elements exist,
   so it is safe to load this file on all pages.
   There is no backend yet, so data is kept in localStorage.
   ========================================================== */

(function () {
  'use strict';

  /* ---------- 1. SETTINGS AND HELPERS ---------- */

  var KEYS = {
    users: 'tripmateUsers',
    session: 'tripmateSession',
    trips: 'tripmateHostedTrips',
    requests: 'tripmateRequests',
    messages: 'tripmateMessages'
  };

  // pages/ files sit one folder deeper than index.html
  var inPages = location.pathname.indexOf('/pages/') !== -1;
  var ROOT = inPages ? '../' : '';

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var DESTINATIONS = {
    manali: { place: 'Manali, Himachal Pradesh', img: 'mountain.svg',
              alt: 'Snow-capped mountains under a bright sun, representing Manali' },
    goa:    { place: 'Goa, India', img: 'beach.svg',
              alt: 'Sandy beach with a palm tree and calm sea, representing Goa' },
    jaipur: { place: 'Jaipur, Rajasthan', img: 'fort.svg',
              alt: 'Red sandstone fort at sunset, representing Jaipur' }
  };

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function getSession() {
    return load(KEYS.session, null);
  }

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function formatDate(iso) {
    var p = iso.split('-');
    return parseInt(p[2], 10) + ' ' + MONTHS[parseInt(p[1], 10) - 1] + ' ' + p[0];
  }

  function formatRupees(n) {
    return '\u20B9' + Number(n).toLocaleString('en-IN');
  }

  // Creates an element with optional class and text (text is never parsed as HTML)
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // Shows a success / error message above a form
  function showMessage(form, text, type, linkText, linkHref) {
    var box = form.parentNode.querySelector('.form-message.js-message');
    if (!box) {
      box = el('p', 'form-message js-message');
      box.setAttribute('role', 'status');
      form.parentNode.insertBefore(box, form);
    }
    box.className = 'form-message js-message ' + type;
    box.textContent = text;
    if (linkText) {
      var a = el('a', '', linkText);
      a.href = linkHref;
      box.appendChild(document.createTextNode(' '));
      box.appendChild(a);
    }
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // SHA-256 hash so the password is not saved as plain text.
  // (Demo only: real sites must hash passwords on a server.)
  function hashPassword(text) {
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      return window.crypto.subtle
        .digest('SHA-256', new TextEncoder().encode(text))
        .then(function (buffer) {
          return Array.prototype.map.call(new Uint8Array(buffer), function (b) {
            return ('0' + b.toString(16)).slice(-2);
          }).join('');
        });
    }
    return Promise.resolve(btoa(unescape(encodeURIComponent(text))));
  }


  /* ---------- 2. NAVIGATION (all pages) ---------- */

  function setupNav() {
    var links = document.querySelectorAll('nav a');
    var current = location.pathname.split('/').pop() || 'index.html';
    var session = getSession();

    Array.prototype.forEach.call(links, function (a) {
      var file = a.getAttribute('href').split('#')[0].split('/').pop();

      // highlight the page you are on
      if (file === current) a.classList.add('active');

      if (session && file === 'login.html' && a.closest('nav')) {
        // Login link becomes Logout
        a.textContent = 'Logout (' + session.name.split(' ')[0] + ')';
        a.classList.remove('active');
        a.addEventListener('click', function (e) {
          e.preventDefault();
          try { localStorage.removeItem(KEYS.session); } catch (err) { /* ignore */ }
          location.href = ROOT + 'index.html';
        });
      }

      // no need to show Register to someone who is logged in
      if (session && file === 'register.html' && a.closest('nav')) {
        a.parentNode.hidden = true;
      }
    });
  }


  /* ---------- 3. SEATS AND JOIN BUTTONS (index + trips) ---------- */

  function requestsFor(tripId) {
    return load(KEYS.requests, []).filter(function (r) { return r.tripId === tripId; });
  }

  function seatsLeft(box) {
    var total = parseInt(box.getAttribute('data-seats'), 10) || 0;
    return Math.max(0, total - requestsFor(box.getAttribute('data-trip')).length);
  }

  function refreshSeats() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-trip][data-seats]'), function (box) {
      var out = box.querySelector('.seats');
      if (out) out.textContent = seatsLeft(box);
    });
  }

  function paintJoinButtons() {
    var session = getSession();
    Array.prototype.forEach.call(document.querySelectorAll('.join-btn'), function (btn) {
      var tripId = btn.getAttribute('data-trip');
      var box = btn.closest('[data-trip]');
      var requested = session && requestsFor(tripId).some(function (r) {
        return r.email === session.email;
      });

      btn.removeAttribute('aria-disabled');
      if (!session) return; // keeps its link to the register page

      btn.setAttribute('href', '#' + tripId);
      if (requested) {
        btn.textContent = 'Seat requested \u2713';
        btn.setAttribute('aria-disabled', 'true');
      } else if (box && seatsLeft(box) === 0) {
        btn.textContent = 'Trip full';
        btn.setAttribute('aria-disabled', 'true');
      } else {
        btn.textContent = 'Request to join this trip';
      }
    });
  }

  function setupJoinButtons() {
    paintJoinButtons();

    Array.prototype.forEach.call(document.querySelectorAll('.join-btn'), function (btn) {
      btn.addEventListener('click', function (e) {
        var session = getSession();
        if (!session) return; // normal link to register.html
        e.preventDefault();
        if (btn.getAttribute('aria-disabled') === 'true') return;

        var requests = load(KEYS.requests, []);
        requests.push({
          tripId: btn.getAttribute('data-trip'),
          email: session.email,
          name: session.name,
          at: new Date().toISOString()
        });
        save(KEYS.requests, requests);

        refreshSeats();
        paintJoinButtons();
      });
    });
  }


  /* ---------- 4. HOSTED TRIPS ON THE TRIPS PAGE ---------- */

  function renderHostedTrips() {
    var anchor = document.getElementById('join');
    if (!document.getElementById('filter-form') || !anchor) return;

    load(KEYS.trips, []).forEach(function (t) {
      var info = DESTINATIONS[t.destination] || DESTINATIONS.goa;
      var section = el('section', 'trip');
      section.id = t.id;
      section.setAttribute('data-trip', t.id);
      section.setAttribute('data-destination', t.destination);
      section.setAttribute('data-cost', t.cost);
      section.setAttribute('data-date', t.date);
      section.setAttribute('data-style', t.style);
      section.setAttribute('data-seats', t.seats);

      section.appendChild(el('h2', '', t.name));
      section.appendChild(el('p', '', 'Hosted by ' + t.host + ' (student-hosted trip)'));

      var figure = el('figure');
      var img = document.createElement('img');
      img.src = '../images/' + info.img;
      img.alt = info.alt;
      img.width = 300;
      figure.appendChild(img);
      figure.appendChild(el('figcaption', '', info.place));
      section.appendChild(figure);

      section.appendChild(el('h3', '', 'About this trip'));
      section.appendChild(el('p', '', t.about));

      section.appendChild(el('h3', '', 'Trip information'));
      var dl = el('dl');
      var rows = [
        ['Dates', formatDate(t.date)],
        ['Duration', t.days + (t.days === 1 ? ' day' : ' days')],
        ['Trip style', t.style === 'adventure' ? 'Adventure' : 'Relaxed'],
        ['Estimated cost per person', formatRupees(t.cost)]
      ];
      rows.forEach(function (row) {
        dl.appendChild(el('dt', '', row[0]));
        dl.appendChild(el('dd', '', row[1]));
      });
      dl.appendChild(el('dt', '', 'Seats left'));
      dl.appendChild(el('dd', 'seats', String(t.seats)));
      section.appendChild(dl);

      var actions = el('p');
      var join = el('a', 'btn join-btn', 'Register to join this trip');
      join.setAttribute('data-trip', t.id);
      join.href = 'register.html';
      var top = el('a', 'btn btn-light', 'Back to top');
      top.href = '#intro';
      actions.appendChild(join);
      actions.appendChild(top);
      section.appendChild(actions);

      anchor.parentNode.insertBefore(section, anchor);
    });

    // jump to a newly hosted trip (its section did not exist when the page loaded)
    if (location.hash) {
      var target = document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView();
    }
  }


  /* ---------- 5. TRIP FILTERS (trips page) ---------- */

  function setupTripFilters() {
    var form = document.getElementById('filter-form');
    if (!form) return;

    var counter = document.getElementById('result-count');
    var empty = document.getElementById('no-results');

    // fill the form from the URL, e.g. coming from the home page search
    var params = new URLSearchParams(location.search);
    ['destination', 'budget', 'start', 'style'].forEach(function (name) {
      var value = params.get(name);
      if (value && form.elements[name]) form.elements[name].value = value;
    });

    function applyFilters() {
      var dest = form.elements.destination.value || 'any';
      var budget = parseFloat(form.elements.budget.value);
      var style = form.elements.style.value || 'any';
      var start = form.elements.start.value;

      var trips = document.querySelectorAll('.trip');
      var shown = 0;

      Array.prototype.forEach.call(trips, function (t) {
        var ok = true;
        if (dest !== 'any' && t.getAttribute('data-destination') !== dest) ok = false;
        if (!isNaN(budget) && Number(t.getAttribute('data-cost')) > budget) ok = false;
        if (style !== 'any' && t.getAttribute('data-style') !== style) ok = false;
        if (start && t.getAttribute('data-date') < start) ok = false;
        t.hidden = !ok;
        if (ok) shown++;
      });

      counter.textContent = 'Showing ' + shown + ' of ' + trips.length + ' trips.';
      empty.hidden = shown !== 0;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      applyFilters();
    });

    form.addEventListener('reset', function () {
      setTimeout(applyFilters, 0); // run after the browser clears the fields
    });

    applyFilters();
  }


  /* ---------- 6. REGISTER ---------- */

  function setupRegister() {
    var form = document.querySelector('#register-section form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var name = form.elements.fullname.value.trim();
      var college = form.elements.college.value.trim();
      var studentId = form.elements.studentid.value.trim();
      var email = form.elements.email.value.trim().toLowerCase();
      var password = form.elements.password.value;

      if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        showMessage(form, 'Password must contain at least one letter and one number.', 'error');
        form.elements.password.focus();
        return;
      }

      var users = load(KEYS.users, []);

      if (users.some(function (u) { return u.email === email; })) {
        showMessage(form, 'This email is already registered.', 'error', 'Login instead', 'login.html');
        return;
      }
      if (users.some(function (u) { return u.studentId.toLowerCase() === studentId.toLowerCase(); })) {
        showMessage(form, 'This student ID is already registered.', 'error');
        return;
      }

      hashPassword(password).then(function (hash) {
        users.push({ name: name, college: college, studentId: studentId, email: email, password: hash });
        if (!save(KEYS.users, users)) {
          showMessage(form, 'Could not save your account. Please allow browser storage.', 'error');
          return;
        }
        showMessage(form, 'Account created. Taking you to the login page...', 'success');
        form.reset();
        setTimeout(function () { location.href = 'login.html'; }, 1500);
      });
    });
  }


  /* ---------- 7. LOGIN ---------- */

  function setupLogin() {
    var form = document.querySelector('#login-section form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var email = form.elements.email.value.trim().toLowerCase();
      var password = form.elements.password.value;
      var user = load(KEYS.users, []).filter(function (u) { return u.email === email; })[0];

      if (!user) {
        showMessage(form, 'No account found for this email.', 'error', 'Register here', 'register.html');
        return;
      }

      hashPassword(password).then(function (hash) {
        if (hash !== user.password) {
          showMessage(form, 'Email or password is incorrect.', 'error');
          return;
        }
        save(KEYS.session, { name: user.name, email: user.email });
        showMessage(form, 'Welcome back, ' + user.name.split(' ')[0] + '. Taking you to the trips...', 'success');
        setTimeout(function () { location.href = 'trips.html'; }, 1000);
      });
    });
  }


  /* ---------- 8. HOST A TRIP ---------- */

  function setupHostForm() {
    var form = document.querySelector('#host-section form');
    if (!form) return;

    // cannot pick a date in the past
    form.elements.startdate.min = todayISO();

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var session = getSession();
      if (!session) {
        showMessage(form, 'Please login before hosting a trip.', 'error', 'Login', 'login.html');
        return;
      }

      var date = form.elements.startdate.value;
      if (date < todayISO()) {
        showMessage(form, 'The start date cannot be in the past.', 'error');
        form.elements.startdate.focus();
        return;
      }

      var trip = {
        id: 'hosted-' + Date.now(),
        name: form.elements.tripname.value.trim(),
        destination: form.elements.destination.value,
        date: date,
        days: parseInt(form.elements.days.value, 10),
        cost: parseInt(form.elements.cost.value, 10),
        seats: parseInt(form.elements.seats.value, 10),
        style: form.elements.style.value,
        about: form.elements.about.value.trim(),
        host: session.name,
        hostEmail: session.email
      };

      var trips = load(KEYS.trips, []);
      trips.push(trip);
      if (!save(KEYS.trips, trips)) {
        showMessage(form, 'Could not save the trip. Please allow browser storage.', 'error');
        return;
      }

      showMessage(form, 'Trip published. Taking you to the trips page...', 'success');
      setTimeout(function () { location.href = 'trips.html#' + trip.id; }, 1200);
    });
  }


  /* ---------- 9. CONTACT FORM ---------- */

  function setupContact() {
    var form = document.getElementById('contactForm');
    if (!form) return;

    var box = form.elements.message;
    var counter = document.getElementById('msgCount');
    var MAX = 500;

    box.addEventListener('input', function () {
      counter.textContent = box.value.length + ' / ' + MAX;
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var entry = {
        name: form.elements.fullname.value.trim(),
        email: form.elements.email.value.trim(),
        topic: form.elements.topic.value,
        message: box.value.trim(),
        sentAt: new Date().toISOString()
      };

      var messages = load(KEYS.messages, []);
      messages.push(entry);
      save(KEYS.messages, messages);

      showMessage(form,
        'Thanks, ' + entry.name.split(' ')[0] + '. We received your message about "' +
        entry.topic + '" and will reply within 2 working days.', 'success');
      form.reset();
      counter.textContent = '0 / ' + MAX;
    });
  }


  /* ---------- 10. START EVERYTHING ---------- */

  document.addEventListener('DOMContentLoaded', function () {
    setupNav();
    renderHostedTrips();   // must run before seats/buttons/filters
    refreshSeats();
    setupJoinButtons();
    setupTripFilters();
    setupRegister();
    setupLogin();
    setupHostForm();
    setupContact();
  });

})();
