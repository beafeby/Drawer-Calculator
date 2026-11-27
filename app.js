const $ = id => document.getElementById(id);
const bills = [
  ["₱1",1],["₱5",5],["₱20",20],["₱50",50],
  ["₱100",100],["₱200",200],["₱500",500],["₱1,000",1000]
];
const money = n => new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"}).format(Number(n)||0);
const val = id => Math.max(0, Number($(id).value) || 0);
const sumLines = text => text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)
  .reduce((sum,line)=>sum + (Number.isFinite(Number(line)) ? Number(line) : 0),0);
const fmtQty = n => Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));

$("denominations").innerHTML = bills.map(([label,amount],i)=>`
  <div class="denom-row">
    <strong class="denom-value">${label}</strong>
    <input id="qty${i}" type="number" min="0" step="1" inputmode="decimal" aria-label="${label} quantity" placeholder="Qty">
    <span class="times">=</span>
    <input id="amt${i}" type="number" min="0" step="0.01" inputmode="decimal" aria-label="${label} total amount" placeholder="0.00">
  </div>`).join("");

function syncFromQty(i) {
  const quantity = Math.max(0, Number($(`qty${i}`).value) || 0);
  $(`amt${i}`).value = quantity ? (quantity * bills[i][1]).toFixed(2) : "";
  calculate();
}
function syncFromAmount(i) {
  const amount = Math.max(0, Number($(`amt${i}`).value) || 0);
  const quantity = amount / bills[i][1];
  $(`qty${i}`).value = amount ? fmtQty(quantity) : "";
  calculate();
}
bills.forEach((_,i)=>{
  $(`qty${i}`).addEventListener("input",()=>syncFromQty(i));
  $(`amt${i}`).addEventListener("input",()=>syncFromAmount(i));
});

function calculate() {
  const billAmounts = bills.map((_,i)=>val(`amt${i}`));
  const cash = billAmounts.reduce((a,b)=>a+b,0) + val("looseCoins") + val("otherCash");
  const pcvLoose = sumLines($("pcvLoose").value);
  const pcvHand = sumLines($("pcvHand").value);
  const pcvHeadOffice = sumLines($("pcvHeadOffice").value);
  const pcvTotal = pcvLoose + pcvHand + pcvHeadOffice;
  const drawer = val("drawer");
  const grand = cash + pcvTotal;
  const variance = drawer - grand;

  $("cashTotal").textContent = money(cash);
  $("pcvLooseSubtotal").textContent = money(pcvLoose);
  $("pcvHandSubtotal").textContent = money(pcvHand);
  $("pcvHeadOfficeSubtotal").textContent = money(pcvHeadOffice);
  $("pcvTotal").textContent = money(pcvTotal);
  $("summaryCash").textContent = money(cash);
  $("summaryPcv").textContent = money(pcvTotal);
  $("summaryDrawer").textContent = money(drawer);
  $("grandTotal").textContent = money(grand);
  $("variance").textContent = money(variance);
  $("variance").classList.toggle("positive",variance>0);
  $("variance").classList.toggle("negative",variance<0);
  $("varianceNote").textContent = variance > 0 ? "Over · Drawer is above Grand Total" :
    variance < 0 ? "Short · Drawer is below Grand Total" : "Balanced · Drawer matches Grand Total";
  return {cash,pcvLoose,pcvHand,pcvHeadOffice,pcvTotal,drawer,grand,variance,billAmounts};
}

