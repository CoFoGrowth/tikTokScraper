// DOM Elements
const form = document.getElementById("scraperForm");
const statusSection = document.getElementById("status");
const resultsSection = document.getElementById("results");
const scrapeBtn = document.getElementById("scrapeBtn");
const resultsBtn = document.getElementById("resultsBtn");
const viewResultsBtn = document.getElementById("viewResultsBtn");
const newSearchBtn = document.getElementById("newSearchBtn");
const progressText = document.querySelector(".progress-text");

// Airtable URL - update this with your actual Airtable base URL
const AIRTABLE_URL = "https://airtable.com/appIVjreDvDlqC305";

// Progress messages
const progressMessages = [
  "Analizujemy hashtagi...",
  "Łączymy się z platformami...",
  "Pobieramy dane z TikTok...",
  "Pobieramy dane z Instagram...",
  "Pobieramy dane z YouTube...",
  "Przetwarzamy wyniki...",
  "Zapisujemy do Airtable...",
  "Finalizujemy...",
];

let progressIndex = 0;
let progressInterval;

// Form validation
function validateForm() {
  const mainHashtag = document.getElementById("mainHashtag").value.trim();
  const platform = document.getElementById("platform").value;
  const resultsCount = document.getElementById("resultsCount").value;

  let isValid = true;

  // Reset previous validation states
  document.querySelectorAll(".input, .select").forEach((el) => {
    el.classList.remove("error", "success");
  });

  // Validate main hashtag
  if (!mainHashtag) {
    document.getElementById("mainHashtag").classList.add("error");
    isValid = false;
  } else {
    document.getElementById("mainHashtag").classList.add("success");
  }

  // Validate platform
  if (!platform) {
    document.getElementById("platform").classList.add("error");
    isValid = false;
  } else {
    document.getElementById("platform").classList.add("success");
  }

  // Validate results count
  if (!resultsCount || resultsCount < 5 || resultsCount > 100) {
    document.getElementById("resultsCount").classList.add("error");
    isValid = false;
  } else {
    document.getElementById("resultsCount").classList.add("success");
  }

  return isValid;
}

// Show status loading
function showLoading() {
  form.style.display = "none";
  statusSection.classList.remove("hidden");
  resultsSection.classList.add("hidden");

  // Start progress messages cycling
  progressIndex = 0;
  progressText.textContent = progressMessages[0];

  progressInterval = setInterval(() => {
    progressIndex = (progressIndex + 1) % progressMessages.length;
    progressText.textContent = progressMessages[progressIndex];
  }, 2000);
}

// Show results
function showResults(data) {
  clearInterval(progressInterval);

  statusSection.classList.add("hidden");
  resultsSection.classList.remove("hidden");

  // Update stats
  const totalItems = data.results?.totalItems || 0;
  const successfulPlatforms = data.results?.successful || 0;

  document.getElementById("totalItems").textContent = totalItems;
  document.getElementById("successfulPlatforms").textContent =
    successfulPlatforms;

  // Enable results button
  viewResultsBtn.onclick = () => openAirtable();
}

// Show error
function showError(message) {
  clearInterval(progressInterval);

  statusSection.classList.add("hidden");
  form.style.display = "block";

  // Reset button state
  scrapeBtn.classList.remove("loading");
  scrapeBtn.disabled = false;
  scrapeBtn.innerHTML = '<span class="btn-icon">🚀</span> Zacznij scrapować';

  alert(`❌ Błąd: ${message}`);
}

// Reset form
function resetForm() {
  resultsSection.classList.add("hidden");
  statusSection.classList.add("hidden");
  form.style.display = "block";

  // Reset validation states
  document.querySelectorAll(".input, .select").forEach((el) => {
    el.classList.remove("error", "success");
  });

  // Reset button state
  scrapeBtn.classList.remove("loading");
  scrapeBtn.disabled = false;
  scrapeBtn.innerHTML = '<span class="btn-icon">🚀</span> Zacznij scrapować';
}

// Open Airtable
function openAirtable() {
  window.open(AIRTABLE_URL, "_blank");
}

// Main form submission
async function handleSubmit(e) {
  e.preventDefault();

  if (!validateForm()) {
    return;
  }

  // Get form data
  const formData = {
    mainHashtag: document.getElementById("mainHashtag").value.trim(),
    firstHashtag: document.getElementById("firstHashtag").value.trim(),
    secondHashtag: document.getElementById("secondHashtag").value.trim(),
    platform: document.getElementById("platform").value,
    resultsCount: parseInt(document.getElementById("resultsCount").value),
  };

  // Update button state
  scrapeBtn.classList.add("loading");
  scrapeBtn.disabled = true;
  scrapeBtn.innerHTML = '<span class="btn-icon">🚀</span> Scrapowanie...';

  // Show loading
  showLoading();

  try {
    const response = await fetch("/api/scrape-custom", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Błąd podczas scrapowania");
    }

    if (data.success) {
      showResults(data);
    } else {
      throw new Error(data.message || "Scrapowanie nie powiodło się");
    }
  } catch (error) {
    console.error("Scraping error:", error);
    showError(error.message);
  }
}

// Event listeners
form.addEventListener("submit", handleSubmit);

resultsBtn.addEventListener("click", () => {
  openAirtable();
});

newSearchBtn.addEventListener("click", () => {
  resetForm();
});

// Real-time validation
document.getElementById("mainHashtag").addEventListener("input", function () {
  if (this.value.trim()) {
    this.classList.remove("error");
    this.classList.add("success");
  } else {
    this.classList.remove("success");
  }
});

document.getElementById("platform").addEventListener("change", function () {
  if (this.value) {
    this.classList.remove("error");
    this.classList.add("success");
  } else {
    this.classList.remove("success");
  }
});

document.getElementById("resultsCount").addEventListener("input", function () {
  const value = parseInt(this.value);
  if (value >= 5 && value <= 100) {
    this.classList.remove("error");
    this.classList.add("success");
  } else {
    this.classList.remove("success");
  }
});

// Initialize page
document.addEventListener("DOMContentLoaded", function () {
  // Reset form on page load
  resetForm();

  // Add smooth scrolling
  document.documentElement.style.scrollBehavior = "smooth";

  console.log("🚀 Multi-Platform Hashtag Scraper loaded successfully!");
});
