const KEY = "slotGuidePwaConfigV1";
const REMOTE_CACHE_KEY = "slotGuideRemoteConfigCacheV1";
const ACTIVE_TAB_KEY = "slotGuideActiveTabV1";
const GAS_URL_KEY = "slotGuideGasApiUrlV1";
const allowedTabs = ["daftar", "deposit", "transfer", "withdraw", "promo"];
const $ = (id) => document.getElementById(id);

let config = loadConfig();
let activeTab = getInitialTab();
let deferredInstallPrompt = null;

function getPermanentGasApiUrl(){
  const candidates = [
    (window.DEFAULT_CONFIG && window.DEFAULT_CONFIG.gasApiUrl) || "",
    window.GAS_API_URL || "",
    (config && config.gasApiUrl) || ""
  ].map(x => String(x || "").trim()).filter(Boolean);
  const found = candidates.find(x => x.startsWith("https://script.google.com/"));
  return found || "";
}

function bootstrapSyncUrlFromQuery(){
  try{
    const params = new URLSearchParams(location.search);
    const raw = params.get("sync") || params.get("api") || "";
    if(!raw) return;
    const decoded = decodeURIComponent(raw).trim();
    if(decoded.startsWith("https://script.google.com/")){
      localStorage.setItem(GAS_URL_KEY, decoded);
      if(config) config.gasApiUrl = decoded;
      history.replaceState(null, "", location.origin + location.pathname + location.hash);
    }
  }catch(e){}
}

function loadConfig(){
  try{
    const local = JSON.parse(localStorage.getItem(KEY) || "null");
    return mergeConfig(window.DEFAULT_CONFIG || {}, local || {});
  }catch(e){
    return window.DEFAULT_CONFIG || {};
  }
}
function mergeConfig(base, incoming){
  incoming = incoming || {};
  return {...base,...incoming,guides:{...(base.guides||{}),...(incoming.guides||{})},media:{...(base.media||{}),...(incoming.media||{})},faq:incoming.faq || base.faq || []};
}
function getInitialTab(){
  const h=(location.hash||"").replace("#","");
  if(allowedTabs.includes(h)) return h;
  const s=localStorage.getItem(ACTIVE_TAB_KEY);
  return allowedTabs.includes(s)?s:"daftar";
}
function safeLink(link){return link && String(link).trim()?String(link).trim():"#";}
function getGasApiUrl(){
  const permanent = getPermanentGasApiUrl();
  return (
    permanent ||
    localStorage.getItem(GAS_URL_KEY) ||
    (config && config.gasApiUrl) ||
    (window.DEFAULT_CONFIG && window.DEFAULT_CONFIG.gasApiUrl) ||
    window.GAS_API_URL ||
    ""
  ).trim();
}
function setGasApiUrl(url){
  const clean = (url || "").trim();
  localStorage.setItem(GAS_URL_KEY, clean);
  if(config) config.gasApiUrl = clean || getPermanentGasApiUrl();
}
function setPullStatus(msg){const el=$("pullStatus"); if(el) el.textContent=msg||"";}
function setUploadStatus(msg){const el=$("uploadStatus"); if(el) el.textContent=msg||"";}
function saveConfig(next){config=mergeConfig(window.DEFAULT_CONFIG||{}, {...next,__localOverride:true}); localStorage.setItem(KEY,JSON.stringify(config)); render();}

