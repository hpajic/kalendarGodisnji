const SHEET_API_URL = 'https://kalendar-godisnji.vercel.app/api/sheet-proxy';
let teamMembers = [];
const COLLECTIVE_DAYS = ['2026-08-03', '2026-08-04', '2026-08-14']; // Assuming new collective dates for 2026

let CREDENTIALS = { user: '', pass: '' };

function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + btoa(CREDENTIALS.user + ':' + CREDENTIALS.pass)
  };
}

function isWeekend(date) {
  const d = new Date(date);
  return d.getDay() === 0 || d.getDay() === 6;
}
function isCollective(date) {
  return COLLECTIVE_DAYS.includes(date);
}
function showLoader() {
  document.getElementById('loader').style.display = 'flex';
}
function hideLoader() {
  document.getElementById('loader').style.display = 'none';
}

function showToast(message, type = "success") {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '30px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.zIndex = 9999;
    toast.style.minWidth = '200px';
    toast.style.padding = '16px 32px';
    toast.style.borderRadius = '8px';
    toast.style.fontSize = '18px';
    toast.style.color = '#fff';
    toast.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    toast.style.textAlign = 'center';
    document.body.appendChild(toast);
  }
  toast.style.background = type === "success" ? "#43a047" : "#d32f2f";
  toast.textContent = message;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

function showConfirmToast(message, onYes) {
  const toast = document.getElementById('confirm-toast');
  document.getElementById('confirm-toast-message').textContent = message;
  toast.style.display = 'block';
  toast.style.background = '#d32f2f';

  function cleanup() {
    toast.style.display = 'none';
    yesBtn.removeEventListener('click', yesHandler);
    noBtn.removeEventListener('click', noHandler);
  }

  const yesBtn = document.getElementById('confirm-yes');
  const noBtn = document.getElementById('confirm-no');

  function yesHandler() {
    cleanup();
    onYes();
  }
  function noHandler() {
    cleanup();
  }

  yesBtn.addEventListener('click', yesHandler);
  noBtn.addEventListener('click', noHandler);
}

// Dohvati sve unose iz baze
async function getLeaveEntries() {
  const res = await fetch(SHEET_API_URL, { headers: getAuthHeaders() });
  const data = JSON.parse(await res.text());
  if (res.status === 401) {
    showToast('Greška s autorizacijom!', 'error');
    return [];
  }
  // Prvi red su zaglavlja, ostalo su podaci
  return data.slice(1).map(row => {
    // Normaliziraj datum
    let date = row[0];
    if (date && date.length === 10 && date[4] === '-' && date[7] === '-') {
      // već je u formatu YYYY-MM-DD
      return { date: date, member: row[1] };
    }
    // pokušaj parsirati i pretvoriti u YYYY-MM-DD
    let d = new Date(date);
    if (!isNaN(d)) {
      let mm = String(d.getMonth() + 1).padStart(2, '0');
      let dd = String(d.getDate()).padStart(2, '0');
      return { date: `${d.getFullYear()}-${mm}-${dd}`, member: row[1] };
    }
    return { date: date, member: row[1] };
  });
}

// Dodaj unos
async function addLeaveEntry(date, member) {
  await fetch(SHEET_API_URL, {
    method: 'POST',
    body: JSON.stringify({ date, member }),
    headers: getAuthHeaders()
  });
}

// Prikaz kalendara
async function renderCalendar(month, year, containerId) {
  const days = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  const entries = await getLeaveEntries();

  // Tablica
  const table = document.createElement('table');
  table.className = 'calendar-table';

  // Header s danima u tjednu
  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  for (let i = 0; i < 7; i++) {
    const th = document.createElement('th');
    th.textContent = WEEKDAYS[i];
    trHead.appendChild(th);
  }
  thead.appendChild(trHead);
  table.appendChild(thead);

  // Tijelo tablice
  const tbody = document.createElement('tbody');
  let tr = document.createElement('tr');
  let dayOfWeek = (firstDay + 6) % 7; // Ponedjeljak = 0
  let totalCellsRendered = 0;

  for (let i = 0; i < dayOfWeek; i++) {
    const td = document.createElement('td');
    td.style.border = 'none';
    tr.appendChild(td);
    totalCellsRendered++;
  }
  for (let day = 1; day <= days; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const td = document.createElement('td');
    td.innerHTML = `<div>${day}</div>`;
    if (isWeekend(dateStr)) td.classList.add('disabled');
    if (isCollective(dateStr)) td.classList.add('collective');
    if (isWeekend(dateStr)) {
      td.innerHTML += `<div style="font-size:12px;">Vikend</div>`;
    } else if (isCollective(dateStr)) {
      td.innerHTML += `<div style="font-size:12px;">Kolektivni</div>`;
    } else {
      const entriesForDate = entries.filter(e => e.date === dateStr);
      if (entriesForDate.length > 0) {
        entriesForDate.forEach(e => {
          let deleteBtn = `<span class="delete-btn" data-date="${e.date}" data-member="${e.member}" style="color:red;cursor:pointer;margin-left:6px;" title="Obriši">✖</span>`;
          td.innerHTML += `<div class="entry">${e.member} ${deleteBtn}</div>`;
        });
      } else {
        td.innerHTML += `<div class="free">Slobodno</div>`;
      }
    }
    tr.appendChild(td);
    totalCellsRendered++;
    if (totalCellsRendered % 7 === 0) {
      tbody.appendChild(tr);
      tr = document.createElement('tr');
    }
  }
  
  // Garantiramo visinu od točno 6 redova (42 kućice) za stabilnost prikaza
  while (totalCellsRendered < 42) {
    const td = document.createElement('td');
    td.style.border = 'none';
    tr.appendChild(td);
    totalCellsRendered++;
    if (totalCellsRendered % 7 === 0) {
      tbody.appendChild(tr);
      tr = document.createElement('tr');
    }
  }
  
  table.appendChild(tbody);
  container.appendChild(table);
}

