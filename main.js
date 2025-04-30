const SHEET_API_URL = 'https://kalendar-godisnji.vercel.app/api/sheet-proxy';
const teamMembers = [
  'HP', 'HT', 'Katarina D.', 'Lucija Ž', 'DJ', 'Ivan K', 'Ivana Paranus'
];
const COLLECTIVE_DAYS = ['2025-08-04', '2025-08-05', '2025-08-15'];
const WEEKDAYS = ['P', 'U', 'S', 'Č', 'P', 'S', 'N'];

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

// Dohvati sve unose iz Google Sheeta
async function getLeaveEntries() {
  const res = await fetch(SHEET_API_URL);
  const data = JSON.parse(await res.text());
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


// Dodaj unos u Google Sheet
async function addLeaveEntry(date, member) {
  await fetch(SHEET_API_URL, {
    method: 'POST',
    body: JSON.stringify({ date, member }),
    headers: { 'Content-Type': 'application/json' }
  });
}

// Prikaz kalendara
async function renderCalendar(month, year, containerId) {
  const days = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  const entries = await getLeaveEntries();
  console.log('entries', entries);

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
  for (let i = 0; i < dayOfWeek; i++) {
    tr.appendChild(document.createElement('td'));
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
          td.innerHTML += `<div class="entry">${e.member} <span class="delete-btn" data-date="${e.date}" data-member="${e.member}" style="color:red;cursor:pointer;">✖</span></div>`;
        });
      } else {
        td.innerHTML += `<div class="free">Slobodno</div>`;
      }
    }
    tr.appendChild(td);
    dayOfWeek++;
    if (dayOfWeek === 7) {
      tbody.appendChild(tr);
      tr = document.createElement('tr');
      dayOfWeek = 0;
    }
  }
  if (dayOfWeek !== 0) {
    for (let i = dayOfWeek; i < 7; i++) {
      tr.appendChild(document.createElement('td'));
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

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

// Osvježi oba kalendara
async function refreshCalendars() {
  showLoader();
  await renderCalendar(6, 2025, 'july');
  await renderCalendar(7, 2025, 'august');
  await renderSummary();
  hideLoader();
}

document.getElementById('leaveForm').onsubmit = async function(e) {
  e.preventDefault();
  const submitBtn = this.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Spremam...";

  const dateRange = document.getElementById('dateRange').value;
  let [dateFrom, dateTo] = dateRange.split(" to ");
  if (!dateTo) dateTo = dateFrom; // Ako je odabran samo jedan dan, koristi isti datum za početak i kraj

  const members = $('#memberSelect').val();

  if (!dateFrom || !dateTo || members.length === 0) {
    alert('Odaberi raspon datuma i barem jednu osobu!');
    submitBtn.disabled = false;
    submitBtn.textContent = "Dodaj";
    return;
  }

  const start = new Date(dateFrom);
  const end = new Date(dateTo);

  if (end < start) {
    alert('Završni datum mora biti nakon početnog!');
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
      if (entriesForDate.length + members.length > 3) {
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
    alert("Unos je uspješno spremljen!");
  }

  await refreshCalendars();
  this.reset();

  // Reset Select2 i flatpickr
  $('#memberSelect').val(null).trigger('change');
  document.getElementById('dateRange')._flatpickr.clear();

  submitBtn.disabled = false;
  submitBtn.textContent = "Dodaj";

  if (duplicateEntries.length > 0) {
    alert(
      'Sljedeće osobe su već upisane za te datume i nisu ponovno dodane:\n' +
      duplicateEntries.join('\n')
    );
  }

  if (fullDates.length > 0) {
    alert(
      'Za sljedeće datume nije moguće dodati više osoba (maksimalno 3 po danu):\n' +
      fullDates.map(d => {
        const [y, m, day] = d.split('-');
        return `Dan ${day}.${m}.${y}. je već zauzet sa previše osoba, odaberi druge datume.`;
      }).join('\n')
    );
  }
};
document.addEventListener('DOMContentLoaded', function() {
  flatpickr("#dateRange", {
    mode: "range",
    dateFormat: "Y-m-d",
    minDate: "2025-07-01",
    maxDate: "2025-08-31",
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
document.addEventListener('click', async function(e) {eetu ili dodatnim Apps Scriptom)
  if (e.target.classList.contains('delete-btn')) {('resetBtn').onclick = async function() {
    if (confirm('Želiš li obrisati ovaj unos?')) {
      await fetch(SHEET_API_URL, {
        method: 'POST',d: 'DELETE' });
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: e.target.dataset.date,'Svi unosi su obrisani!');
          member: e.target.dataset.member,
          action: 'delete'
        })
      });Prvo renderiranje
      await refreshCalendars();reshCalendars();
    }
  }ck', async function(e) {
});ins('delete-btn')) {
ti ovaj unos?')) {
$(document).ready(function() { await fetch(SHEET_API_URL, {
  $('#memberSelect').select2({     method: 'POST',
    placeholder: "Odaberi osobe"        headers: { 'Content-Type': 'application/json' },



});  });        body: JSON.stringify({
          date: e.target.dataset.date,
          member: e.target.dataset.member,
          action: 'delete'
        })
      });
      await refreshCalendars();
    }
  }
});

$(document).ready(function() {
  $('#memberSelect').select2({
    placeholder: "Odaberi osobe"
  });
});