async function pullRemoteConfig(){
  if(!window.AUTO_PULL_CONFIG) return;
  const gasUrl=getGasApiUrl(); const source=window.CONFIG_SOURCE||"auto";
  if(gasUrl && (source==="auto" || source==="gas")){
    try{
      const res=await fetch(`${gasUrl}?action=getConfig&v=${Date.now()}`,{cache:"no-store"});
      if(!res.ok) throw new Error("GAS fetch failed");
      const payload=await res.json();
      if(payload && payload.ok===false) throw new Error(payload.error||"GAS payload error");
      applyRemoteConfig(payload.config||payload);
      setPullStatus("Konten terbaru berhasil ditarik dari Google Sheet.");
      return;
    }catch(err){
      setPullStatus("Gagal pull Google Sheet. Mencoba fallback config.json...");
      if(source==="gas") return;
    }
  }
  try{
    const res=await fetch(`${window.CONFIG_URL||"config.json"}?v=${Date.now()}`,{cache:"no-store"});
    if(!res.ok) throw new Error("Config fetch failed");
    const remote=await res.json();
    applyRemoteConfig(remote);
    setPullStatus("Konten terbaru berhasil ditarik dari config.json.");
  }catch(err){
    try{
      const cached=JSON.parse(localStorage.getItem(REMOTE_CACHE_KEY)||"null");
      if(cached){config=mergeConfig(window.DEFAULT_CONFIG||{}, cached); render(); setPullStatus("Mode offline: memakai cache konten terakhir.");}
    }catch(e){}
  }
}
function applyRemoteConfig(remote){
  localStorage.setItem(REMOTE_CACHE_KEY, JSON.stringify(remote));
  const localOverride=JSON.parse(localStorage.getItem(KEY)||"null");
  config=mergeConfig(window.DEFAULT_CONFIG||{}, remote);
  if(remote && remote.gasApiUrl) setGasApiUrl(remote.gasApiUrl);
  if(localOverride && localOverride.__localOverride===true) config=mergeConfig(config, localOverride);
  render();
}
async function pushConfigToGas(){
  const gasUrl=getGasApiUrl();
  if(!gasUrl){alert("Isi dulu Google Apps Script API URL."); return;}
  try{
    setPullStatus("Mengirim config ke Google Sheet...");
    const clean={...config}; delete clean.__localOverride;
    const res=await fetch(gasUrl,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"saveConfig",config:clean})});
    const payload=await res.json();
    if(!payload.ok) throw new Error(payload.error||"Gagal simpan");
    setPullStatus("Config berhasil dikirim ke Google Sheet.");
    return true;
  }catch(err){
    setPullStatus("Gagal push ke Google Sheet.");
    alert("Gagal push ke Google Sheet. Cek URL Web App dan permission Apps Script.");
    return false;
  }
}


function normalizeDriveImageUrl(url){
  url = String(url || "").trim();
  if(!url) return "";
  const idMatch =
    url.match(/[?&]id=([^&]+)/) ||
    url.match(/\/d\/([^/]+)/) ||
    url.match(/\/file\/d\/([^/]+)/);
  if(!idMatch) return url;
  const id = idMatch[1];
  // This format is generally more stable for <img> display than uc?export=download.
  return `https://lh3.googleusercontent.com/d/${id}=w1600`;
}

function normalizeMediaUrl(url, type){
  if(type === "image") return normalizeDriveImageUrl(url);
  return String(url || "").trim();
}

function attachImageFallback(img){
  if(!img || img.dataset.fallbackBound === "1") return;
  img.dataset.fallbackBound = "1";
  img.addEventListener("error", () => {
    const src = img.getAttribute("src") || "";
    const idMatch =
      src.match(/[?&]id=([^&]+)/) ||
      src.match(/\/d\/([^/=]+)/) ||
      src.match(/\/file\/d\/([^/]+)/);
    if(idMatch && img.dataset.driveFallbackTried !== "1"){
      img.dataset.driveFallbackTried = "1";
      img.src = `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1600`;
      return;
    }
    if(img.id === "brandLogo"){
      img.src = "assets/logo-jamet138.png";
    }
    if(img.id === "heroBanner"){
      img.src = "assets/banner-placeholder.svg";
    }
  });
}

function render(){
  setText("brandName", config.brandName || "JAMET138 GUIDE");
  setText("brandTagline", config.tagline || "");
  setText("heroTitle", config.heroTitle || "");
  setText("heroSubtitle", config.heroSubtitle || "");
  setSrc("brandLogo", config.logo || "assets/logo-jamet138.png");
  setSrc("heroBanner", config.banner || "assets/banner-placeholder.svg");
  setHref("btnDaftar", config.daftarLink);
  setHref("btnLogin", config.loginLink);
  setHref("btnAdmin", config.adminLink);
  setHref("btnAdminBottom", config.adminLink);
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active", b.dataset.tab===activeTab));
  document.querySelectorAll("[data-nav-tab]").forEach(b=>b.classList.toggle("active", b.dataset.navTab===activeTab));
  renderGuide(); renderMedia(); renderFaq(); updateUploadPreviews();
}
function setText(id,val){const el=$(id); if(el) el.textContent=val||"";}
function setSrc(id,val){
  const el=$(id);
  if(el){
    attachImageFallback(el);
    el.src=normalizeMediaUrl(val||"", "image");
  }
}
function setHref(id,val){const el=$(id); if(el) el.href=safeLink(val);}