// Prikaz broja dana po osobi
async function renderSummary() {
  const entries = await getLeaveEntries();
  const summary = {};
  teamMembers.forEach(m => summary[m] = 0);
  entries.forEach(e => {
    if (teamMembers.includes(e.member)) summary[e.member]++;
  });

  let html = '<h3>Broj zauzetih dana po osobi</h3><ul style="list-style:none;padding:0;">';
  Object.entries(summary).forEach(([member, count]) => {
    html += `<li><b>${member}:</b> ${count} dan(a)</li>`;
  });
  html += '</ul>';
  document.getElementById('summary').innerHTML = html;
}

// Slider logika
const months = [
  "Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj",
  "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac"
];
let currentMonth = 0; // Starts from January in 2026
let currentYear = 2026;

async function renderSliderCalendar() {
  document.getElementById('calendarTitle').textContent = months[currentMonth] + " " + currentYear;
  await renderCalendar(currentMonth, currentYear, 'calendarContainer');
  await renderSummary();
}

document.getElementById('prevMonth').onclick = function() {
  if (currentMonth > 0) { // od siječnja
    currentMonth--;
    renderSliderCalendar();
  }
};
document.getElementById('nextMonth').onclick = function() {
  if (currentMonth < 11) { // do prosinca
    currentMonth++;
    renderSliderCalendar();
  }
};

// Dodavanje godišnjeg
document.getElementById('leaveForm').onsubmit = async function(e) {
  e.preventDefault();
  const submitBtn = this.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Spremam...";

  const dateRange = document.getElementById('dateRange').value;
  let [dateFrom, dateTo] = dateRange.split(" to ");
  if (!dateTo) dateTo = dateFrom; // Ako je odabran samo jedan dan

  const members = $('#memberSelect').val();

  if (!dateFrom || !dateTo || members.length === 0) {
    showToast('Odaberi raspon datuma i barem jednu osobu!', "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Dodaj";
    return;
  }

  const start = new Date(dateFrom);
  const end = new Date(dateTo);

  if (end < start) {
    showToast('Završni datum mora biti nakon početnog!', "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Dodaj";
    return;
  }

  const allEntries = await getLeaveEntries();
  let fullDates = [];
  let duplicateEntries = [];
  let addedCount = 0;

  let d = new Date(dateFrom);
  while (d <= end) {
    const dateStr = d.toISOString().slice(0, 10);
    if (!isWeekend(dateStr) && !isCollective(dateStr)) {
      let entriesForDate = allEntries.filter(e => e.date === dateStr);
      // Wait to evaluate duplicate entries
      let newMembers = members.filter(m => !entriesForDate.some(e => e.member === m));
      
      const maxAllowed = Math.max(0, teamMembers.length - 2);

      if (entriesForDate.length + newMembers.length > maxAllowed) {
        fullDates.push(dateStr);
      } else {
        for (const member of members) {
          if (!entriesForDate.some(e => e.member === member)) {
            await addLeaveEntry(dateStr, member);
            addedCount++;
          } else {
            duplicateEntries.push(`${member} (${dateStr})`);
          }
        }
      }
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }

  if (addedCount > 0) {
    showToast("Unos je uspješno spremljen!", "success");
  }

  await renderSliderCalendar();
  this.reset();

  // Reset Select2 i flatpickr
  $('#memberSelect').val(null).trigger('change');
  document.getElementById('dateRange')._flatpickr.clear();

  submitBtn.disabled = false;
  submitBtn.textContent = "Dodaj";

  if (duplicateEntries.length > 0) {
    showToast(
      'Sljedeće osobe su već upisane za te datume i nisu ponovno dodane:\n' +
      duplicateEntries.join('\n'),
      "error"
    );
  }

  if (fullDates.length > 0) {
    showToast(
      'Za sljedeće datume mora ostati barem 2 osobe raditi:\n' +
      fullDates.map(d => {
        const [y, m, day] = d.split('-');
        return `Dan ${day}.${m}.${y}. je već zauzet prevelikim brojem ljudi, odaberi druge datume.`;
      }).join('\n'),
      "error"
    );
  }
};

// Inicijalizacija flatpickr
document.addEventListener('DOMContentLoaded', function() {
  flatpickr("#dateRange", {
    mode: "range",
    dateFormat: "Y-m-d",
    minDate: "2026-01-01", 
    maxDate: "2026-12-31", 
    locale: {
      firstDayOfWeek: 1,
      weekdays: {
        shorthand: ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'],
        longhand: ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota']
      },
      months: {
        shorthand: ['Sij', 'Velj', 'Ožu', 'Tra', 'Svi', 'Lip', 'Srp', 'Kol', 'Ruj', 'Lis', 'Stu', 'Pro'],
        longhand: ['Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj', 'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac']
      }
    }
  });
});

// Brisanje pojedinačnog unosa
document.addEventListener('click', async function(e) {
  if (e.target.classList.contains('delete-btn')) {
    showConfirmToast('Želiš li obrisati ovaj unos?', async () => {
      const res = await fetch(SHEET_API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          date: e.target.dataset.date,
          member: e.target.dataset.member,
          action: 'delete'
        })
      });
      const data = await res.json();
      if (res.status === 403) {
         showToast(data.error, 'error');
         return;
      }
      await renderSliderCalendar();
      showToast('Unos je obrisan!', 'success');
    });
  }
});