function getRecords() {
  try { return JSON.parse(localStorage.getItem("cashierRecords") || "[]"); }
  catch { return []; }
}
function setRecords(records) { localStorage.setItem("cashierRecords",JSON.stringify(records)); }
function formData() {
  const totals = calculate();
  const billCounts = {};
  const billTotals = {};
  bills.forEach(([label],i)=>{
    billCounts[label] = Number($(`qty${i}`).value) || 0;
    billTotals[label] = Number($(`amt${i}`).value) || 0;
  });
  return {
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    date:$("date").value, cashier:$("cashier").value.trim(),
    billCounts,billTotals,looseCoins:val("looseCoins"),otherCash:val("otherCash"),
    pcvLooseEntries:$("pcvLoose").value,pcvHandEntries:$("pcvHand").value,
    pcvHeadOfficeEntries:$("pcvHeadOffice").value,
    ...totals,savedAt:new Date().toISOString()
  };
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function renderRecords() {
  const records=getRecords();
  $("recordCount").textContent=`(${records.length})`;
  $("records").innerHTML = records.length ? records.map(r=>`
    <article class="record">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
        <h3>${escapeHtml(r.cashier || "Unnamed cashier")}</h3><strong>${money(r.grand)}</strong>
      </div>
      <small>${escapeHtml(r.date || "")}</small>
      <div class="muted" style="margin:7px 0">Cash ${money(r.cash)} · PCV ${money(r.pcvTotal)} · Drawer ${money(r.drawer)}</div>
      <div class="muted">Variance: <strong>${money(r.variance)}</strong></div>
      <button class="danger" type="button" data-delete="${escapeHtml(r.id)}" style="margin-top:8px">Delete record</button>
    </article>`).join("") : '<p class="muted">No records saved yet.</p>';
}
function resetForm() {
  document.querySelectorAll("main input, main textarea").forEach(el=>{
    if(el.id==="date") el.value=new Date().toISOString().slice(0,10);
    else el.value="";
  });
  calculate();
}
document.querySelectorAll("main input, main textarea").forEach(el=>{
  if(!/^qty\d+$/.test(el.id) && !/^amt\d+$/.test(el.id)) el.addEventListener("input",calculate);
});
$("date").value=new Date().toISOString().slice(0,10);
$("saveBtn").addEventListener("click",()=>{
  const record=formData();
  if(!record.cashier){alert("Please enter the cashier name before saving.");$("cashier").focus();return;}
  const records=getRecords(); records.unshift(record); setRecords(records); renderRecords();
  alert("Cashier record saved on this device.");
});
$("clearBtn").addEventListener("click",()=>{
  if(confirm("Clear all entries in the form?")) resetForm();
});
$("toggleRecords").addEventListener("click",()=>{
  $("records").classList.toggle("hidden");
  $("toggleRecords").textContent=$("records").classList.contains("hidden")?"Show":"Hide";
});
$("records").addEventListener("click",e=>{
  const id=e.target.dataset.delete;
  if(!id)return;
  if(confirm("Delete this saved record?")){setRecords(getRecords().filter(r=>String(r.id)!==String(id)));renderRecords();}
});
$("exportBtn").addEventListener("click",()=>{
  const records=getRecords();
  if(!records.length){alert("There are no records to export yet.");return;}
  const columns = [
    ["DATE","date"],["CASHIER NAME","cashier"],
    ...bills.flatMap(([label])=>[[`${label} QUANTITY`,["billCounts",label]],[`${label} TOTAL`,["billTotals",label]]]),
    ["LOOSE COINS","looseCoins"],["OTHER CASH / ADJUSTMENT","otherCash"],["TOTAL CASH","cash"],
    ["PCV LOOSE ENTRIES","pcvLooseEntries"],["PCV LOOSE TOTAL","pcvLoose"],
    ["PCV HAND ENTRIES","pcvHandEntries"],["PCV HAND TOTAL","pcvHand"],
    ["PCV HEADOFFICE ENTRIES","pcvHeadOfficeEntries"],["PCV HEADOFFICE TOTAL","pcvHeadOffice"],
    ["TOTAL PCV","pcvTotal"],["CASH IN DRAWER","drawer"],["GRAND TOTAL","grand"],["VARIANCE","variance"]
  ];
  const quote = v => `"${String(v ?? "").replace(/"/g,'""')}"`;
  const get = (record,key) => Array.isArray(key) ? (record[key[0]]?.[key[1]] ?? 0) : (record[key] ?? "");
  const rows = [
    columns.map(c=>quote(c[0])).join(","),
    ...records.map(record=>columns.map(c=>quote(get(record,c[1]))).join(","))
  ];
  const blob=new Blob(["\ufeff"+rows.join("\r\n")],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`cashier-records-${new Date().toISOString().slice(0,10)}.csv`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
calculate();
renderRecords();
if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
