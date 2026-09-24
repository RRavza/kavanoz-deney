import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// TARİH: Sonuçların açıklanacağı zamanı buraya yaz (Türkiye saati, +03:00)
const EVENT_DATE = new Date("2026-10-15T18:00:00+03:00");
const EVENT_LABEL = "15 Ekim 2026, 18:00";

// FAKÜLTELER: Listeyi istediğin gibi düzenle (firestore.rules'taki liste ile aynı olmalı değil, sadece uzunluk sınırı var)
const FACULTIES = ["Tıp Fakültesi","Diş Hekimliği Fakültesi","Eczacılık Fakültesi","Mühendislik ve Doğa Bilimleri Fakültesi","Eğitim Fakültesi","Sağlık Bilimleri Fakültesi","Uygulamalı Bilimler Fakültesi","Diğer"];

const db = getFirestore(initializeApp(firebaseConfig));
const $ = id => document.getElementById(id);
const fmt = n => Number(n).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
let chart;

$("faculty").innerHTML = '<option value="" disabled selected>Fakülteni seç</option>' +
  FACULTIES.map(f => `<option>${f}</option>`).join("");
$("guess").addEventListener("input", e => e.target.value = e.target.value.replace(/\D/g, ""));

$("guessForm").addEventListener("submit", async e => {   // Enter tuşu da bu olayı tetikler
  e.preventDefault();
  const value = parseInt($("guess").value, 10), faculty = $("faculty").value;
  if (!value || value < 1 || value > 1000000) return ($("err").textContent = "1 ile 1.000.000 arasında bir sayı yaz.");
  if (!faculty) return ($("err").textContent = "Fakülteni seç.");
  $("err").textContent = ""; $("send").disabled = true;
  try {
    await addDoc(collection(db, "guesses"), { value, faculty, ts: serverTimestamp() });
    localStorage.setItem("myGuess", value);
    showStats(value);
  } catch (err) {
    console.error(err);
    $("err").textContent = "Tahmin gönderilemedi. Bağlantını kontrol edip tekrar dene.";
    $("send").disabled = false;
  }
});

if (localStorage.getItem("myGuess")) showStats(localStorage.getItem("myGuess")); // aynı cihazdan tekrar tahmini engeller (basit önlem)

async function showStats(mine) {
  $("formView").hidden = true; $("statsView").hidden = false;
  $("myGuess").textContent = fmt(mine);
  const msg = `Benim tahminim ${mine}, sence kavanozda kaç obje var? ${location.href.split("?")[0]}`;
  $("wa").href = "https://wa.me/?text=" + encodeURIComponent(msg);
  startCountdown();
  const vals = (await getDocs(collection(db, "guesses"))).docs.map(d => d.data().value);
  const n = vals.length, mean = vals.reduce((a, b) => a + b, 0) / n;
  $("sCount").textContent = fmt(n);
  $("sMean").textContent = fmt(mean);
  drawChart(vals, mean);
  try {  // Admin panelinin hesapladığı değerler (gerçek sayı burada YOK)
    const c = await getDoc(doc(db, "stats", "closest"));
    $("sFac").textContent = c.exists() ? c.data().faculty : "Henüz hesaplanmadı";
    const r = await getDoc(doc(db, "stats", "reveal"));
    if (r.exists() && new Date() >= EVENT_DATE) {
      const d = r.data(); $("reveal").hidden = false;
      $("reveal").innerHTML = `<b>Gerçek sayı: ${fmt(d.answer)}</b><br>En iyi tahmin: ${fmt(d.bestGuess)} (${d.bestFaculty})`;
    }
  } catch (e) { $("sFac").textContent = "–"; }
}

function drawChart(vals, mean) {
  const n = vals.length, sd = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / n) || 1;
  const min = Math.min(...vals), max = Math.max(...vals), bins = 12, w = (max - min) / bins || 1;
  const labels = [], counts = Array(bins).fill(0), curve = [];
  vals.forEach(v => counts[Math.min(bins - 1, Math.floor((v - min) / w))]++);
  for (let i = 0; i < bins; i++) {
    const mid = min + w * (i + .5);
    labels.push(fmt(mid));
    curve.push(n * w * Math.exp(-((mid - mean) ** 2) / (2 * sd * sd)) / (sd * Math.sqrt(2 * Math.PI)));
  }
  chart?.destroy();
  chart = new Chart($("chart"), {
    data: { labels, datasets: [
      { type: "bar", label: "Tahmin sayısı", data: counts, backgroundColor: "rgba(95,209,196,.45)" },
      { type: "line", label: "Çan eğrisi", data: curve, borderColor: "#ffb238", tension: .4, pointRadius: 0, borderWidth: 3 } ] },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#8fa4ad" } } },
      scales: { x: { ticks: { color: "#8fa4ad" }, grid: { display: false } },
                y: { ticks: { color: "#8fa4ad", precision: 0 }, grid: { color: "#25333c" }, beginAtZero: true } } }
  });
}

function startCountdown() {
  $("cdText").textContent = `Gerçek sayı ve en iyi tahmin eden kişi ${EVENT_LABEL} tarihinde burada açıklanacak!`;
  const tick = () => {
    let s = Math.max(0, Math.floor((EVENT_DATE - Date.now()) / 1000));
    const p = [["gün", 86400], ["saat", 3600], ["dk", 60], ["sn", 1]].map(([l, m]) => {
      const v = Math.floor(s / m); s %= m; return `<div><b>${String(v).padStart(2, "0")}</b><small>${l}</small></div>`; });
    $("cd").innerHTML = p.join("");
  };
  tick(); setInterval(tick, 1000);
       }