function renderGuide(){
  const labels={daftar:"Cara Daftar",deposit:"Deposit QRIS",transfer:"Transfer Saldo ke Game",withdraw:"Cara Withdraw",promo:"Info Promo"};
  const desc={daftar:"Ikuti langkah pendaftaran akun dari awal sampai bisa login.",deposit:"Panduan deposit memakai QRIS atau metode pembayaran yang tersedia.",transfer:"Cara memindahkan saldo utama ke provider/game tujuan.",withdraw:"Cara tarik saldo dari akun utama ke rekening/e-wallet tujuan.",promo:"Info singkat sebelum klaim bonus atau promo aktif."};
  const steps=(config.guides && config.guides[activeTab]) || [];
  const el=$("guideContent"); if(!el) return;
  el.innerHTML=`<p class="eyebrow">${labels[activeTab]||"Panduan"}</p><h3>${labels[activeTab]||"Panduan"}</h3><p class="muted">${desc[activeTab]||""}</p><ul class="step-list">${steps.map((step,i)=>`<li class="step-item"><div class="step-num">${i+1}</div><div><strong>Langkah ${i+1}</strong><span>${escapeHtml(step)}</span></div></li>`).join("")}</ul>`;
}






















function getStaticVideoUrl(tab){
  const map = {
    daftar: "/assets/videos/tutorial-daftar.mp4",
    deposit: "/assets/videos/tutorial-deposit.mp4",
    transfer: "/assets/videos/tutorial-transfer.mp4",
    withdraw: "/assets/videos/tutorial-withdraw.mp4",
    promo: "/assets/videos/tutorial-promo.mp4"
  };
  const path = map[tab] || map.daftar;
  return `${path}?v=2.0.0`;
}


const VIDEO_TABS = ["daftar","deposit","transfer","withdraw","promo"];
const VIDEO_CACHE_VERSION = "1.9.2";
const preloadedVideos = new Set();

function preloadVideoAsset(tab){
  try{
    const url = getStaticVideoUrl(tab);
    if(!url || preloadedVideos.has(url)) return;
    preloadedVideos.add(url);

    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "video";
    link.href = url;
    document.head.appendChild(link);

    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    v.load();
  }catch(e){}
}

function warmUpOtherVideos(){
  try{
    const order = VIDEO_TABS.filter(t => t !== activeTab);
    order.forEach((tab, idx) => {
      setTimeout(() => preloadVideoAsset(tab), 700 + (idx * 900));
    });
  }catch(e){}
}

function showVideoLoading(message){
  const box = $("videoLoading");
  if(!box) return;
  const b = box.querySelector("b");
  if(b && message) b.textContent = message;
  box.hidden = false;
}

function hideVideoLoading(){
  const box = $("videoLoading");
  if(box) box.hidden = true;
}

