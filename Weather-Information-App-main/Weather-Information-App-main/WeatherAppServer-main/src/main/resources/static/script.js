/* script.js - enhanced visuals + animations
   Expects backend endpoints:
     GET  /api/weather?city=NAME   -> JSON as implemented in your backend
     GET  /api/export?city=NAME    -> CSV download
*/

const API_BASE = "http://localhost:8080/api";
const $ = id => document.getElementById(id);

const cityInput = $("cityInput");
const searchBtn = $("searchBtn");
const exportBtn = $("exportBtn");
const card = $("card");
const iconElem = $("weatherIcon");

searchBtn.addEventListener("click", fetchWeather);
cityInput.addEventListener("keydown", e => { if (e.key === "Enter") fetchWeather(); });
exportBtn.addEventListener("click", exportCsv);

// main fetch
async function fetchWeather() {
  const city = cityInput.value.trim();
  if (!city) return alert("Enter a city name");
  document.querySelector(".app").classList.add("expanded");

  showStatus("Loading...");
  try {
    const res = await fetch(`${API_BASE}/weather?city=${encodeURIComponent(city)}`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);

    const data = await res.json();

    // fill UI
    $("cityName").innerText = data.city || data.name || "—";
    $("desc").innerText = data.description || "";
    $("tempVal").innerText = Math.round(data.temp ?? (data.main && data.main.temp)) || "--";
    $("minVal").innerText = `${Math.round(data.temp_min ?? (data.main && data.main.temp_min))}°C`;
    $("maxVal").innerText = `${Math.round(data.temp_max ?? (data.main && data.main.temp_max))}°C`;
    $("pressure").innerText = `${data.pressure ?? (data.main && data.main.pressure)} hPa`;
    $("humidity").innerText = `${data.humidity ?? (data.main && data.main.humidity)}%`;
    $("wind").innerText = `${data.wind_speed ?? (data.wind && data.wind.speed)} m/s`;
    $("sunrise").innerText = formatUnix(data.sunrise ?? (data.sys && data.sys.sunrise));
    $("sunset").innerText = formatUnix(data.sunset ?? (data.sys && data.sys.sunset));

    // visuals
    updateWeatherVisuals(
      (data.description || (data.weather && data.weather[0] && data.weather[0].description) || "").toLowerCase()
    );

    // show card animation
    card.classList.remove("hidden");
    card.classList.remove("visible");
    requestAnimationFrame(() => {
      setTimeout(() => card.classList.add("visible"), 50);
    });

    showStatus("Data loaded ✓");
  } catch (err) {
    console.error("Fetch error:", err);
    showStatus("Error fetching data");
    alert("Could not fetch weather. Check your backend or city name.");
  }
}

// convert unix secs -> local time string
function formatUnix(unixSec) {
  if (!unixSec) return "--:--";
  const d = new Date(unixSec * 1000);
  return d.toLocaleTimeString();
}

// map description -> icon class + body theme
function updateWeatherVisuals(desc = "") {
  const d = (desc || "").toLowerCase();

  let iconClass = "wi wi-day-sunny";
  let bodyClass = "sunny";

  if (d.includes("cloud")) { iconClass = "wi wi-cloudy"; bodyClass = "cloudy"; }
  else if (d.includes("rain") || d.includes("drizzle")) { iconClass = "wi wi-rain"; bodyClass = "rainy"; }
  else if (d.includes("thunder")) { iconClass = "wi wi-thunderstorm"; bodyClass = "rainy"; }
  else if (d.includes("snow")) { iconClass = "wi wi-snow"; bodyClass = "snow"; }
  else if (d.includes("mist") || d.includes("fog") || d.includes("haze")) { iconClass = "wi wi-fog"; bodyClass = "mist"; }
  else if (d.includes("clear")) { iconClass = "wi wi-day-sunny"; bodyClass = "clear"; }
  else { iconClass = "wi wi-day-sunny"; bodyClass = "clear"; }

  // icon fade + float animation
  iconElem.style.opacity = 0;
  iconElem.classList.remove("float");
  setTimeout(() => {
    iconElem.className = iconClass;
    setTimeout(() => iconElem.classList.add("float"), 40);
  }, 180);
  setTimeout(() => iconElem.style.opacity = 1, 220);

  // theme change
  document.body.classList.add("theme-transition");
  document.body.classList.remove("sunny", "clear", "cloudy", "rainy", "snow", "mist", "thunder");
  document.body.classList.add(bodyClass);

  document.body.style.backgroundSize = "200% 200%";
  document.body.style.animation = "slideGradient 5s ease-in-out infinite";

  document.body.classList.add("transitioning");
  setTimeout(() => document.body.classList.remove("transitioning"), 800);

  setTimeout(() => document.body.classList.remove("theme-transition"), 1800);
}

// export CSV
async function exportCsv() {
  const city = cityInput.value.trim();
  if (!city) { alert("Enter a city name"); return; }

  try {
    const res = await fetch(`${API_BASE}/export?city=${encodeURIComponent(city)}`);
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${city}-weather.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert("Export failed: " + err.message);
  }
}

function showStatus(text) {
  $("status").innerText = text || "";
}