// Brisanje svih unosa
document.getElementById('resetBtn').onclick = function() {
  showConfirmToast('Želiš li obrisati SVE unose iz baze?', async () => {
    showLoader();
    await fetch(SHEET_API_URL, { method: 'DELETE', headers: getAuthHeaders() });
    await renderSliderCalendar();
    hideLoader();
    showToast('Svi unosi su obrisani!', 'success');
  });
};

// Inicijalizacija Select2
$(document).ready(function() {
  $('#memberSelect').select2({
    placeholder: "Odaberi osobe",
    tags: true, // omogućuje unos novih imena kao tagova
    allowClear: true
  });
});

// LOGIN LOGIKA
document.getElementById('loginBtn').onclick = async function() {
  const u = document.getElementById('loginUser').value;
  const p = document.getElementById('loginPassword').value;
  if (!u || !p) { showToast('Unesi korisničko ime i lozinku!', 'error'); return; }

  CREDENTIALS.user = u;
  CREDENTIALS.pass = p;

  showLoader();
  try {
    // Check credentials by fetching users list or calendar
    const resUsers = await fetch(SHEET_API_URL + "?action=users", {
      headers: getAuthHeaders()
    });
    
    if (resUsers.status === 401) {
      hideLoader();
      showToast('Pogrešna lozinka ili korisnik!', 'error');
      // Reset
      CREDENTIALS = { user: '', pass: '' };
      return;
    }
    const dbUsers = await resUsers.json(); // Ovo sad vraća array objekata: [{username: '...', name: '...'}, ...]
    teamMembers = dbUsers.map(userObj => userObj.name); // popunjavamo globalni niz samo display imenima
    
    // Nađi ulogiranog korisnika kako bismo mu ime prikazali u zaglavlju
    const loggedInUserObj = dbUsers.find(userObj => userObj.username === u);
    const loggedInDisplayName = loggedInUserObj ? loggedInUserObj.name : u;
    
    // Postavi pozdravnu poruku
    document.getElementById('userGreeting').textContent = "Pozdrav, " + loggedInDisplayName + "!";

    // Update select with real user true display names
    const select = document.getElementById('memberSelect');
    select.innerHTML = '';
    teamMembers.forEach(member => {
        const opt = document.createElement('option');
        opt.value = member;
        opt.textContent = member;
        select.appendChild(opt);
    });

  } catch (err) {
    hideLoader();
    showToast('Greška u komunikaciji sa serverom.', 'error');
    return;
  }
  
  hideLoader();

  // Uspješan login
  document.getElementById('loginContainer').style.display = 'none';
  document.getElementById('appContainer').style.display = 'block';

  // Automatski odaberi korisnika u dropdownu ako postoji
  if (teamMembers.includes(loggedInDisplayName)) {
     $('#memberSelect').val([loggedInDisplayName]).trigger('change');
  }

  // Prvo renderiranje
  renderSliderCalendar();
};

document.getElementById('exportCsvBtn').onclick = async function() {
  const entries = await getLeaveEntries();
  let csv = "Datum,Osoba\n";
  entries.forEach(e => {
    csv += `${e.date},${e.member}\n`;
  });

  // Kreiraj blob i preuzmi
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'godisnji.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};