function renderMedia(){
  const labels = {
    daftar:"Tutorial Daftar",
    deposit:"Tutorial Deposit QRIS",
    transfer:"Tutorial Transfer Saldo Game",
    withdraw:"Tutorial Withdraw",
    promo:"Tutorial Promo"
  };

  if(typeof setText === "function"){
    setText("mediaTitle", `${labels[activeTab] || "Tutorial"} format HP`);
    setText("guideStepTitle", `${labels[activeTab] || "Panduan"} - langkah tertulis`);
  }

  const videoUrl = getStaticVideoUrl(activeTab);
  const vid = $("tutorialVideo");
  const videoEmpty = $("videoEmpty");
  const driveFrame = $("tutorialDriveFrame");
  const fallbackNote = $("videoFallbackNote");

  if(!vid) return;

  const source = vid.querySelector("source");
  if(source){
    source.src = videoUrl;
    source.type = "video/mp4";
  }

  vid.style.display = "block";
  vid.loop = true;
  vid.controls = true;
  vid.playsInline = true;

  if(videoEmpty) videoEmpty.style.display = "none";
  showVideoLoading("Memuat video...");
  if(driveFrame){
    driveFrame.src = "";
    driveFrame.style.display = "none";
  }
  if(fallbackNote){
    fallbackNote.hidden = false;
    fallbackNote.textContent = ""; fallbackNote.hidden = true;
  }

  vid.onloadeddata = function(){ hideVideoLoading(); };
  vid.oncanplay = function(){ hideVideoLoading(); };
  vid.onplaying = function(){ hideVideoLoading(); };

  vid.onerror = function(){
    hideVideoLoading();
    if(videoEmpty){
      videoEmpty.textContent = `Video belum terbaca. Cek file: ${videoUrl.replace("?v=2.0.0", "")}`;
      videoEmpty.style.display = "flex";
    }
    if(fallbackNote){
      fallbackNote.hidden = false;
      fallbackNote.textContent = "Kalau direct URL video bisa dibuka, refresh/clear cache lalu coba lagi.";
    }
  };

  try{ vid.load(); preloadVideoAsset(activeTab); warmUpOtherVideos(); }catch(e){ hideVideoLoading(); }
}
function renderFaq(){
  const el=$("faqList"); if(!el) return;
  el.innerHTML=(config.faq||[]).map(([q,a])=>`<details class="faq-item"><summary>${escapeHtml(q)}</summary><p>${escapeHtml(a)}</p></details>`).join("");
}
function escapeHtml(text){return String(text||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function scrollToVideoTutorial(){
  const target = document.getElementById("videoTutorial") || document.querySelector(".media-section") || document.querySelector(".guide-section");
  if(target) target.scrollIntoView({behavior:"smooth", block:"start"});
}

function setActiveTab(tab){if(!allowedTabs.includes(tab)) tab="daftar"; activeTab=tab; localStorage.setItem(ACTIVE_TAB_KEY,activeTab); if(location.hash.replace("#","")!==activeTab) history.replaceState(null,"",`#${activeTab}`); render();}


function getActivePin(){
  const p = config && config.pin ? String(config.pin).trim() : "";
  return p || "7788";
}
function resetLocalPinToDefault(){
  try{
    const local = JSON.parse(localStorage.getItem(KEY) || "null") || {};
    local.pin = "7788";
    local.__localOverride = true;
    localStorage.setItem(KEY, JSON.stringify(local));
    config = loadConfig();
    setText("pinError", "");
    setText("pinAlertInfo", "PIN lokal sudah direset ke 7788. Coba masuk lagi.");
    setValue("pinInput", "");
  }catch(e){
    config.pin = "7788";
    setText("pinAlertInfo", "PIN sesi ini direset ke 7788.");
  }
}

function openAdminPin(){
  setValue("pinInput",""); setText("pinError",""); setText("pinAlertInfo", getPinAlertMessage());
  const d=$("pinDialog");
  if(d && typeof d.showModal==="function") d.showModal(); else alert("Browser tidak menjametg popup admin.");
}
function recordFailedPinAttempt(){const a=JSON.parse(localStorage.getItem("slotGuideFailedPinAttempts")||"[]"); a.push({time:new Date().toISOString()}); localStorage.setItem("slotGuideFailedPinAttempts",JSON.stringify(a.slice(-20)));}
function clearPinAttempts(){localStorage.removeItem("slotGuideFailedPinAttempts");}
function getPinAlertMessage(){const a=JSON.parse(localStorage.getItem("slotGuideFailedPinAttempts")||"[]"); if(!a.length)return""; const last=new Date(a[a.length-1].time); return `Alert lokal: ada ${a.length} percobaan PIN salah di device ini. Terakhir: ${last.toLocaleString("id-ID")}.`;}

function fillSettings(){
  setValue("setBrandName", config.brandName); setValue("setTagline", config.tagline); setValue("setHeroTitle", config.heroTitle); setValue("setHeroSubtitle", config.heroSubtitle);
  setValue("setDaftar", config.daftarLink); setValue("setLogin", config.loginLink); setValue("setAdmin", config.adminLink);
  setValue("setLogo", config.logo || ""); setValue("setBanner", config.banner || ""); setValue("setGasApi", getGasApiUrl()); updateSyncShareLink();
  setValue("setPinOld",""); setValue("setPinNew",""); setValue("setPinConfirm","");
  setValue("setDaftarSteps", ((config.guides||{}).daftar||[]).join("\n"));
  setValue("setDepositSteps", ((config.guides||{}).deposit||[]).join("\n"));
  setValue("setTransferSteps", ((config.guides||{}).transfer||[]).join("\n"));
  setValue("setWithdrawSteps", ((config.guides||{}).withdraw||[]).join("\n"));
  setValue("setPromoSteps", ((config.guides||{}).promo||[]).join("\n"));
  setValue("setFaq", (config.faq||[]).map(([q,a])=>`${q} | ${a}`).join("\n"));
  const m=config.media||{};
  setValue("setImgDaftar", m.daftar?.image||""); setValue("setVidDaftar", m.daftar?.video||"");
  setValue("setImgDeposit", m.deposit?.image||""); setValue("setVidDeposit", m.deposit?.video||"");
  setValue("setImgTransfer", m.transfer?.image||""); setValue("setVidTransfer", m.transfer?.video||"");
  setValue("setImgWithdraw", m.withdraw?.image||""); setValue("setVidWithdraw", m.withdraw?.video||"");
  setValue("setImgPromo", m.promo?.image||""); setValue("setVidPromo", m.promo?.video||"");
  updateUploadPreviews();
}
function setValue(id,val){const el=$(id); if(el) el.value=val||"";}
function updateUploadPreviews(){
  const labels={setLogo:"Logo sudah diupload",setBanner:"Banner sudah diupload",setImgDaftar:"Gambar daftar sudah diupload",setVidDaftar:"Video daftar sudah diupload",setImgDeposit:"Gambar deposit sudah diupload",setVidDeposit:"Video deposit sudah diupload",setImgTransfer:"Gambar transfer sudah diupload",setVidTransfer:"Video transfer sudah diupload",setImgWithdraw:"Gambar withdraw sudah diupload",setVidWithdraw:"Video withdraw sudah diupload",setImgPromo:"Gambar promo sudah diupload",setVidPromo:"Video promo sudah diupload"};
  document.querySelectorAll("[data-preview-for]").forEach(el=>{const target=el.dataset.previewFor; const input=$(target); const has=!!(input&&input.value&&input.value.trim()); el.classList.toggle("has-file",has); el.textContent=has?(labels[target]||"File sudah diupload"):"Belum ada file";});
}
function lines(text){return String(text||"").split("\n").map(x=>x.trim()).filter(Boolean);}
function parseFaq(text){return String(text||"").split("\n").map(row=>{const [q,...rest]=row.split("|"); return [q?.trim(), rest.join("|").trim()];}).filter(([q,a])=>q&&a);}
function getNextPinOrThrow(){
  const oldPin=$("setPinOld")?.value.trim()||"", newPin=$("setPinNew")?.value.trim()||"", confirmPin=$("setPinConfirm")?.value.trim()||"";
  if(!oldPin && !newPin && !confirmPin) return getActivePin();
  if(oldPin!==getActivePin()) throw new Error("PIN lama salah. PIN tidak diganti.");
  if(!newPin || newPin.length<4) throw new Error("PIN baru minimal 4 digit/karakter.");
  if(newPin!==confirmPin) throw new Error("Ulangi PIN baru belum sama.");
  return newPin;
}
function collectSettings(){
  return {...config,brandName:$("setBrandName")?.value.trim()||"",tagline:$("setTagline")?.value.trim()||"",heroTitle:$("setHeroTitle")?.value.trim()||"",heroSubtitle:$("setHeroSubtitle")?.value.trim()||"",daftarLink:$("setDaftar")?.value.trim()||"",loginLink:$("setLogin")?.value.trim()||"",adminLink:$("setAdmin")?.value.trim()||"",logo:$("setLogo")?.value.trim()||"",banner:$("setBanner")?.value.trim()||"",pin:getNextPinOrThrow(),guides:{daftar:lines($("setDaftarSteps")?.value),deposit:lines($("setDepositSteps")?.value),transfer:lines($("setTransferSteps")?.value),withdraw:lines($("setWithdrawSteps")?.value),promo:lines($("setPromoSteps")?.value)},media:{daftar:{image:$("setImgDaftar")?.value.trim()||"",video:$("setVidDaftar")?.value.trim()||""},deposit:{image:$("setImgDeposit")?.value.trim()||"",video:$("setVidDeposit")?.value.trim()||""},transfer:{image:$("setImgTransfer")?.value.trim()||"",video:$("setVidTransfer")?.value.trim()||""},withdraw:{image:$("setImgWithdraw")?.value.trim()||"",video:$("setVidWithdraw")?.value.trim()||""},promo:{image:$("setImgPromo")?.value.trim()||"",video:$("setVidPromo")?.value.trim()||""}},faq:parseFaq($("setFaq")?.value)};
}

function fileToBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader(); reader.onload=()=>{const result=String(reader.result||""); resolve(result.includes(",")?result.split(",")[1]:result);}; reader.onerror=reject; reader.readAsDataURL(file);});}
function getUploadFolderName(targetId){const map={setLogo:"logo",setBanner:"banner",setImgDaftar:"daftar-image",setVidDaftar:"daftar-video",setImgDeposit:"deposit-image",setVidDeposit:"deposit-video",setImgTransfer:"transfer-image",setVidTransfer:"transfer-video",setImgWithdraw:"withdraw-image",setVidWithdraw:"withdraw-video",setImgPromo:"promo-image",setVidPromo:"promo-video"}; return map[targetId]||"media";}
async function uploadMediaFile(file,targetId){
  const gasUrl=getGasApiUrl(); if(!gasUrl){alert("Isi dulu Google Apps Script API URL sebelum upload file."); return;}
  if(!file||!targetId) return;
  const isVideo=file.type.startsWith("video/"), maxSize=isVideo?30*1024*1024:5*1024*1024;
  if(file.size>maxSize){alert(isVideo?"Video terlalu besar. Maksimal 30MB.":"Gambar terlalu besar. Maksimal 5MB."); return;}
  try{
    setUploadStatus(`Mengupload ${file.name}... jangan tutup halaman.`);
    const base64=await fileToBase64(file);
    const res=await fetch(gasUrl,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"uploadFile",fileName:file.name,mimeType:file.type||"application/octet-stream",folderTag:getUploadFolderName(targetId),base64})});
    const payload=await res.json();
    if(!payload.ok) throw new Error(payload.error||"Upload gagal");
    const isImageTarget = ["setLogo","setBanner","setImgDaftar","setImgDeposit","setImgTransfer","setImgWithdraw","setImgPromo"].includes(targetId);
    setValue(targetId, isImageTarget ? normalizeMediaUrl(payload.displayUrl || payload.url, "image") : (payload.previewUrl || payload.url || payload.displayUrl || payload.downloadUrl || ""));
    saveConfig(collectSettings());
    updateUploadPreviews();
    setUploadStatus(`Upload berhasil: ${file.name}. Link display sudah distabilkan. Klik Push ke Google Sheet.`);
  }catch(err){console.error(err); setUploadStatus("Upload gagal. Cek Apps Script URL, permission, dan ukuran file."); alert("Upload gagal. Cek Apps Script URL, permission, dan ukuran file.");}
}

function makeSyncShareUrl(){
  const gasUrl = getGasApiUrl();
  if(!gasUrl) return "";
  const u = new URL(location.href);
  u.searchParams.set("sync", gasUrl);
  u.hash = "";
  return u.toString();
}
function updateSyncShareLink(){
  const box = $("syncShareLink");
  if(!box) return;
  box.value = makeSyncShareUrl() || "";
}

function bindEvents(){
  $("makeSyncLink")?.addEventListener("click", async ()=>{
    setGasApiUrl($("setGasApi")?.value.trim() || getGasApiUrl());
    updateSyncShareLink();
    const link = $("syncShareLink")?.value || "";
    if(link){
      try{ await navigator.clipboard.writeText(link); setPullStatus("Link share sinkron disalin."); }catch(e){ setPullStatus("Link share sinkron sudah dibuat. Salin manual."); }
    }else{ alert("Isi Google Apps Script API URL dulu."); }
  });
  document.addEventListener("click",(e)=>{
    const tab=e.target.closest(".tab[data-tab]");
    if(tab){e.preventDefault(); setActiveTab(tab.dataset.tab); scrollToVideoTutorial(); return;}
    const admin=e.target.closest("[data-open-admin]");
    if(admin){e.preventDefault(); openAdminPin(); return;}
    const navTab=e.target.closest("[data-nav-tab]");
    if(navTab){e.preventDefault(); setActiveTab(navTab.dataset.navTab); scrollToVideoTutorial(); return;}
    const clear=e.target.closest(".clear-media[data-clear-target]");
    if(clear){e.preventDefault(); setValue(clear.dataset.clearTarget,""); try{saveConfig(collectSettings()); updateUploadPreviews(); setUploadStatus("Media dikosongkan. Klik Push ke Google Sheet.");}catch(err){alert(err.message||"Gagal mengosongkan media.");} return;}
    const home=e.target.closest('[data-nav="home"]');
    if(home){e.preventDefault(); history.replaceState(null,"","#app"); window.scrollTo({top:0,behavior:"smooth"}); return;}
  });
  document.querySelectorAll(".upload-input").forEach(input=>input.addEventListener("change",async(e)=>{const file=e.target.files&&e.target.files[0]; if(!file)return; await uploadMediaFile(file,e.target.dataset.uploadTarget); e.target.value="";}));
  $("submitPin")?.addEventListener("click",()=>{if($("pinInput")?.value===getActivePin()){$("pinDialog")?.close(); clearPinAttempts(); fillSettings(); $("settingsDialog")?.showModal();}else{recordFailedPinAttempt(); setText("pinError","PIN salah. Akses ditolak."); setText("pinAlertInfo",getPinAlertMessage());}});
  $("resetLocalPin")?.addEventListener("click",()=>{resetLocalPinToDefault();});
  $("saveSettings")?.addEventListener("click",()=>{try{setGasApiUrl($("setGasApi")?.value.trim()||getGasApiUrl()); saveConfig(collectSettings()); updateSyncShareLink(); $("settingsDialog")?.close();}catch(err){alert(err.message||"Setting belum valid.");}});
  $("pullRemoteConfig")?.addEventListener("click",async()=>{setGasApiUrl($("setGasApi")?.value.trim()||getGasApiUrl()); localStorage.removeItem(KEY); await pullRemoteConfig(); fillSettings();});
  $("pushGasConfig")?.addEventListener("click",async()=>{setGasApiUrl($("setGasApi")?.value.trim()||getGasApiUrl()); await pushConfigToGas();});
  $("resetSettings")?.addEventListener("click",()=>{if(confirm("Reset setting lokal di device ini?")){localStorage.removeItem(KEY); config=loadConfig(); render(); $("settingsDialog")?.close();}});
  $("exportConfig")?.addEventListener("click",()=>{const clean={...config}; delete clean.__localOverride; const blob=new Blob([JSON.stringify(clean,null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="jamet138-guide-config-v2.0.0.json"; a.click(); URL.revokeObjectURL(a.href);});
  $("importConfig")?.addEventListener("change",async(e)=>{const file=e.target.files[0]; if(!file)return; try{const data=JSON.parse(await file.text()); saveConfig(data); fillSettings(); alert("Config berhasil diimport.");}catch(err){alert("File config tidak valid.");}});
  window.addEventListener("hashchange",()=>{const next=(location.hash||"").replace("#",""); if(allowedTabs.includes(next)){activeTab=next; localStorage.setItem(ACTIVE_TAB_KEY,activeTab); render();}});
}
function bindInstallPrompt(){
  const btn=$("installPwaBtn");
  window.addEventListener("beforeinstallprompt",(e)=>{e.preventDefault(); deferredInstallPrompt=e; if(btn) btn.hidden=false;});
  btn?.addEventListener("click",async()=>{if(!deferredInstallPrompt){alert("Kalau tombol install tidak menyelesaikan proses, tutup browser lalu buka Chrome lagi. Bisa juga pakai menu titik tiga Chrome → Install app / Tambahkan ke layar utama."); return;} deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt=null; btn.hidden=true;});
  window.addEventListener("appinstalled",()=>{deferredInstallPrompt=null; if(btn) btn.hidden=true;});
}
function preventZoom(){
  document.body.classList.add("no-zoom");
  let lastTouchEnd=0;
  document.addEventListener("touchstart",e=>{if(e.touches.length>1)e.preventDefault();},{passive:false});
  document.addEventListener("touchmove",e=>{if(e.touches.length>1)e.preventDefault();},{passive:false});
  document.addEventListener("touchend",e=>{const now=Date.now(); if(now-lastTouchEnd<=300)e.preventDefault(); lastTouchEnd=now;},{passive:false});
  document.addEventListener("gesturestart",e=>e.preventDefault());
}
function start(){
  bootstrapSyncUrlFromQuery();
  bindEvents(); bindInstallPrompt(); preventZoom(); render(); pullRemoteConfig();
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js", {scope:"./"}).then(reg=>{
      reg.update().catch(()=>{});
    }).catch(()=>{});
  }
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",start); else start();
